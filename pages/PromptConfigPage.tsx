import React, { useEffect, useState, useCallback } from 'react';

const token = () => localStorage.getItem('auth_token') ?? '';

interface PromptItem {
  id: number;
  branchId: number;
  docType: string;
  name: string;
  promptText: string;
  testScore: number | null;
  testTotal: number | null;
  testCorrect: number | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  branch?: { code: string; name: string } | null;
}
interface Branch  { id: number; name: string; code: string; }
interface DocType  { id: number; code: string; name: string; icon: string; color: string; bgColor: string; isActive: boolean; }

const DEFAULT_PROMPT = (dtName: string) =>
`Bạn là AI chuyên đọc chứng từ ${dtName} hàng không.
Trích xuất từ file đính kèm:
- invoice_number: Số hóa đơn
- date: Ngày phát hành (YYYY-MM-DD)
- vendor: Tên nhà cung cấp
- amount: Tổng phí (số thuần, không đơn vị)
- currency: JPY hoặc USD
- service_period: Kỳ dịch vụ (YYYY-MM)
Trả về JSON.`;

const scoreColor = (s: number | null) => !s ? 'var(--t3)' : s >= 90 ? 'var(--ok)' : s >= 70 ? 'var(--warn)' : 'var(--err)';

export const PromptConfigPage: React.FC = () => {
  const [prompts, setPrompts]       = useState<PromptItem[]>([]);
  const [branches, setBranches]     = useState<Branch[]>([]);
  const [docTypes, setDocTypes]     = useState<DocType[]>([]);
  const [loading, setLoading]       = useState(true);
  const [selBranch, setSelBranch]   = useState<Branch | null>(null);
  const [selDocType, setSelDocType] = useState('');

  const [editing, setEditing]       = useState<Partial<PromptItem> | null>(null);
  const [editId, setEditId]         = useState<number | null>(null);
  const [saving, setSaving]         = useState(false);

  const [toast, setToast]     = useState('');
  const [toastOk, setToastOk] = useState(true);
  const showToast = (msg: string, ok = true) => { setToast(msg); setToastOk(ok); setTimeout(() => setToast(''), 3000); };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [pRes, bRes, dtRes] = await Promise.all([
        fetch('/api/prompts',         { headers: { Authorization: `Bearer ${token()}` } }),
        fetch('/api/admin/branches',  { headers: { Authorization: `Bearer ${token()}` } }),
        fetch('/api/doc-types',       { headers: { Authorization: `Bearer ${token()}` } }),
      ]);
      if (pRes.ok)  { const d = await pRes.json();  setPrompts(d ?? []); }
      if (bRes.ok)  { const d = await bRes.json();  setBranches(d ?? []); if ((d ?? []).length > 0 && !selBranch) setSelBranch(d[0]); }
      if (dtRes.ok) {
        const d: DocType[] = await dtRes.json();
        setDocTypes(d ?? []);
        if (d.length > 0 && !selDocType) setSelDocType(d[0].code);
      }
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const currentPrompt = prompts.find(p => p.branchId === selBranch?.id && p.docType === selDocType) ?? null;
  const docMeta = docTypes.find(d => d.code === selDocType);

  const openEdit = (p: PromptItem | null, dtCode: string) => {
    const dt = docTypes.find(d => d.code === dtCode);
    setSelDocType(dtCode);
    if (p) {
      setEditId(p.id);
      setEditing({ ...p });
    } else {
      setEditId(null);
      setEditing({
        branchId: selBranch?.id,
        docType:  dtCode,
        name:     `${selBranch?.code ?? ''} ${dt?.name ?? dtCode}`,
        promptText: DEFAULT_PROMPT(dt?.name ?? dtCode),
        isActive: true,
      });
    }
  };

  // Auto-select prompt when branch/docType changes
  useEffect(() => {
    if (!selBranch || !selDocType) return;
    const p = prompts.find(pp => pp.branchId === selBranch.id && pp.docType === selDocType);
    const dt = docTypes.find(d => d.code === selDocType);
    if (p) {
      setEditId(p.id);
      setEditing({ ...p });
    } else {
      setEditId(null);
      setEditing({
        branchId:   selBranch.id,
        docType:    selDocType,
        name:       `${selBranch.code} ${dt?.name ?? selDocType}`,
        promptText: DEFAULT_PROMPT(dt?.name ?? selDocType),
        isActive:   true,
      });
    }
  }, [selBranch, selDocType, prompts, docTypes]);

  const savePrompt = async () => {
    if (!editing || !selBranch) return;
    setSaving(true);
    let res: Response;
    if (editId) {
      res = await fetch(`/api/prompts/${editId}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editing.name, promptText: editing.promptText, isActive: editing.isActive }),
      });
    } else {
      res = await fetch('/api/prompts', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ branchId: selBranch.id, docType: selDocType, name: editing.name, promptText: editing.promptText }),
      });
    }
    setSaving(false);
    if (res.ok) {
      showToast(`Đã lưu: ${selBranch.code} / ${docMeta?.name ?? selDocType} ✔️`);
      load();
    } else {
      const err = await res.json().catch(() => ({}));
      showToast((err as any)?.error ?? 'Lỗi khi lưu', false);
    }
  };

  const deletePrompt = async () => {
    if (!editId || !confirm('Xoá prompt này?')) return;
    const res = await fetch(`/api/prompts/${editId}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token()}` } });
    if (res.ok) { showToast('Đã xoá prompt'); load(); }
    else showToast('Lỗi khi xoá', false);
  };

  const configuredCount = (b: Branch) =>
    docTypes.filter(d => prompts.some(p => p.branchId === b.id && p.docType === d.code)).length;

  return (
    <div>
      {/* Header */}
      <div className="flex items-end justify-between mb-4 gap-3">
        <div>
          <div className="text-[19px] font-extrabold" style={{ color: 'var(--t1)' }}>🤖 Cấu hình Prompt AI</div>
          <div className="text-[12.5px] mt-1" style={{ color: 'var(--t2)' }}>
            Prompt OCR riêng cho từng Chi nhánh × Loại chứng từ
          </div>
        </div>
        <a href="/admin/input-config" className="ds-btn ds-btn-s ds-btn-sm">⚙️ Quản lý loại chứng từ</a>
      </div>

      <div className="flex gap-3" style={{ alignItems: 'flex-start' }}>

        {/* ── Left: Branch list ── */}
        <div style={{ width: 200, flexShrink: 0 }}>
          <div className="ds-sec-label">Chi nhánh</div>
          {loading ? (
            <div className="ds-card" style={{ padding: 16, textAlign: 'center', color: 'var(--t3)', fontSize: 12 }}>Đang tải...</div>
          ) : branches.length === 0 ? (
            <div className="ds-card" style={{ padding: 16, textAlign: 'center', color: 'var(--t3)', fontSize: 12 }}>Chưa có chi nhánh</div>
          ) : branches.map(b => {
            const cnt    = configuredCount(b);
            const total  = docTypes.length;
            const active = selBranch?.id === b.id;
            return (
              <div key={b.id} onClick={() => setSelBranch(b)} className="ds-card"
                style={{ marginBottom: 6, cursor: 'pointer', padding: '10px 12px',
                  border: active ? '2px solid var(--fox)' : '1px solid var(--border)',
                  background: active ? 'var(--fox-lt)' : 'var(--surface)' }}>
                <div className="flex items-center justify-between">
                  <span style={{ fontWeight: 700, fontSize: 13, color: active ? 'var(--fox)' : 'var(--t1)' }}>{b.code}</span>
                  <span className={`ds-badge ${cnt === total && total > 0 ? 'ds-b-ok' : cnt > 0 ? 'ds-b-warn' : 'ds-b-gray'}`} style={{ fontSize: 9.5 }}>
                    {cnt}/{total}
                  </span>
                </div>
                <div style={{ fontSize: 11, color: 'var(--t2)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {b.name}
                </div>
                {/* Mini dot status per docType */}
                <div className="flex gap-1 mt-2 flex-wrap">
                  {docTypes.map(d => {
                    const p = prompts.find(pp => pp.branchId === b.id && pp.docType === d.code);
                    return (
                      <div key={d.code} title={`${d.name}: ${p ? (p.testScore ? `${p.testScore.toFixed(0)}%` : '✓') : '—'}`}
                        style={{ width: 8, height: 8, borderRadius: 2, background: p ? (p.isActive ? d.color : 'var(--t3)') : 'var(--border)' }} />
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* ── Right: DocType cards + Editor ── */}
        <div className="flex-1 min-w-0">
          {!selBranch ? (
            <div className="ds-card" style={{ padding: 48, textAlign: 'center', color: 'var(--t3)' }}>
              ← Chọn chi nhánh để cấu hình prompt
            </div>
          ) : loading ? (
            <div className="ds-card" style={{ padding: 48, textAlign: 'center', color: 'var(--t3)' }}>Đang tải...</div>
          ) : (
            <>
              {/* Branch header */}
              <div className="ds-card mb-3" style={{ padding: '10px 14px', background: 'var(--fox-lt)', border: '1px solid rgba(255,122,0,.2)' }}>
                <div style={{ fontWeight: 800, fontSize: 14, color: 'var(--fox)' }}>{selBranch.code} — {selBranch.name}</div>
                <div style={{ fontSize: 11, color: 'var(--t2)', marginTop: 2 }}>
                  {configuredCount(selBranch)}/{docTypes.length} loại chứng từ đã có prompt
                </div>
              </div>

              {/* DocType cards — dynamic */}
              {docTypes.length === 0 ? (
                <div className="ds-card mb-3" style={{ padding: 24, textAlign: 'center', color: 'var(--t3)', fontSize: 12 }}>
                  Chưa có loại chứng từ. <a href="/admin/input-config" style={{ color: 'var(--fox)' }}>Thêm loại chứng từ →</a>
                </div>
              ) : (
                <div className="mb-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 8 }}>
                  {docTypes.map(d => {
                    const p = prompts.find(pp => pp.branchId === selBranch.id && pp.docType === d.code);
                    const active = selDocType === d.code;
                    return (
                      <div key={d.code} onClick={() => openEdit(p ?? null, d.code)}
                        style={{
                          borderRadius: 10, padding: '10px 12px', cursor: 'pointer',
                          background: active ? d.color : d.bgColor,
                          border: active ? `2px solid ${d.color}` : `1px solid ${d.color}30`,
                          transition: 'all .15s',
                        }}>
                        <div style={{ fontSize: 20, marginBottom: 5 }}>{d.icon}</div>
                        <div style={{ fontWeight: 700, fontSize: 11.5, color: active ? '#fff' : d.color, lineHeight: 1.3 }}>{d.name}</div>
                        {p ? (
                          <div style={{ marginTop: 4 }}>
                            <div style={{ fontSize: 10, color: active ? 'rgba(255,255,255,.8)' : d.color, fontWeight: 600 }}>
                              {p.testScore != null ? `${p.testScore.toFixed(0)}% accuracy` : '✓ Đã cấu hình'}
                            </div>
                            <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 3, background: active ? 'rgba(255,255,255,.25)' : 'white', color: d.color, fontWeight: 700 }}>
                              {p.isActive ? 'Active' : 'Off'}
                            </span>
                          </div>
                        ) : (
                          <div style={{ marginTop: 4, fontSize: 10, color: active ? 'rgba(255,255,255,.7)' : 'var(--t3)' }}>
                            Chưa cấu hình
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Prompt editor */}
              {editing && docMeta && (
                <div className="ds-card">
                  <div className="ds-ch">
                    <div className="ds-ch-title">
                      <div className="ds-ch-ic" style={{ background: docMeta.bgColor }}>{docMeta.icon}</div>
                      <span style={{ color: docMeta.color, fontWeight: 700 }}>{docMeta.name}</span>
                      <span className="ds-badge ds-b-gray">{selBranch.code}</span>
                      {currentPrompt && (
                        <span className={`ds-badge ${currentPrompt.isActive ? 'ds-b-ok' : 'ds-b-gray'}`}>
                          {currentPrompt.isActive ? 'Active' : 'Off'}
                        </span>
                      )}
                    </div>
                    <div className="flex gap-1.5">
                      {editId && (
                        <button className="ds-btn ds-btn-d ds-btn-xs" onClick={deletePrompt}>🗑️ Xoá</button>
                      )}
                      <button className="ds-btn ds-btn-p ds-btn-sm" onClick={savePrompt} disabled={saving}>
                        {saving ? 'Đang lưu...' : editId ? '💾 Cập nhật' : '+ Tạo mới'}
                      </button>
                    </div>
                  </div>
                  <div className="ds-cb">
                    <div className="flex gap-3 mb-3 items-end">
                      <div className="flex-1">
                        <label className="ds-flbl">Tên Prompt</label>
                        <input className="ds-inp" value={editing.name ?? ''}
                          onChange={e => setEditing(prev => ({ ...prev!, name: e.target.value }))} />
                      </div>
                      <div>
                        <label className="ds-flbl">Kích hoạt</label>
                        <div style={{ paddingTop: 2 }}>
                          <label className="ds-toggle">
                            <input type="checkbox" checked={editing.isActive ?? true}
                              onChange={e => setEditing(prev => ({ ...prev!, isActive: e.target.checked }))} />
                            <span className="ds-tslider"></span>
                          </label>
                        </div>
                      </div>
                    </div>
                    <div className="ds-fgrp">
                      <label className="ds-flbl">Prompt Text</label>
                      <textarea className="ds-pe" style={{ minHeight: 260 }}
                        value={editing.promptText ?? ''}
                        onChange={e => setEditing(prev => ({ ...prev!, promptText: e.target.value }))}
                        spellCheck={false} />
                      <div className="ds-fhint">
                        ~{Math.ceil((editing.promptText?.length ?? 0) / 4).toLocaleString()} tokens ·
                        Biến: <code style={{ fontSize: 10 }}>{'{{filename}}'}</code> <code style={{ fontSize: 10 }}>{'{{branch}}'}</code> <code style={{ fontSize: 10 }}>{'{{period}}'}</code>
                      </div>
                    </div>
                    {editing.testScore != null && (
                      <div className="grid grid-cols-3 gap-3" style={{ marginTop: 10 }}>
                        {[
                          { label: 'Độ chính xác', val: `${editing.testScore.toFixed(1)}%`, color: scoreColor(editing.testScore) },
                          { label: 'Mẫu test',     val: editing.testTotal ?? 0,             color: 'var(--t1)' },
                          { label: 'Đúng',          val: editing.testCorrect ?? 0,           color: 'var(--ok)' },
                        ].map(s => (
                          <div key={s.label} className="ds-card" style={{ padding: '10px 14px', background: 'var(--surface-2)' }}>
                            <div style={{ fontSize: 10, color: 'var(--t3)', marginBottom: 4 }}>{s.label}</div>
                            <div className="ds-mono" style={{ fontSize: 20, fontWeight: 800, color: s.color }}>{s.val}</div>
                          </div>
                        ))}
                      </div>
                    )}
                    {editing.updatedAt && (
                      <div style={{ marginTop: 10, fontSize: 11, color: 'var(--t3)' }}>
                        Cập nhật: {new Date(editing.updatedAt).toLocaleString('vi-VN')}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {toast && <div className="ds-toast" style={{ background: toastOk ? 'var(--ok)' : 'var(--err)' }}>{toast}</div>}
    </div>
  );
};
