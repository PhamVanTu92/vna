
export interface LineItemDetail {
  reference: string; // e.g., "VN300 (01/Oct)", "Invoice #123"
  subQuantity: number;
}

export interface LineItem {
  lineCode: string;
  description: string;
  quantity: number;
  unit: string; // New field for Unit of Measurement (e.g., a/c, case, hrs.)
  unitPrice: number;
  taxRefund?: number; // Updated: Stores the specific Tax Refund Amount (0 if none)
  totalAmount: number;
  noteSource: string;
  glCode?: string; // New field for General Ledger Code
  details?: LineItemDetail[];
  rowType?: 'data' | 'header' | 'subtotal'; // Distinguish between data, section headers, and calculated totals
  poNum?: number; // New field: Incremental counter for non-zero items
}

export enum ProcessingStatus {
  IDLE = 'IDLE',
  READING_PDF = 'READING_PDF',
  ANALYZING = 'ANALYZING',
  COMPLETED = 'COMPLETED',
  ERROR = 'ERROR'
}

export interface AnalysisResult {
  items: LineItem[];
  rawResponse?: string;
}

// Extend Window interface for PDF.js
declare global {
  interface Window {
    pdfjsLib: any;
  }
}
