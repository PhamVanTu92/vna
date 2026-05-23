import * as XLSX_PKG from 'xlsx-js-style';
import { LineItem } from './types';
import { isReimbursementItem } from './constants';

// Handle ESM import where the library might be on the default property
const XLSX = (XLSX_PKG as any).default || XLSX_PKG;

/**
 * Converts a File object (PDF) to an array of Base64 strings (images).
 * Uses the window.pdfjsLib library loaded from CDN.
 */
export const convertPdfToImages = async (file: File): Promise<string[]> => {
  const fileData = await file.arrayBuffer();
  
  // Ensure PDF.js is loaded
  if (!window.pdfjsLib) {
    throw new Error("PDF.js library not loaded");
  }

  const pdf = await window.pdfjsLib.getDocument(fileData).promise;
  const numPages = pdf.numPages;
  const images: string[] = [];

  for (let i = 1; i <= numPages; i++) {
    const page = await pdf.getPage(i);
    // Reduced scale from 2.0 to 1.5 to prevent "Rpc failed due to xhr error" (Payload too large)
    // This reduces the pixel count by ~44% (1.5^2 / 2.0^2 = 2.25 / 4 = 0.56)
    const viewport = page.getViewport({ scale: 1.5 }); 
    
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.height = viewport.height;
    canvas.width = viewport.width;

    if (!context) continue;

    const renderContext = {
      canvasContext: context,
      viewport: viewport,
    };

    await page.render(renderContext).promise;
    
    // Convert to base64
    // Reduced quality to 0.6 to significantly reduce payload size for the API request
    const base64Url = canvas.toDataURL('image/jpeg', 0.6);
    // Remove "data:image/jpeg;base64," prefix for the GoogleGenAI inlineData
    const base64Data = base64Url.split(',')[1];
    images.push(base64Data);
  }

  return images;
};

export const downloadCSV = (content: string, filename: string) => {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
};

/**
 * Apply Styles to the Worksheet
 */
const styleWorksheet = (worksheet: any, data: LineItem[], startIndex: number = 0) => {
  // Define Styles
  const headerStyle = {
    font: { bold: true, color: { rgb: "334155" }, name: "Arial", sz: 10 },
    fill: { fgColor: { rgb: "F1F5F9" } }, // slate-100
    alignment: { vertical: "center", wrapText: true }
  };

  const subtotalStyle = {
    font: { bold: true, name: "Arial", sz: 10 },
    fill: { fgColor: { rgb: "FEFCE8" } }, // yellow-50
    border: { top: { style: "thin", color: { rgb: "CBD5E1" } }, bottom: { style: "thin", color: { rgb: "CBD5E1" } } },
    alignment: { vertical: "center" }
  };

  const dataStyle = {
    font: { name: "Arial", sz: 10 },
    alignment: { vertical: "center" }
  };

  const numberFormat = "#,##0";

  // Decode range to iterate cells
  const range = XLSX.utils.decode_range(worksheet['!ref']!);

  // Loop through rows
  for (let R = range.s.r; R <= range.e.r; ++R) {
    // Skip the main header row (Row 0) if creating new file, or adjust index if filling template
    // Assuming startIndex handles where the data actually begins
    const dataIndex = R - startIndex;

    if (dataIndex < 0) {
      // Main Table Header Styling (only if we created it)
      if (R === 0 && startIndex === 1) {
         for (let C = range.s.c; C <= range.e.c; ++C) {
            const cellRef = XLSX.utils.encode_cell({c: C, r: R});
            if (!worksheet[cellRef]) continue;
            worksheet[cellRef].s = {
                font: { bold: true, color: { rgb: "FFFFFF" }, name: "Arial" },
                fill: { fgColor: { rgb: "475569" } }, // slate-600
                alignment: { horizontal: "center", vertical: "center" }
            };
         }
      }
      continue;
    }

    if (dataIndex >= data.length) continue;

    const item = data[dataIndex];
    let rowStyle = { ...dataStyle };

    // Apply specific styles based on rowType
    if (item.rowType === 'header') {
      rowStyle = { ...headerStyle };
    } else if (item.rowType === 'subtotal') {
      rowStyle = { ...subtotalStyle };
    }

    // Loop through columns
    for (let C = range.s.c; C <= range.e.c; ++C) {
      const cellRef = XLSX.utils.encode_cell({c: C, r: R});
      if (!worksheet[cellRef]) continue;

      // Base Style
      worksheet[cellRef].s = rowStyle;

      // Column Specific Formatting
      // 4: Quantity, 5: Unit Price, 6: Tax Refund, 7: Total Amount
      if ([4, 5, 6, 7].includes(C)) {
        worksheet[cellRef].z = numberFormat;
        // Right align numbers
        if (!worksheet[cellRef].s.alignment) worksheet[cellRef].s.alignment = {};
        worksheet[cellRef].s.alignment.horizontal = "right";
      }

      // Special case: Reimbursement items - Gray out text for Unit Price/Qty if they are empty
      if (isReimbursementItem(item.lineCode) && [4, 5].includes(C)) {
         // Should be empty anyway, but ensure no borders look weird
      }
      
      // Special case: Data rows PO Num centered
      if (C === 0 && item.rowType === 'data') {
         if (!worksheet[cellRef].s.alignment) worksheet[cellRef].s.alignment = {};
         worksheet[cellRef].s.alignment.horizontal = "center";
      }
    }
  }
};

export const exportToExcel = (data: LineItem[], filename: string, templateBuffer?: ArrayBuffer) => {
  if (templateBuffer) {
    // --- MODE 1: FILL TEMPLATE ---
    // Read the template file
    const workbook = XLSX.read(templateBuffer, { type: 'array' });
    
    // Assume we work on the first sheet
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    // Find the last row to append to
    const range = XLSX.utils.decode_range(worksheet['!ref'] || "A1");
    const originRow = range.e.r + 1;

    // Prepare data
    const rowData = data.map(item => {
      if (item.rowType === 'header') {
        return ['', '', item.description, '', '', '', '', '', ''];
      }
      if (item.rowType === 'subtotal') {
        return ['', '', item.description, '', '', '', item.taxRefund || 0, item.totalAmount, ''];
      }
      
      const isReimb = isReimbursementItem(item.lineCode);

      return [
        item.poNum || '',
        item.lineCode,
        item.description,
        item.unit || '',
        isReimb ? '' : item.quantity,    
        isReimb ? '' : item.unitPrice,   
        item.taxRefund || '', 
        item.totalAmount,
        item.glCode || ''
      ];
    });

    // Append data
    XLSX.utils.sheet_add_aoa(worksheet, rowData, { origin: -1 });

    // Update the range of the worksheet to include new data
    const newRange = XLSX.utils.decode_range(worksheet['!ref']!);
    newRange.e.r = originRow + rowData.length - 1;
    worksheet['!ref'] = XLSX.utils.encode_range(newRange);

    // Apply Styling to the new rows
    styleWorksheet(worksheet, data, originRow);

    // Write file
    XLSX.writeFile(workbook, filename);

  } else {
    // --- MODE 2: CREATE NEW EXCEL ---
    // Format data with headers
    const formattedData = data.map(item => {
      if (item.rowType === 'header') {
        return {
          "PO Num": "",
          "Line Code": "",
          "Description": item.description, 
          "Unit": "",
          "Quantity": "",
          "Unit Price": "",
          "Tax Refund": "",
          "Total Amount": "",
          "GL Code": ""
        };
      }
      if (item.rowType === 'subtotal') {
        return {
          "PO Num": "",
          "Line Code": "",
          "Description": item.description,
          "Unit": "",
          "Quantity": "",
          "Unit Price": "",
          "Tax Refund": item.taxRefund || 0,
          "Total Amount": item.totalAmount,
          "GL Code": ""
        };
      }
      
      const isReimb = isReimbursementItem(item.lineCode);

      return {
        "PO Num": item.poNum || '',
        "Line Code": item.lineCode,
        "Description": item.description,
        "Unit": item.unit || '',
        "Quantity": isReimb ? '' : item.quantity,
        "Unit Price": isReimb ? '' : item.unitPrice,
        "Tax Refund": item.taxRefund || '',
        "Total Amount": item.totalAmount,
        "GL Code": item.glCode || ''
      };
    });

    // Create a new workbook and worksheet
    const worksheet = XLSX.utils.json_to_sheet(formattedData);
    const workbook = XLSX.utils.book_new();

    // Adjust column widths
    const wscols = [
      { wch: 10 }, // PO Num
      { wch: 15 }, // Line Code
      { wch: 40 }, // Description
      { wch: 8 },  // Unit
      { wch: 10 }, // Quantity
      { wch: 15 }, // Unit Price
      { wch: 15 }, // Tax Refund
      { wch: 20 }, // Total Amount
      { wch: 35 }, // GL Code 
    ];
    worksheet['!cols'] = wscols;

    // Apply Styling (Start index 1 because row 0 is header)
    styleWorksheet(worksheet, data, 1);

    // Append worksheet to workbook
    XLSX.utils.book_append_sheet(workbook, worksheet, "CV2006 Data");

    // Generate and download file
    XLSX.writeFile(workbook, filename);
  }
};
