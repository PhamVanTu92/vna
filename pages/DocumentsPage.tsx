import React, { useEffect, useState } from 'react';
import { FileText, Download, Eye, RefreshCw, Calendar, Search, X } from 'lucide-react';

interface Document {
  id: number; fileName: string; fileSize: number; period: string | null;
  status: string; geminiModel: string; tokensUsed: number | null;
  costUsd: number | null; createdAt: string; exportedAt: string | null;
  branch?: { id: number; name: string; code: string };
  uploadedBy?: { id: number; fullName: string };
}

const authHeader = () => ({ Authorization: `Bearer ${localStorage.getItem('auth_token')}` });
const fmtSize    = (b: number) => b > 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${(b / 1024).toFixed(0)} KB`;
const fmtDate    = (s: string) => new Date(s).toLocaleString('vi-VN');
const fmtCost    = (c: number | null) => c != null ? `$${c.toFixed(4)}` : '—';

const STATUS_STYLE: Record<string, string> = {
  completed:  'bg-green-100 text-green-700',
  processing: 'bg-blue-100 text-blue-700',
  error:      'bg-red-100 text-red-600'
};

export const DocumentsPage: React.FC = () => {
  const [docs, setDocs]       = useState<Document[]>([]);
  const [total, setTotal]     = useState(0);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod]   = useState('');
  const [page, setPage]       = useState(1);
  const [viewing, setViewing] = useState<Document | null>(null);
  const [resultData, setResultData] = useState<any[] | null>(null);

  const load = async (p = page, per = period) => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(p), limit: '20' });
    if (per) params.set('period', per);
    const res  = await fetch(`/api/documents?${params}`, { headers: authHeader() });
    const data = await res.json();
    setDocs(data.documents ?? []);
    setTotal(data.total ?? 0);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleFilter = () => { setPage(1); load(1, period); };
  const clearFilter  = () => { setPeriod(''); setPage(1); load(1, ''); };

  const viewResult = async (doc: Document) => {
    setViewing(doc); setResultData(null);
    const res  = await fetch(`/api/documents/${doc.id}`, { headers: authHeader() });
    const data = await res.json();
    try { setResultData(JSON.parse(data.document.result)); } catch { setResultData([]); }
  };

  const totalPages = Math.ceil(total / 20);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Lịch sử chứng từ OCR</h1>
          <p className="text-sm text-slate-500 mt-0.5">{total} chứng từ</p>
        </div>
        <button onClick={() => load()} className="text-slate-400 hover:text-slate-600"><RefreshCw className="w-4 h-4" /></button>
      </div>

      {/* Filter */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 mb-4 flex items-center gap-3">
        <Calendar className="w-4 h-4 text-slate-400" />
        <input value={period} onChange={e => setPeriod(e.target.value)}
          placeholder="Lọc theo tháng (VD: 2025-04)"
          className="flex-1 text-sm outline-none text-slate-700 placeholder:text-slate-400" />
        {period && <button onClick={clearFilter} className="text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button>}
        <button onClick={handleFilter}
          className="flex items-center gap-1.5 bg-[#005c8f] text-white px-3 py-1.5 rounded-lg text-sm font-medium">
          <Search className="w-3.5 h-3.5" /> Lọc
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-400 text-sm">Đang tải...</div>
        ) : docs.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-sm">Chưa có chứng từ nào.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="bg-slate-50">
                {['Tên file', 'Chi nhánh', 'Kỳ', 'Model', 'Chi phí', 'Người upload', 'Thời gian', 'Trạng thái', ''].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr></thead>
              <tbody className="divide-y divide-slate-100">
                {docs.map(doc => (
                  <tr key={doc.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-slate-400 flex-shrink-0" />
                        <span className="font-medium text-slate-800 truncate max-w-[160px]">{doc.fileName}</span>
                      </div>
                      <div className="text-xs text-slate-400 ml-6">{fmtSize(doc.fileSize)}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs">{doc.branch?.code ?? '—'}</td>
                    <td className="px-4 py-3 text-slate-500 font-mono text-xs">{doc.period ?? '—'}</td>
                    <td className="px-4 py-3 text-slate-400 text-xs truncate max-w-[120px]">{doc.geminiModel}</td>
                    <td className="px-4 py-3 text-slate-600 font-mono text-xs">{fmtCost(doc.costUsd)}</td>
                    <td className="px-4 py-3 text-slate-500 text-xs">{doc.uploadedBy?.fullName}</td>
                    <td className="px-4 py-3 text-slate-400 text-xs whitespace-nowrap">{fmtDate(doc.createdAt)}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLE[doc.status] ?? 'bg-slate-100 text-slate-500'}`}>
                        {doc.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {doc.status === 'completed' && (
                        <button onClick={() => viewResult(doc)}
                          className="text-[#005c8f] hover:text-[#004a73] p-1" title="Xem kết quả">
                          <Eye className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 text-sm text-slate-500">
            <span>Trang {page} / {totalPages}</span>
            <div className="flex gap-2">
              <button disabled={page <= 1} onClick={() => { setPage(p => p - 1); load(page - 1); }}
                className="px-3 py-1 rounded border border-slate-200 disabled:opacity-40 hover:bg-slate-50">←</button>
              <button disabled={page >= totalPages} onClick={() => { setPage(p => p + 1); load(page + 1); }}
                className="px-3 py-1 rounded border border-slate-200 disabled:opacity-40 hover:bg-slate-50">→</button>
            </div>
          </div>
        )}
      </div>

      {/* Viewer modal */}
      {viewing && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="font-semibold text-slate-800 truncate">{viewing.fileName}</h2>
              <button onClick={() => setViewing(null)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="flex-1 overflow-auto p-4">
              {!resultData ? (
                <div className="text-slate-400 text-sm text-center py-8">Đang tải kết quả...</div>
              ) : (
                <table className="w-full text-xs border-collapse">
                  <thead><tr className="bg-slate-50">
                    {['#', 'Mã', 'Mô tả', 'SL', 'Đơn giá', 'Thành tiền'].map(h => (
                      <th key={h} className="px-3 py-2 text-left font-semibold text-slate-500 border border-slate-200">{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {resultData.filter((r: any) => r.rowType === 'data' && r.totalAmount).map((row: any, i: number) => (
                      <tr key={i} className="hover:bg-slate-50">
                        <td className="px-3 py-1.5 border border-slate-100 text-slate-400">{row.poNum ?? ''}</td>
                        <td className="px-3 py-1.5 border border-slate-100 font-mono">{row.lineCode}</td>
                        <td className="px-3 py-1.5 border border-slate-100 text-slate-600">{row.description}</td>
                        <td className="px-3 py-1.5 border border-slate-100 text-right">{row.quantity}</td>
                        <td className="px-3 py-1.5 border border-slate-100 text-right">{row.unitPrice?.toLocaleString()}</td>
                        <td className="px-3 py-1.5 border border-slate-100 text-right font-medium">{row.totalAmount?.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
