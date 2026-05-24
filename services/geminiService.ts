import { LineItem } from '../types';
import { getGlCode, getUnit, isReimbursementItem } from '../constants';

// Helper to create a header item
const createHeader = (description: string): LineItem => ({
  lineCode: '',
  description,
  quantity: 0,
  unit: '',
  unitPrice: 0,
  taxRefund: 0,
  totalAmount: 0,
  noteSource: '',
  rowType: 'header'
});

// Helper to create a subtotal item
const createSubtotal = (description: string, amount: number, taxRefund: number = 0): LineItem => ({
  lineCode: '',
  description,
  quantity: 0,
  unit: '',
  unitPrice: 0,
  taxRefund: taxRefund,
  totalAmount: amount,
  noteSource: '',
  rowType: 'subtotal'
});

const reconstructReportStructure = (extractedItems: LineItem[]): LineItem[] => {
  const result: LineItem[] = [];

  // Pad with MISSING items if AI returned fewer than 39
  const safeItems = [...extractedItems];
  while (safeItems.length < 39) {
    safeItems.push({
      lineCode: 'MISSING',
      description: 'MISSING DATA',
      quantity: 0,
      unit: '',
      unitPrice: 0,
      taxRefund: 0,
      totalAmount: 0,
      noteSource: 'AI did not return this line',
      rowType: 'data'
    });
  }

  const addSection = (header: string, startIndex: number, count: number) => {
    result.push(createHeader(header));
    for (let i = 0; i < count; i++) {
      const item = safeItems[startIndex + i];
      if (item) {
        item.rowType = 'data';
        result.push(item);
      }
    }
  };

  addSection('I. Comprehensive Ground Handling', 0, 9);
  addSection('II. Cargo FLT ground handling', 9, 1);
  addSection('III. Irregular Handling for Off/On-Loading Only', 10, 3);
  addSection('IV. Irregular Handling for Turn Cleaning only', 13, 3);
  addSection('V. Aircraft Moving Operations', 16, 5);
  addSection('VI. Trucking Service for Oversized Baggage etc', 21, 1);
  addSection('VII. Ad-hoc Service (minimum 1.00hr charge)', 22, 3);
  addSection('VIII. Trucking Mounted Passenger Step Operation', 25, 1);
  addSection('IX. Overtime for Irregular Operation', 26, 2);
  addSection('X. Ground hadling with JASCO owned GSEs', 28, 3);

  const items1to31 = safeItems.slice(0, 31);
  const subTotal1Amount = items1to31.reduce((sum, item) => sum + (item.totalAmount || 0), 0);
  const subTotal1Tax = items1to31.reduce((sum, item) => sum + (item.taxRefund || 0), 0);
  result.push(createSubtotal('Sub Total (I - X)', subTotal1Amount, subTotal1Tax));

  addSection('XI. Reimbursement (Chi hộ)', 31, 8);

  const items32to39 = safeItems.slice(31, 39);
  const subTotal2Amount = items32to39.reduce((sum, item) => sum + (item.totalAmount || 0), 0);
  const subTotal2Tax = items32to39.reduce((sum, item) => sum + (item.taxRefund || 0), 0);
  result.push(createSubtotal('Sub Total (XI)', subTotal2Amount, subTotal2Tax));

  const grandTotalAmount = subTotal1Amount + subTotal2Amount;
  const grandTotalTax = subTotal1Tax + subTotal2Tax;
  result.push(createSubtotal('Grand Total', grandTotalAmount, grandTotalTax));

  const approveAmount = grandTotalAmount - grandTotalTax;
  result.push(createSubtotal('APPROVE', approveAmount, 0));

  // Assign PO numbers only to non-zero data rows
  let poCounter = 1;
  for (const item of result) {
    if (item.rowType === 'data') {
      item.poNum = (item.totalAmount && item.totalAmount !== 0) ? poCounter++ : undefined;
    }
  }

  return result;
};

const applyBusinessRules = (item: LineItem): LineItem => {
  const isReimb = isReimbursementItem(item.lineCode);
  const glCode = getGlCode(item.lineCode);
  const unit = getUnit(item.lineCode, item.description);

  let finalQuantity = item.quantity;
  let finalUnitPrice = item.unitPrice;
  let finalTotalAmount = item.totalAmount;
  let finalTaxRefund = item.taxRefund || 0;

  // Reimbursement items (Section XI) have blank Quantity and Unit Price
  if (isReimb) {
    finalQuantity = 0;
    finalUnitPrice = 0;
  }

  // Item 18 (NRT/GH34/14 - A321/A321 NEO): force unit price
  if (item.lineCode === 'NRT/GH34/14' && item.description.includes('A321')) {
    finalUnitPrice = 146019;
    if (finalQuantity > 0) {
      finalTotalAmount = finalQuantity * finalUnitPrice;
    }
  }

  // Item 39 (NRT/GH34/92 - Consumption tax): totalAmount = taxRefund
  if (item.lineCode === 'NRT/GH34/92' && item.description.toLowerCase().includes('consumption tax')) {
    finalTotalAmount = finalTaxRefund;
  }

  return {
    ...item,
    glCode,
    unit,
    quantity: finalQuantity,
    unitPrice: finalUnitPrice,
    totalAmount: finalTotalAmount,
    taxRefund: finalTaxRefund
  };
};

export interface OcrMeta {
  fileName?:    string;
  fileSize?:    number;
  period?:      string | null;
  docType?:     string | null;   // loại chứng từ đã chọn
  branchId?:    number | null;   // chi nhánh (admin có thể chọn khác)
}

export interface OcrResult {
  items:          any[];          // LineItem[] for ground_handling, generic for others
  documentId:     number;
  docType:        string | null;
  fieldMappings:  any[];          // returned from server
  isGroundHandling: boolean;      // true → ResultsTable; false → generic table
}

export const analyzePdfImages = async (
  base64Images: string[],
  _systemPrompt?: string,       // deprecated
  _deprecatedApiKey?: string,   // deprecated
  _selectedModel?: string,      // deprecated
  meta?: OcrMeta
): Promise<OcrResult> => {
  const response = await fetch('/api/ocr/analyze', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${localStorage.getItem('auth_token') ?? ''}`
    },
    body: JSON.stringify({
      base64Images,
      fileName:  meta?.fileName  ?? 'document.pdf',
      fileSize:  meta?.fileSize  ?? 0,
      period:    meta?.period    ?? null,
      docType:   meta?.docType   ?? null,
      branchId:  meta?.branchId  ?? null,
    })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Server error: ${response.status}`);
  }

  const serverResp = await response.json();
  const rawItems:    any[]   = serverResp.items        ?? [];
  const docType:     string  = serverResp.docType      ?? meta?.docType ?? '';
  const fieldMappings: any[] = serverResp.fieldMappings ?? [];
  const documentId:  number  = serverResp.documentId  ?? 0;

  // Ground-handling: apply existing GL-code, unit, and structure rules
  const isGroundHandling = !docType || docType === 'ground_handling';
  if (isGroundHandling) {
    const processedData = (rawItems as LineItem[]).map(applyBusinessRules);
    return {
      items: reconstructReportStructure(processedData),
      documentId,
      docType,
      fieldMappings,
      isGroundHandling: true,
    };
  }

  // Other doc types — return raw items; let the UI display them dynamically
  return {
    items: rawItems,
    documentId,
    docType,
    fieldMappings,
    isGroundHandling: false,
  };
};
