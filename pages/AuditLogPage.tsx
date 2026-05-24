import React, { useEffect, useState, useCallback } from 'react';

const token = () => localStorage.getItem('auth_token') ?? '';

interface LogItem {
  id: number;
  action: string;
  userId: number | null;
  branchId: number | null;
  detail: string;
  metadata: string | null;
  ipAddress: string | null;
  createdAt: string;
  user?: { name: string; email: string } | null;
  branch?: { code: string; name: string } | null;
}

const ACTION_MAP: Record<string, { icon: string; cls: string; label: string }> = {
  FILE_UPLOADED:       { icon: '📤', cls: 'ds-ai-push', label: 'Upload File' },
  OCR_COMPLETED:       { icon: '🔍', cls: 'ds-ai-ocr',  label: 'OCR Hoàn thành' },
  BATCH_APPROVED:      { icon: '✅', cls: 'ds-ai-ok',   label: 'Duyệt hàng loạt' },
  MISMATCH_DETECTED:   { icon: '⚠️', cls: 'ds-ai-warn', label: 'Phát hiện chênh lệch' },
  MISMATCH_FLAGGED:    { icon: '🚩', cls: 'ds-ai-err',  label: 'Flag chênh lệch' },
  GAS_PUSH_SUCCESS:    { icon: '📨', cls: 'ds-ai-push', label: 'Đẩy lên GAS' },
  USER_LOGIN:          { icon: '🔐', cls: 'ds-ai-ocr',  label: 'Đăng nhập' },
  PROMPT_UPDATED:      { icon: '⚙️', cls: 'ds-ai-ocr',  label: 'Cập nhật Prompt' },
  RECONCILE_APPROVED:  { icon: '✔️', cls: 'ds-ai-ok',   label: 'Duyệt đối soát' },
  RECONCILE_FLAGGED:   { icon: '🚨', cls: 'ds-ai-err',  label: 'Flag đối soát' },
};

const ACTIONS = Object.keys(ACTION_MAP);

export const AuditLogPage: React.FC = () => {
  const [items, setItems]     = useState<LogItem[]>([]);
  const [total, setTotal]     = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage]       = useState(1);
  const PAGE_SIZE = 30;

  const [fAction, setFAction]   = useState('');
  const [fBranch, setFBranch]   = useState('');
  const [fDate, setFDate]       = useState('');
  const [fSearch, setFSearch]   = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
      if (fAction) params.set('action', fAction);
      if (fBranch) params.set('branchId', fBranch);
      if (fDate)   params.set('date', fDate);
      if (fSearch) params.set('search', fSearch);

      const res = await fetch(`/api/audit-log?${params}`, { headers: { Authorization: `Bearer ${token()}` } });
      if (res.ok) {
        const d = await res.json();
        setItems(d.items ?? []);
        setTotal(d.total ?? 0);
      }
    } catch {}
    setLoading(false);
  }, [page, fAction, fBranch, fDate, fSearch]);

  useEffect(() => { load(); }, [load]);

  const fmtTime = (dt: string) => {
    const d = new Date(dt);
    return d.toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const exportCSV = () => {
    const header = 'Thời gian,Hành động,Chi tiết,IP,Người dùng\n';
    const csv = items.map(i =>
      `"${fmtTime(i.createdAt)}","${i.action}","${i.detail.replace(/"/g, '""')}","${i.ipAddress ?? ''}","${i.user?.email ?? ''}"`
    ).join('\n');
    const blob = new Blob(['﻿' + header + csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a'); a.href = url;
    a.download = `AuditLog_${new Date().toISOString().slice(0,10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div>
      {/* Header */}
      <div className="flex items-end justify-between mb-4 gap-3">
        <div>
          <div className="text-[19px] font-extrabold" style={{ color: 'var(--t1)' }}>📜 Nhật ký Truy cập</div>
          <div className="text-[12.5px] mt-1" style={{ color: 'var(--t2)' }}>
            Ghi lại toàn bộ hành động trong hệ thống
          </div>
        </div>
        <button className="ds-btn ds-btn-s ds-btn-sm" onClick={exportCSV}>📥 Xuất CSV</button>
      </div>

      <div className="ds-card overflow-hidden">
        {/* Filter bar */}
        <div className="ds-fbar">
          <select className="ds-fsel" value={fAction} onChange={e => { setFAction(e.target.value); setPage(1); }}>
            <option value="">Tất cả hành động</option>
            {ACTIONS.map(a => (
              <option key={a} value={a}>{ACTION_MAP[a].icon} {ACTION_MAP[a].label}</option>
            ))}
          </select>
          <input type="date" className="ds-finp" value={fDate}
            onChange={e => { setFDate(e.target.value); setPage(1); }} />
          <input className="ds-finp flex-1" placeholder="🔍 Tìm trong nhật ký..."
            value={fSearch} onChange={e => { setFSearch(e.target.value); setPage(1); }} style={{ minWidth: 180 }} />
          <button className="ds-btn ds-btn-g ds-btn-sm" onClick={() => { setFAction(''); setFBranch(''); setFDate(''); setFSearch(''); setPage(1); }}>
            Xoá lọc
          </button>
        </div>

        {/* Stats row */}
        <div className="flex gap-3 px-4 py-2.5 border-b" style={{ borderColor: 'var(--border)', background: 'var(--surface-2)' }}>
          <span style={{ fontSize: 11.5, color: 'var(--t2)' }}>
            Tổng <strong style={{ color: 'var(--t1)' }}>{total.toLocaleString()}</strong> bản ghi
          </span>
          {[
            { a: 'OCR_COMPLETED', color: 'var(--info)' },
            { a: 'MISMATCH_DETECTED', color: 'var(--warn)' },
            { a: 'BATCH_APPROVED', color: 'var(--ok)' },
          ].map(({ a, color }) => {
            const cnt = items.filter(i => i.action === a).length;
            if (!cnt) return null;
            const m = ACTION_MAP[a];
            return (
              <span key={a} style={{ fontSize: 11, color }}>
                {m.icon} {m.label}: {cnt}
              </span>
            );
          })}
        </div>

        {/* Log list */}
        <div className="p-3">
          {loading ? (
            <div style={{ textAlign: 'center', padding: 48, color: 'var(--t3)', fontSize: 13 }}>Đang tải nhật ký...</div>
          ) : items.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 48, color: 'var(--t3)', fontSize: 13 }}>
              📭 Không có nhật ký phù hợp
            </div>
          ) : items.map(item => {
            const m = ACTION_MAP[item.action] ?? { icon: '📋', cls: 'ds-ai-ocr', label: item.action };
            return (
              <div key={item.id} className="ds-log-item">
                <div className={`ds-log-ic ${m.cls}`}>{m.icon}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="ds-log-action">{m.label}</span>
                    {item.branch && (
                      <span className="ds-badge ds-b-gray" style={{ fontSize: 10 }}>{item.branch.code}</span>
                    )}
                    {item.user && (
                      <span style={{ fontSize: 11, color: 'var(--t2)' }}>
                        👤 {item.user.name || item.user.email}
                      </span>
                    )}
                  </div>
                  <div className="ds-log-detail truncate" style={{ maxWidth: '100%' }}>{item.detail}</div>
                  {item.ipAddress && (
                    <div style={{ fontSize: 10.5, color: 'var(--t3)', marginTop: 2, fontFamily: 'JetBrains Mono, monospace' }}>
                      IP: {item.ipAddress}
                    </div>
                  )}
                </div>
                <div className="ds-log-time flex flex-col items-end gap-0.5">
                  <span>{new Date(item.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                  <span style={{ fontSize: 9.5 }}>{new Date(item.createdAt).toLocaleDateString('vi-VN')}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between px-4 py-3 border-t" style={{ borderColor: 'var(--border)' }}>
          <span style={{ fontSize: 11.5, color: 'var(--t3)' }}>
            Trang {page}/{totalPages} · {total.toLocaleString()} bản ghi
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
    </div>
  );
};
