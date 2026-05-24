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

interface Branch { id: number; name: string; code: string; }

const DOC_TYPES = [
  { value: 'ground_handling', label: 'Ground Handling', icon: '✈️', color: '#5B21B6', bg: '#EDE9FE', cls: 'ds-t-grd' },
  { value: 'airport_charges', label: 'Airport Charges',  icon: '🏢', color: '#1E40AF', bg: '#DBEAFE', cls: 'ds-t-apt' },
  { value: 'fuel',            label: 'Fuel',             icon: '⛽', color: '#92400E', bg: '#FEF3C7', cls: 'ds-t-fuel' },
  { value: 'catering',        label: 'Catering',         icon: '🍱', color: '#166534', bg: '#DCFCE7', cls: 'ds-t-ctr' },
];

const DEFAULT_PROMPTS: Record<string, string> = {
  ground_handling: `Bạn là AI chuyên đọc chứng từ Ground Handling hàng không.
Trích xuất từ file đính kèm:
- invoice_number: Số hóa đơn
- date: Ngày phát hành (YYYY-MM-DD)
- vendor: Tên đại lý Ground Handling
- flight_count: Số chuyến bay phục vụ
- amount: Tổng phí (số thuần, không đơn vị)
- currency: JPY hoặc USD
- service_period: Kỳ dịch vụ (YYYY-MM)
Trả về JSON.`,
  airport_charges: `Bạn là AI chuyên đọc chứng từ Airport Charges.
Trích xuất:
- invoice_number, date, vendor (tên sân bay), amount, currency, service_period
- charge_type: Landing/Parking/Navigation/Passenger
Trả về JSON.`,
  fuel: `Bạn là AI chuyên đọc hóa đơn nhiên liệu hàng không.
Trích xuất:
- invoice_number, date, vendor (nhà cung cấp xăng)
- fuel_volume: Khối lượng (lít hoặc kg)
- unit_price: Đơn giá
- amount: Thành tiền
- currency, service_period
Trả về JSON.`,
  catering: `Bạn là AI chuyên đọc hóa đơn Catering hàng không.
Trích xuất:
- invoice_number, date, vendor (công ty catering)
- flight_number: Số hiệu chuyến bay
- pax_count: Số hành khách phục vụ
- amount, currency, service_period
Trả về JSON.`,
};

const scoreColor = (s: number | null) => !s ? 'var(--t3)' : s >= 90 ? 'var(--ok)' : s >= 70 ? 'var(--warn)' : 'var(--err)';

export const PromptConfigPage: React.FC = () => {
  const [prompts, setPrompts]     = useState<PromptItem[]>([]);
  const [branches, setBranches]   = useState<Branch[]>([]);
  const [loading, setLoading]     = useState(true);
  const [selBranch, setSelBranch] = useState<Branch | null>(null);
  const [selDocType, setSelDocType] = useState(DOC_TYPES[0].value);

  // Editor state
  const [editing, setEditing]     = useState<Partial<PromptItem> | null>(null);
  const [editId, setEditId]       = useState<number | null>(null);
  const [saving, setSaving]       = useState(false);

  // Create modal
  const [showModal, setShowModal] = useState(false);
  const [newBranch, setNewBranch] = useState('');
  const [newDocType, setNewDocType] = useState('ground_handling');
  const [newName, setNewName]     = useState('');

  const [toast, setToast]     = useState('');
  const [toastOk, setToastOk] = useState(true);
  const showToast = (msg: string, ok = true) => { setToast(msg); setToastOk(ok); setTimeout(() => setToast(''), 3000); };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [pRes, bRes] = await Promise.all([
        fetch('/api/prompts', { headers: { Authorization: `Bearer ${token()}` } }),
        fetch('/api/admin/branches', { headers: { Authorization: `Bearer ${token()}` } }),
      ]);
      if (pRes.ok) { const d = await pRes.json(); setPrompts(d ?? []); }
      if (bRes.ok) {
        const d: Branch[] = await bRes.json();
        setBranches(d ?? []);
        if (d.length > 0) { setSelBranch(d[0]); setNewBranch(String(d[0].id)); }
      }
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Get prompt for selected branch × docType
  const currentPrompt = prompts.find(p => p.branchId === selBranch?.id && p.docType === selDocType) ?? null;

  const openEdit = (p: PromptItem | null, dt: string) => {
    setSelDocType(dt);
    if (p) { setEditId(p.id); setEditing({ ...p }); }
    else {
      setEditId(null);
      setEditing({
        branchId: selBranch?.id,
        docType: dt,
        name: `${selBranch?.code ?? ''} ${DOC_TYPES.find(d => d.value === dt)?.label ?? dt}`,
        promptText: DEFAULT_PROMPTS[dt] ?? '',
        isActive: true,
      });
    }
  };

  // When branch or docType changes, auto-select the matching prompt
  useEffect(() => {
    const p = prompts.find(p => p.branchId === selBranch?.id && p.docType === selDocType);
    if (p) { setEditId(p.id); setEditing({ ...p }); }
    else if (selBranch) {
      setEditId(null);
      setEditing({
        branchId: selBranch.id,
        docType: selDocType,
        name: `${selBranch.code} ${DOC_TYPES.find(d => d.value === selDocType)?.label ?? selDocType}`,
        promptText: DEFAULT_PROMPTS[selDocType] ?? '',
        isActive: true,
      });
    }
  }, [selBranch, selDocType, prompts]);

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
      showToast(`Đã lưu: ${selBranch.code} / ${DOC_TYPES.find(d => d.value === selDocType)?.label} ✔️`);
      load();
    } else {
      const err = await res.json().catch(() => ({}));
      showToast((err as any)?.message ?? 'Lỗi khi lưu', false);
    }
  };

  const deletePrompt = async () => {
    if (!editId || !confirm('Xoá prompt này?')) return;
    const res = await fetch(`/api/prompts/${editId}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token()}` } });
    if (res.ok) { showToast('Đã xoá prompt'); load(); }
    else showToast('Lỗi khi xoá', false);
  };

  // Config completeness per branch
  const configuredDocTypes = (b: Branch) => DOC_TYPES.filter(d => prompts.some(p => p.branchId === b.id && p.docType === d.value)).length;

  const docMeta = DOC_TYPES.find(d => d.value === selDocType)!;

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
      </div>

      <div className="flex gap-3" style={{ alignItems: 'flex-start' }}>

        {/* ── Left: Branch list ──────────────────────────────── */}
        <div style={{ width: 200, flexShrink: 0 }}>
          <div className="ds-sec-label">Chi nhánh</div>
          {loading ? (
            <div className="ds-card" style={{ padding: 16, textAlign: 'center', color: 'var(--t3)', fontSize: 12 }}>Đang tải...</div>
          ) : branches.length === 0 ? (
            <div className="ds-card" style={{ padding: 16, textAlign: 'center', color: 'var(--t3)', fontSize: 12 }}>Chưa có chi nhánh</div>
          ) : branches.map(b => {
            const cnt = configuredDocTypes(b);
            const active = selBranch?.id === b.id;
            return (
              <div key={b.id} onClick={() => setSelBranch(b)} className="ds-card"
                style={{ marginBottom: 6, cursor: 'pointer', padding: '10px 12px',
                  border: active ? '2px solid var(--fox)' : '1px solid var(--border)',
                  background: active ? 'var(--fox-lt)' : 'var(--surface)' }}>
                <div className="flex items-center justify-between">
                  <span style={{ fontWeight: 700, fontSize: 13, color: active ? 'var(--fox)' : 'var(--t1)' }}>{b.code}</span>
                  <span className={`ds-badge ${cnt === 4 ? 'ds-b-ok' : cnt > 0 ? 'ds-b-warn' : 'ds-b-gray'}`} style={{ fontSize: 9.5 }}>
                    {cnt}/4
                  </span>
                </div>
                <div style={{ fontSize: 11, color: 'var(--t2)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {b.name}
                </div>
                {/* Mini dot status per docType */}
                <div className="flex gap-1 mt-2">
                  {DOC_TYPES.map(d => {
                    const hasPrompt = prompts.some(p => p.branchId === b.id && p.docType === d.value);
                    const p = prompts.find(pp => pp.branchId === b.id && pp.docType === d.value);
                    return (
                      <div key={d.value} title={`${d.label}: ${hasPrompt ? (p?.testScore ? `${p.testScore.toFixed(0)}%` : 'Đã cấu hình') : 'Chưa cấu hình'}`}
                        style={{ width: 8, height: 8, borderRadius: 2, background: hasPrompt ? (p?.isActive ? d.color : 'var(--t3)') : 'var(--border)' }} />
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* ── Right: DocType tabs + Editor ───────────────────── */}
        <div className="flex-1 min-w-0">
          {!selBranch ? (
            <div className="ds-card" style={{ padding: 48, textAlign: 'center', color: 'var(--t3)' }}>
              ← Chọn chi nhánh để cấu hình prompt
            </div>
          ) : (
            <>
              {/* Branch header */}
              <div className="ds-card mb-3" style={{ padding: '10px 14px', background: 'var(--fox-lt)', border: '1px solid rgba(255,122,0,.2)' }}>
                <div style={{ fontWeight: 800, fontSize: 14, color: 'var(--fox)' }}>{selBranch.code} — {selBranch.name}</div>
                <div style={{ fontSize: 11, color: 'var(--t2)', marginTop: 2 }}>
                  {configuredDocTypes(selBranch)}/4 loại chứng từ đã có prompt
                </div>
              </div>

              {/* DocType cards */}
              <div className="grid grid-cols-4 gap-2 mb-3">
                {DOC_TYPES.map(d => {
                  const p = prompts.find(pp => pp.branchId === selBranch.id && pp.docType === d.value);
                  const active = selDocType === d.value;
                  return (
                    <div key={d.value} onClick={() => openEdit(p ?? null, d.value)}
                      style={{
                        borderRadius: 10, padding: '10px 12px', cursor: 'pointer',
                        background: active ? d.color : d.bg,
                        border: active ? `2px solid ${d.color}` : `1px solid ${d.color}30`,
                        transition: 'all .15s',
                      }}>
                      <div style={{ fontSize: 20, marginBottom: 5 }}>{d.icon}</div>
                      <div style={{ fontWeight: 700, fontSize: 11.5, color: active ? '#fff' : d.color }}>{d.label}</div>
                      {p ? (
                        <div style={{ marginTop: 5 }}>
                          <div style={{ fontSize: 10, color: active ? 'rgba(255,255,255,.8)' : d.color, fontWeight: 600 }}>
                            {p.testScore != null ? `${p.testScore.toFixed(0)}% accuracy` : '✓ Đã cấu hình'}
                          </div>
                          <div style={{ display: 'flex', gap: 3, marginTop: 3 }}>
                            <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 3, background: active ? 'rgba(255,255,255,.25)' : 'white', color: d.color, fontWeight: 700 }}>
                              {p.isActive ? 'Active' : 'Off'}
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div style={{ marginTop: 5, fontSize: 10, color: active ? 'rgba(255,255,255,.7)' : 'var(--t3)' }}>
                          Chưa cấu hình
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Prompt editor */}
              {editing && (
                <div className="ds-card">
                  <div className="ds-ch">
                    <div className="ds-ch-title">
                      <div className="ds-ch-ic" style={{ background: docMeta.bg }}>{docMeta.icon}</div>
                      <span style={{ color: docMeta.color, fontWeight: 700 }}>{docMeta.label}</span>
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
                      <textarea className="ds-pe"
                        style={{ minHeight: 260 }}
                        value={editing.promptText ?? ''}
                        onChange={e => setEditing(prev => ({ ...prev!, promptText: e.target.value }))}
                        spellCheck={false}
                      />
                      <div className="ds-fhint">
                        ~{Math.ceil((editing.promptText?.length ?? 0) / 4).toLocaleString()} tokens
                        · Biến: <code style={{ fontSize: 10 }}>{'{{filename}}'}</code> <code style={{ fontSize: 10 }}>{'{{branch}}'}</code> <code style={{ fontSize: 10 }}>{'{{period}}'}</code>
                      </div>
                    </div>

                    {/* Test stats (nếu có) */}
                    {editing.testScore != null && (
                      <div className="grid grid-cols-3 gap-3" style={{ marginTop: 10 }}>
                        {[
                          { label: 'Độ chính xác', val: `${editing.testScore.toFixed(1)}%`, color: scoreColor(editing.testScore) },
                          { label: 'Mẫu test',     val: editing.testTotal ?? 0,              color: 'var(--t1)' },
                          { label: 'Đúng',          val: editing.testCorrect ?? 0,            color: 'var(--ok)' },
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
                        Cập nhật lần cuối: {new Date(editing.updatedAt).toLocaleString('vi-VN')}
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
