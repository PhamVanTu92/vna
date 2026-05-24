import React, { useEffect, useState, useCallback } from 'react';

const token = () => localStorage.getItem('auth_token') ?? '';

interface ReconcileItem {
  id: number;
  branchId: number;
  ocrAmount: number;
  gasAmount: number | null;
  gasRef: string | null;
  difference: number;
  status: string; // matched | mismatch_minor | mismatch_major | not_found | flagged | approved
  aiConfidence: number;
  flagReason: string | null;
  flagNote: string | null;
  approvedById: number | null;
  approvedAt: string | null;
  createdAt: string;
  document: {
    id: number;
    fileName: string;
    docType: string | null;
    period: string | null;
    branch?: { name: string; code: string } | null;
  };
}

interface Summary { matched: number; minorMismatch: number; majorMismatch: number; notFound: number; flagged: number; approved: number; }
interface Branch { id: number; name: string; code: string; }

const STATUS_MAP: Record<string, { label: string; className: string; icon: string }> = {
  matched:        { label: 'Khớp',        className: 'ds-b-ok',   icon: '✅' },
  mismatch_minor: { label: 'Chênh nhỏ',   className: 'ds-b-warn', icon: '⚠️' },
  mismatch_major: { label: 'Chênh lớn',   className: 'ds-b-err',  icon: '❌' },
  not_found:      { label: 'Mới',         className: 'ds-b-info', icon: '🔵' },
  flagged:        { label: 'Đã đánh dấu', className: 'ds-b-ai',   icon: '🚩' },
  approved:       { label: 'Đã duyệt',    className: 'ds-b-ok',   icon: '✔️' },
};

const FLAG_REASONS = [
  'Sai số lượng dịch vụ',
  'Ngày khớp không đúng',
  'Sai tỷ giá áp dụng',
  'Chứng từ trùng lặp',
  'Thiếu chứng từ đối ứng',
  'Lý do khác',
];

export const ReconcilePage: React.FC = () => {
  const [items, setItems]           = useState<ReconcileItem[]>([]);
  const [summary, setSummary]       = useState<Summary>({ matched: 0, minorMismatch: 0, majorMismatch: 0, notFound: 0, flagged: 0, approved: 0 });
  const [branches, setBranches]     = useState<Branch[]>([]);
  const [loading, setLoading]       = useState(true);
  const [total, setTotal]           = useState(0);
  const [page, setPage]             = useState(1);
  const PAGE_SIZE = 20;

  // Filters
  const [fBranch, setFBranch]   = useState('');
  const [fStatus, setFStatus]   = useState('');
  const [fPeriod, setFPeriod]   = useState('');
  const [fSearch, setFSearch]   = useState('');

  // Selected rows
  const [selected, setSelected] = useState<Set<number>>(new Set());

  // Flag modal
  const [flagId, setFlagId]         = useState<number | null>(null);
  const [flagReason, setFlagReason] = useState(FLAG_REASONS[0]);
  const [flagNote, setFlagNote]     = useState('');
  const [flagging, setFlagging]     = useState(false);

  // Toast
  const [toast, setToast]   = useState('');
  const [toastOk, setToastOk] = useState(true);

  const showToast = (msg: string, ok = true) => { setToast(msg); setToastOk(ok); setTimeout(() => setToast(''), 3000); };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
      if (fBranch) params.set('branchId', fBranch);
      if (fStatus) params.set('status', fStatus);
      if (fPeriod) params.set('period', fPeriod);
      if (fSearch) params.set('search', fSearch);

      const [listRes, sumRes, brRes] = await Promise.all([
        fetch(`/api/reconcile?${params}`, { headers: { Authorization: `Bearer ${token()}` } }),
        fetch('/api/reconcile/summary', { headers: { Authorization: `Bearer ${token()}` } }),
        fetch('/api/branches', { headers: { Authorization: `Bearer ${token()}` } }),
      ]);

      if (listRes.ok) { const d = await listRes.json(); setItems(d.items ?? []); setTotal(d.total ?? 0); }
      if (sumRes.ok)  { const d = await sumRes.json(); setSummary(d); }
      if (brRes.ok)   { const d = await brRes.json(); setBranches(d ?? []); }
    } catch {}
    setLoading(false);
  }, [page, fBranch, fStatus, fPeriod, fSearch]);

  useEffect(() => { load(); }, [load]);

  const toggleSelect = (id: number) => {
    setSelected(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });
  };
  const toggleAll = () => {
    if (selected.size === items.length) setSelected(new Set());
    else setSelected(new Set(items.map(i => i.id)));
  };

  const approveOne = async (id: number) => {
    const res = await fetch(`/api/reconcile/${id}/approve`, { method: 'POST', headers: { Authorization: `Bearer ${token()}` } });
    if (res.ok) { showToast('Đã duyệt ✔️'); load(); }
    else showToast('Lỗi khi duyệt', false);
  };

  const approveSelected = async () => {
    if (selected.size === 0) return;
    await Promise.all([...selected].map(id =>
      fetch(`/api/reconcile/${id}/approve`, { method: 'POST', headers: { Authorization: `Bearer ${token()}` } })
    ));
    showToast(`Đã duyệt ${selected.size} bản ghi ✔️`);
    setSelected(new Set());
    load();
  };

  const submitFlag = async () => {
    if (!flagId) return;
    setFlagging(true);
    const res = await fetch(`/api/reconcile/${flagId}/flag`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: flagReason, note: flagNote }),
    });
    setFlagging(false);
    if (res.ok) { showToast('Đã đánh dấu 🚩'); setFlagId(null); setFlagNote(''); load(); }
    else showToast('Lỗi khi đánh dấu', false);
  };

  const fmtAmt = (v: number | null) => v == null ? '—' : `¥${v.toLocaleString('ja-JP', { minimumFractionDigits: 0 })}`;
  const fmtDiff = (d: number) => {
    if (d === 0) return <span className="ds-c-ok ds-mono">0</span>;
    const s = `${d > 0 ? '+' : ''}${d.toLocaleString('ja-JP')}`;
    return <span className={`ds-mono ${d > 0 ? 'ds-c-warn' : 'ds-c-err'}`}>{s}</span>;
  };
  const confClass = (c: number) => c >= 95 ? 'ds-ch-h' : c >= 70 ? 'ds-ch-m' : 'ds-ch-l';

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div>
      {/* Header */}
      <div className="flex items-end justify-between mb-4 gap-3">
        <div>
          <div className="text-[19px] font-extrabold" style={{ color: 'var(--t1)' }}>🔍 Đối soát Chi tiết</div>
          <div className="text-[12.5px] mt-1" style={{ color: 'var(--t2)' }}>
            So sánh OCR vs GAS — phát hiện chênh lệch tự động
          </div>
        </div>
        <div className="flex gap-2 items-center flex-shrink-0">
          {selected.size > 0 && (
            <button className="ds-btn ds-btn-ok ds-btn-sm" onClick={approveSelected}>
              ✔️ Duyệt {selected.size} mục
            </button>
          )}
          <span className="ds-ai-pill"><span className="ds-ai-dot"></span>AI Active</span>
        </div>
      </div>

      {/* Summary chips */}
      <div className="flex gap-2 flex-wrap mb-4">
        {[
          { label: `✅ Khớp`,       val: summary.matched,       cls: 'ds-b-ok',   filter: 'matched' },
          { label: `⚠️ Chênh nhỏ`, val: summary.minorMismatch, cls: 'ds-b-warn', filter: 'mismatch_minor' },
          { label: `❌ Chênh lớn`, val: summary.majorMismatch, cls: 'ds-b-err',  filter: 'mismatch_major' },
          { label: `🔵 Mới`,       val: summary.notFound,      cls: 'ds-b-info', filter: 'not_found' },
          { label: `🚩 Đã Flag`,   val: summary.flagged,       cls: 'ds-b-ai',   filter: 'flagged' },
          { label: `✔️ Đã duyệt`,  val: summary.approved,      cls: 'ds-b-gray', filter: 'approved' },
        ].map(c => (
          <button key={c.filter}
            className={`ds-badge ${c.cls} cursor-pointer text-[11.5px] py-1 px-3 ${fStatus === c.filter ? 'ring-2 ring-offset-1' : ''}`}
            style={{ ringColor: 'var(--fox)' }}
            onClick={() => { setFStatus(fStatus === c.filter ? '' : c.filter); setPage(1); }}>
            {c.label} <span className="font-extrabold ml-1">{c.val}</span>
          </button>
        ))}
      </div>

      {/* Main card */}
      <div className="ds-card overflow-hidden">
        {/* Filter bar */}
        <div className="ds-fbar">
          <select className="ds-fsel" value={fBranch} onChange={e => { setFBranch(e.target.value); setPage(1); }}>
            <option value="">Tất cả chi nhánh</option>
            {branches.map(b => <option key={b.id} value={b.id}>{b.code} — {b.name}</option>)}
          </select>
          <select className="ds-fsel" value={fStatus} onChange={e => { setFStatus(e.target.value); setPage(1); }}>
            <option value="">Tất cả trạng thái</option>
            <option value="matched">✅ Khớp</option>
            <option value="mismatch_minor">⚠️ Chênh nhỏ</option>
            <option value="mismatch_major">❌ Chênh lớn</option>
            <option value="not_found">🔵 Mới</option>
            <option value="flagged">🚩 Đã Flag</option>
            <option value="approved">✔️ Đã duyệt</option>
          </select>
          <input className="ds-finp" placeholder="Kỳ (YYYY-MM)" value={fPeriod}
            onChange={e => { setFPeriod(e.target.value); setPage(1); }} style={{ width: 120 }} />
          <input className="ds-finp flex-1" placeholder="🔍 Tìm số chứng từ, tên file..."
            value={fSearch} onChange={e => { setFSearch(e.target.value); setPage(1); }} style={{ minWidth: 160 }} />
          <button className="ds-btn ds-btn-g ds-btn-sm" onClick={() => { setFBranch(''); setFStatus(''); setFPeriod(''); setFSearch(''); setPage(1); }}>
            Xoá lọc
          </button>
        </div>

        {/* Table */}
        <div style={{ overflowX: 'auto' }}>
          <table className="ds-dt">
            <thead>
              <tr>
                <th style={{ width: 36 }}>
                  <input type="checkbox" checked={selected.size === items.length && items.length > 0}
                    onChange={toggleAll} style={{ cursor: 'pointer' }} />
                </th>
                <th>Chứng từ / File</th>
                <th>Chi nhánh</th>
                <th>Dịch vụ</th>
                <th>Kỳ</th>
                <th style={{ textAlign: 'right' }}>OCR Amount</th>
                <th style={{ textAlign: 'right' }}>GAS Amount</th>
                <th style={{ textAlign: 'right' }}>Δ</th>
                <th style={{ textAlign: 'center' }}>AI Conf.</th>
                <th>Trạng thái</th>
                <th style={{ textAlign: 'center' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={11} style={{ textAlign: 'center', padding: 32, color: 'var(--t3)' }}>Đang tải...</td></tr>
              ) : items.length === 0 ? (
                <tr><td colSpan={11} style={{ textAlign: 'center', padding: 32, color: 'var(--t3)' }}>
                  Không có dữ liệu đối soát
                </td></tr>
              ) : items.map(item => {
                const st = STATUS_MAP[item.status] ?? STATUS_MAP['not_found'];
                const rowCls = item.status === 'matched' || item.status === 'approved' ? 'ds-row-ok'
                             : item.status === 'mismatch_minor' ? 'ds-row-warn'
                             : item.status === 'mismatch_major' || item.status === 'flagged' ? 'ds-row-err'
                             : '';
                return (
                  <tr key={item.id} className={rowCls}>
                    <td><input type="checkbox" checked={selected.has(item.id)} onChange={() => toggleSelect(item.id)} /></td>
                    <td>
                      <div className="ds-mono text-[11.5px]">{item.document.fileName.replace(/\.[^/.]+$/, '').substring(0, 24)}</div>
                      {item.gasRef && <div style={{ fontSize: 10.5, color: 'var(--t3)' }}>GAS: {item.gasRef}</div>}
                    </td>
                    <td>
                      {item.document.branch
                        ? <span className="ds-badge ds-b-gray">{item.document.branch.code}</span>
                        : <span style={{ color: 'var(--t3)' }}>—</span>}
                    </td>
                    <td>
                      {item.document.docType
                        ? <span className={`ds-tag ${
                            item.document.docType === 'ground_handling' ? 'ds-t-grd'
                          : item.document.docType === 'airport_charges' ? 'ds-t-apt'
                          : item.document.docType === 'catering'        ? 'ds-t-ctr'
                          : 'ds-t-fuel'}`}>
                            {item.document.docType === 'ground_handling' ? 'Ground Hdl'
                           : item.document.docType === 'airport_charges' ? 'Airport Chrg'
                           : item.document.docType === 'catering'        ? 'Catering'
                           : 'Fuel'}
                          </span>
                        : '—'}
                    </td>
                    <td style={{ color: 'var(--t2)', fontSize: 11.5 }}>{item.document.period ?? '—'}</td>
                    <td style={{ textAlign: 'right' }}>
                      <span className="ds-amt">{fmtAmt(item.ocrAmount)}</span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <span className="ds-amt">{fmtAmt(item.gasAmount)}</span>
                    </td>
                    <td style={{ textAlign: 'right' }}>{fmtDiff(item.difference)}</td>
                    <td style={{ textAlign: 'center' }}>
                      <div className="flex items-center justify-center gap-1">
                        <span className={`ds-cbar ${confClass(item.aiConfidence)}`}></span>
                        <span className="ds-mono text-[11px]">{item.aiConfidence.toFixed(0)}%</span>
                      </div>
                    </td>
                    <td>
                      <span className={`ds-badge ${st.className}`}>{st.icon} {st.label}</span>
                    </td>
                    <td>
                      <div className="flex gap-1 justify-center">
                        {item.status !== 'approved' && (
                          <button className="ds-btn ds-btn-ok ds-btn-xs" onClick={() => approveOne(item.id)} title="Duyệt">✔</button>
                        )}
                        {item.status !== 'flagged' && item.status !== 'approved' && (
                          <button className="ds-btn ds-btn-g ds-btn-xs" onClick={() => setFlagId(item.id)} title="Flag">🚩</button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between px-4 py-3 border-t" style={{ borderColor: 'var(--border)' }}>
          <span style={{ fontSize: 11.5, color: 'var(--t3)' }}>
            Hiển thị {Math.min((page-1)*PAGE_SIZE+1, total)}–{Math.min(page*PAGE_SIZE, total)} / {total} bản ghi
          </span>
          <div className="flex gap-1.5">
            <button className="ds-btn ds-btn-g ds-btn-sm" disabled={page <= 1} onClick={() => setPage(p => p-1)}>← Trước</button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const p = Math.max(1, Math.min(page - 2, totalPages - 4)) + i;
              return (
                <button key={p} className={`ds-btn ds-btn-sm ${page === p ? 'ds-btn-p' : 'ds-btn-g'}`} onClick={() => setPage(p)}>{p}</button>
              );
            })}
            <button className="ds-btn ds-btn-g ds-btn-sm" disabled={page >= totalPages} onClick={() => setPage(p => p+1)}>Sau →</button>
          </div>
        </div>
      </div>

      {/* Flag Modal */}
      {flagId !== null && (
        <div className="ds-modal-overlay open" onClick={e => { if (e.target === e.currentTarget) setFlagId(null); }}>
          <div className="ds-modal">
            <div className="ds-modal-hdr">
              <span className="ds-modal-title">🚩 Đánh dấu chênh lệch</span>
              <button className="ds-btn ds-btn-g ds-btn-sm" onClick={() => setFlagId(null)}>✕</button>
            </div>
            <div className="ds-modal-body">
              <div className="ds-fgrp">
                <label className="ds-flbl">Lý do</label>
                <select className="ds-sel" value={flagReason} onChange={e => setFlagReason(e.target.value)}>
                  {FLAG_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div className="ds-fgrp">
                <label className="ds-flbl">Ghi chú thêm</label>
                <textarea className="ds-txa" rows={3} placeholder="Mô tả chi tiết sự chênh lệch..."
                  value={flagNote} onChange={e => setFlagNote(e.target.value)} />
              </div>
            </div>
            <div className="ds-modal-footer">
              <button className="ds-btn ds-btn-g ds-btn-sm" onClick={() => setFlagId(null)}>Huỷ</button>
              <button className="ds-btn ds-btn-p ds-btn-sm" onClick={submitFlag} disabled={flagging}>
                {flagging ? 'Đang lưu...' : '🚩 Xác nhận Flag'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="ds-toast" style={{ background: toastOk ? 'var(--ok)' : 'var(--err)' }}>
          {toast}
        </div>
      )}
    </div>
  );
};
