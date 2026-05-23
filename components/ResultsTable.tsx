import React, { useState, useEffect } from 'react';
import { LineItem } from '../types';
import { FileSpreadsheet, FileCheck, Eye, X, Info, Edit3, Check, Save } from 'lucide-react';
import { exportToExcel } from '../utils';
import { isReimbursementItem } from '../constants';

interface ResultsTableProps {
  data: LineItem[];
  templateFile: File | null;
  sourceFileName: string;
  onDataUpdate?: (newData: LineItem[]) => void;
}

// Helper to format numbers with commas (1000 -> "1,000")
const formatDisplayNumber = (value: number | undefined | null) => {
  if (value === undefined || value === null) return '';
  // Check if it's strictly 0, we still show it (or show '0')
  return value.toLocaleString('en-US', { maximumFractionDigits: 6 });
};

// Helper to parse comma-separated strings back to numbers ("1,000" -> 1000)
const parseDisplayNumber = (value: string) => {
  if (!value) return 0;
  // Remove commas and parse
  const cleaned = value.replace(/,/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
};

// Helper to extract the last part of the line code
const formatLineCode = (code: string) => {
  if (!code) return '';
  const parts = code.split('/');
  return parts.length > 0 ? parts[parts.length - 1] : code;
};

const ResultsTable: React.FC<ResultsTableProps> = ({ data, templateFile, sourceFileName, onDataUpdate }) => {
  const [selectedItem, setSelectedItem] = useState<LineItem | null>(null);
  const [localData, setLocalData] = useState<LineItem[]>(data);

  // Sync local data if parent data changes (e.g. new file processed)
  useEffect(() => {
    setLocalData(data);
  }, [data]);

  const handleExport = async () => {
    try {
      let templateBuffer: ArrayBuffer | undefined = undefined;

      if (templateFile) {
        templateBuffer = await templateFile.arrayBuffer();
      }

      const now = new Date();
      const yy = now.getFullYear().toString().slice(-2);
      const mm = (now.getMonth() + 1).toString().padStart(2, '0');
      const dd = now.getDate().toString().padStart(2, '0');
      const hh = now.getHours().toString().padStart(2, '0');
      const min = now.getMinutes().toString().padStart(2, '0');
      const timestamp = `${yy}${mm}${dd}${hh}${min}`;

      const baseName = sourceFileName.replace(/\.pdf$/i, '');
      const exportFileName = `${baseName}_${timestamp}.xlsx`;

      exportToExcel(localData, exportFileName, templateBuffer);
      
    } catch (error) {
      console.error("Failed to export excel:", error);
      alert("Error exporting Excel file. Please try again.");
    }
  };

  // Handle cell edits
  const handleCellChange = (index: number, field: keyof LineItem, value: any) => {
    const updatedData = [...localData];
    const item = { ...updatedData[index] };

    if (field === 'quantity' || field === 'unitPrice' || field === 'totalAmount' || field === 'taxRefund') {
        // Assume value comes in as raw string from input (might have commas if user typed them, or just raw digits)
        // We parse it using our helper
        (item as any)[field] = parseDisplayNumber(String(value));
    } else {
        (item as any)[field] = value;
    }

    updatedData[index] = item;
    setLocalData(updatedData);
    
    // Notify parent if needed
    if (onDataUpdate) {
        onDataUpdate(updatedData);
    }
  };

  return (
    <>
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <div>
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <FileCheck className="w-5 h-5 text-teal-600" />
              Extracted Line Items
            </h2>
            <p className="text-sm text-slate-500 mt-1 flex items-center gap-2">
              Review and edit the data below before exporting. 
              <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full flex items-center gap-1">
                 <Edit3 className="w-3 h-3" /> Editable
              </span>
              {templateFile && <span className="text-indigo-600 font-medium ml-2">(Using Template: {templateFile.name})</span>}
            </p>
          </div>
          <button
            onClick={handleExport}
            className="flex items-center gap-2 bg-green-700 hover:bg-green-800 text-white px-4 py-2 rounded-lg font-medium transition-colors shadow-sm"
          >
            <FileSpreadsheet className="w-4 h-4" />
            {templateFile ? "Export to Template" : "Export to Excel"}
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-100 text-slate-600 font-semibold border-b border-slate-200">
              <tr>
                <th className="px-4 py-4 w-12">PO Num</th>
                <th className="px-4 py-4 w-28">Line Code</th>
                <th className="px-4 py-4 w-[240px]">Description</th>
                <th className="px-4 py-4 w-16 text-center">Unit</th>
                <th className="px-4 py-4 w-20 text-right">Qty</th>
                <th className="px-4 py-4 w-24 text-right">Price</th>
                <th className="px-4 py-4 w-24 text-right">Tax Refund</th>
                <th className="px-4 py-4 w-32 text-right">Total (JPY)</th>
                <th className="px-4 py-4 w-32">GL Code</th>
                <th className="px-4 py-4 w-16 text-center">Detail</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {localData.map((item, index) => {
                // RENDER: SECTION HEADER
                if (item.rowType === 'header') {
                  return (
                    <tr key={index} className="bg-slate-100/70">
                      <td colSpan={10} className="px-6 py-3 font-bold text-slate-800 uppercase tracking-wide text-xs pt-4">
                        {item.description}
                      </td>
                    </tr>
                  );
                }

                // RENDER: SUBTOTAL / TOTAL
                if (item.rowType === 'subtotal') {
                  return (
                    <tr key={index} className="bg-yellow-50 border-t-2 border-slate-200">
                      <td className="px-4 py-3"></td> {/* PO */}
                      <td className="px-4 py-3"></td> {/* LineCode */}
                      <td colSpan={4} className="px-4 py-3 font-bold text-slate-700 text-left">
                        {item.description}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-slate-900 border-t border-slate-300">
                         {/* Edit Tax Refund Subtotal */}
                         <input 
                          type="text" 
                          value={formatDisplayNumber(item.taxRefund)}
                          onChange={(e) => handleCellChange(index, 'taxRefund', e.target.value)}
                          className="w-full bg-transparent text-right outline-none focus:border-b focus:border-indigo-500 font-bold"
                        />
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-slate-900 border-t border-slate-300">
                         {/* Edit Total Amount Subtotal */}
                         <input 
                          type="text" 
                          value={formatDisplayNumber(item.totalAmount)}
                          onChange={(e) => handleCellChange(index, 'totalAmount', e.target.value)}
                          className="w-full bg-transparent text-right outline-none focus:border-b focus:border-indigo-500 font-bold"
                        />
                      </td>
                      <td colSpan={2} className="px-6 py-3"></td>
                    </tr>
                  );
                }

                // RENDER: NORMAL DATA ROW
                const isReimb = isReimbursementItem(item.lineCode);

                return (
                  <tr key={index} className="hover:bg-slate-50 transition-colors group">
                    {/* PO Num */}
                    <td className="px-4 py-2 font-mono text-slate-500 font-semibold text-center">
                      {item.poNum || ''}
                    </td>
                    
                    {/* Line Code */}
                    <td className="px-4 py-2">
                        <input 
                          type="text" 
                          value={item.lineCode}
                          onChange={(e) => handleCellChange(index, 'lineCode', e.target.value)}
                          className="w-full bg-transparent text-indigo-600 font-medium font-mono text-xs outline-none focus:bg-white focus:ring-1 focus:ring-indigo-200 rounded px-1"
                          title={item.lineCode}
                        />
                    </td>

                    {/* Description */}
                    <td className="px-4 py-2">
                        <input 
                          type="text" 
                          value={item.description}
                          onChange={(e) => handleCellChange(index, 'description', e.target.value)}
                          className="w-full bg-transparent text-slate-800 outline-none focus:bg-white focus:ring-1 focus:ring-indigo-200 rounded px-1"
                        />
                    </td>

                    {/* Unit */}
                    <td className="px-4 py-2">
                        <input 
                          type="text" 
                          value={item.unit || ''}
                          onChange={(e) => handleCellChange(index, 'unit', e.target.value)}
                          className="w-full bg-transparent text-center text-slate-500 text-xs font-medium outline-none focus:bg-white focus:ring-1 focus:ring-indigo-200 rounded px-1"
                        />
                    </td>

                    {/* Quantity - Hide if Reimbursement */}
                    <td className="px-4 py-2">
                        <input 
                          type="text" 
                          value={isReimb ? '' : formatDisplayNumber(item.quantity)}
                          onChange={(e) => handleCellChange(index, 'quantity', e.target.value)}
                          readOnly={isReimb}
                          className={`w-full bg-transparent text-right text-slate-600 outline-none focus:bg-white focus:ring-1 focus:ring-indigo-200 rounded px-1 ${isReimb ? 'cursor-not-allowed opacity-50' : ''}`}
                        />
                    </td>

                    {/* Unit Price - Hide if Reimbursement */}
                    <td className="px-4 py-2">
                         <input 
                          type="text" 
                          value={isReimb ? '' : formatDisplayNumber(item.unitPrice)}
                          onChange={(e) => handleCellChange(index, 'unitPrice', e.target.value)}
                          readOnly={isReimb}
                          className={`w-full bg-transparent text-right text-slate-600 outline-none focus:bg-white focus:ring-1 focus:ring-indigo-200 rounded px-1 ${isReimb ? 'cursor-not-allowed opacity-50' : ''}`}
                        />
                    </td>

                    {/* Tax Refund (Text Input with formatting) */}
                    <td className="px-4 py-2">
                        <input 
                          type="text" 
                          value={item.taxRefund && item.taxRefund > 0 ? formatDisplayNumber(item.taxRefund) : ''}
                          placeholder=""
                          onChange={(e) => handleCellChange(index, 'taxRefund', e.target.value)}
                          className="w-full bg-transparent text-right text-slate-600 font-mono text-xs outline-none focus:bg-white focus:ring-1 focus:ring-indigo-200 rounded px-1"
                        />
                    </td>

                    {/* Total Amount */}
                    <td className="px-4 py-2">
                        <input 
                          type="text" 
                          value={formatDisplayNumber(item.totalAmount)}
                          onChange={(e) => handleCellChange(index, 'totalAmount', e.target.value)}
                          className="w-full bg-transparent text-right font-semibold text-slate-900 outline-none focus:bg-white focus:ring-1 focus:ring-indigo-200 rounded px-1"
                        />
                    </td>

                    {/* GL Code */}
                    <td className="px-4 py-2">
                        <input 
                          type="text" 
                          value={item.glCode || ''}
                          onChange={(e) => handleCellChange(index, 'glCode', e.target.value)}
                          className="w-full bg-transparent text-xs font-mono text-slate-500 outline-none focus:bg-white focus:ring-1 focus:ring-indigo-200 rounded px-1"
                        />
                    </td>

                    {/* Details Button */}
                    <td className="px-4 py-2 text-center">
                      {(item.details && item.details.length > 0) || item.noteSource ? (
                        <button 
                          onClick={() => setSelectedItem(item)}
                          className="inline-flex items-center justify-center p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-full transition-colors"
                          title="View Evidence / Breakdown"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      ) : (
                        <span className="text-slate-200">-</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      
      {/* Details Modal */}
      {selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden animate-scale-in flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 shrink-0">
              <div>
                <h3 className="font-bold text-slate-800">Quantity Breakdown</h3>
                <p className="text-xs text-slate-500 font-mono mt-1">{selectedItem.lineCode} • {selectedItem.glCode}</p>
              </div>
              <button 
                onClick={() => setSelectedItem(null)}
                className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 p-2 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="overflow-y-auto p-0 flex-1">
              
              {/* Evidence Note Section */}
              {selectedItem.noteSource && (
                <div className="p-4 m-4 bg-blue-50 border border-blue-100 rounded-lg text-sm text-blue-900 flex gap-3">
                  <Info className="w-5 h-5 text-blue-600 shrink-0" />
                  <div>
                    <strong className="block mb-1 font-semibold text-blue-800">Explanation / Source:</strong>
                    {selectedItem.noteSource}
                  </div>
                </div>
              )}

              {/* Breakdown Table */}
              {selectedItem.details && selectedItem.details.length > 0 ? (
                <table className="w-full text-sm border-t border-slate-100">
                  <thead className="bg-slate-50 text-slate-500 font-medium sticky top-0">
                    <tr>
                      <th className="px-6 py-3 text-left">Reference / Flight</th>
                      <th className="px-6 py-3 text-right">Sub-Qty</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {selectedItem.details.map((detail, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="px-6 py-3 text-slate-700">{detail.reference}</td>
                        <td className="px-6 py-3 text-right font-mono text-slate-600">{formatDisplayNumber(detail.subQuantity)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-slate-50 font-semibold text-slate-900 border-t border-slate-100">
                    <tr>
                      <td className="px-6 py-3 text-right">Total</td>
                      <td className="px-6 py-3 text-right">{formatDisplayNumber(selectedItem.quantity)}</td>
                    </tr>
                  </tfoot>
                </table>
              ) : (
                <div className="px-6 pb-6 text-center text-slate-400 text-sm italic">
                  No structured line items found in AI response. <br/> See explanation above.
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end shrink-0">
              <button 
                onClick={() => setSelectedItem(null)}
                className="bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ResultsTable;