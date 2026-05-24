import React, { useEffect, useState, useCallback } from 'react';

const token = () => localStorage.getItem('auth_token') ?? '';

interface PromptCard {
  id: number;
  branchId: number;
  docType: string;
  name: string;
  promptText: string;
  testScore: number | null;
  testTotal: number | null;
  testCorrect: number | null;
  isActive: boolean;
  updatedById: number | null;
  createdAt: string;
  updatedAt: string;
  branch?: { code: string; name: string } | null;
}

interface Branch { id: number; name: string; code: string; }

const DOC_TYPES = [
  { value: 'ground_handling', label: 'Ground Handling', cls: 'ds-t-grd' },
  { value: 'airport_charges', label: 'Airport Charges',  cls: 'ds-t-apt' },
  { value: 'fuel',            label: 'Fuel',             cls: 'ds-t-fuel' },
  { value: 'catering',        label: 'Catering',         cls: 'ds-t-ctr' },
];

const DEFAULT_PROMPT = `Bạn là AI chuyên đọc chứng từ kế toán hàng không.
Hãy trích xuất các trường sau từ file đính kèm:
- invoice_number: Số hóa đơn
- date: Ngày phát hành (YYYY-MM-DD)
- vendor: Tên nhà cung cấp
- amount: Tổng tiền (số, không có đơn vị)
- currency: Loại tiền tệ (JPY/USD/EUR/VND)
- service_period: Kỳ dịch vụ (YYYY-MM)

Trả về JSON với đúng các key trên.`;

export const PromptConfigPage: React.FC = () => {
  const [prompts, setPrompts]     = useState<PromptCard[]>([]);
  const [branches, setBranches]   = useState<Branch[]>([]);
  const [loading, setLoading]     = useState(true);
  const [activeId, setActiveId]   = useState<number | null>(null);
  const [editing, setEditing]     = useState<Partial<PromptCard> | null>(null);
  const [saving, setSaving]       = useState(false);
  const [showModal, setShowModal] = useState(false);

  // New prompt form
  const [newBranch, setNewBranch]   = useState('');
  const [newDocType, setNewDocType] = useState('ground_handling');
  const [newName, setNewName]       = useState('');
  const [newText, setNewText]       = useState(DEFAULT_PROMPT);

  // Toast
  const [toast, setToast]     = useState('');
  const [toastOk, setToastOk] = useState(true);
  const showToast = (msg: string, ok = true) => { setToast(msg); setToastOk(ok); setTimeout(() => setToast(''), 3000); };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [pRes, bRes] = await Promise.all([
        fetch('/api/prompts', { headers: { Authorization: `Bearer ${token()}` } }),
        fetch('/api/branches', { headers: { Authorization: `Bearer ${token()}` } }),
      ]);
      if (pRes.ok) { const d = await pRes.json(); setPrompts(d ?? []); }
      if (bRes.ok) { const d = await bRes.json(); setBranches(d ?? []); if (d.length > 0) setNewBranch(String(d[0].id)); }
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const activePrompt = prompts.find(p => p.id === activeId) ?? null;

  const openPrompt = (p: PromptCard) => {
    setActiveId(p.id);
    setEditing({ ...p });
  };

  const savePrompt = async () => {
    if (!editing || !activeId) return;
    setSaving(true);
    const res = await fetch(`/api/prompts/${activeId}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: editing.name, promptText: editing.promptText, isActive: editing.isActive }),
    });
    setSaving(false);
    if (res.ok) { showToast('Đã lưu prompt ✔️'); load(); }
    else showToast('Lỗi khi lưu', false);
  };

  const deletePrompt = async (id: number) => {
    if (!confirm('Xoá prompt này?')) return;
    const res = await fetch(`/api/prompts/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token()}` } });
    if (res.ok) { showToast('Đã xoá prompt'); if (activeId === id) { setActiveId(null); setEditing(null); } load(); }
    else showToast('Lỗi khi xoá', false);
  };

  const createPrompt = async () => {
    if (!newBranch || !newName.trim()) { showToast('Vui lòng nhập đủ thông tin', false); return; }
    setSaving(true);
    const res = await fetch('/api/prompts', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ branchId: Number(newBranch), docType: newDocType, name: newName.trim(), promptText: newText }),
    });
    setSaving(false);
    if (res.ok) {
      showToast('Đã tạo prompt mới ✔️');
      setShowModal(false);
      setNewName('');
      setNewText(DEFAULT_PROMPT);
      load();
    } else {
      const err = await res.json().catch(() => ({}));
      showToast(err?.message ?? 'Lỗi khi tạo', false);
    }
  };

  const scoreColor = (s: number | null) => !s ? 'var(--t3)' : s >= 90 ? 'var(--ok)' : s >= 70 ? 'var(--warn)' : 'var(--err)';

  const docLabel = (dt: string) => DOC_TYPES.find(d => d.value === dt)?.label ?? dt;
  const docCls   = (dt: string) => DOC_TYPES.find(d => d.value === dt)?.cls ?? 'ds-t-grd';

  return (
    <div>
      {/* Header */}
      <div className="flex items-end justify-between mb-4 gap-3">
        <div>
          <div className="text-[19px] font-extrabold" style={{ color: 'var(--t1)' }}>🤖 Cấu hình Prompt AI</div>
          <div className="text-[12.5px] mt-1" style={{ color: 'var(--t2)' }}>
            Tùy chỉnh prompt trích xuất OCR theo loại chứng từ và chi nhánh
          </div>
        </div>
        <button className="ds-btn ds-btn-p ds-btn-sm" onClick={() => setShowModal(true)}>
          + Tạo Prompt mới
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {/* Prompt list */}
        <div>
          <div className="ds-sec-label">Danh sách Prompt ({prompts.length})</div>
          {loading ? (
            <div className="ds-card" style={{ padding: 24, textAlign: 'center', color: 'var(--t3)' }}>Đang tải...</div>
          ) : prompts.length === 0 ? (
            <div className="ds-card" style={{ padding: 24, textAlign: 'center', color: 'var(--t3)' }}>
              Chưa có prompt nào.<br/>
              <button className="ds-btn ds-btn-p ds-btn-sm mt-3" onClick={() => setShowModal(true)}>+ Tạo mới</button>
            </div>
          ) : prompts.map(p => (
            <div key={p.id}
              className={`ds-pcard ${activeId === p.id ? 'ring-2' : ''}`}
              style={activeId === p.id ? { ringColor: 'var(--fox)', outline: '2px solid var(--fox)' } : {}}
              onClick={() => openPrompt(p)}>
              <div className="ds-pcard-hdr">
                <span className={`ds-tag ${docCls(p.docType)}`}>{docLabel(p.docType)}</span>
                {p.branch && <span className="ds-badge ds-b-gray" style={{ fontSize: 10 }}>{p.branch.code}</span>}
                <span className={`ml-auto ds-mono text-[11px]`} style={{ color: scoreColor(p.testScore) }}>
                  {p.testScore != null ? `${p.testScore.toFixed(1)}%` : 'Chưa test'}
                </span>
                <span className={`ds-badge ${p.isActive ? 'ds-b-ok' : 'ds-b-gray'} text-[9px] ml-1`}>
                  {p.isActive ? 'Active' : 'Off'}
                </span>
              </div>
              <div className="ds-pcard-body">
                <div style={{ fontWeight: 700, fontSize: 12, color: 'var(--t1)', marginBottom: 5 }}>{p.name}</div>
                <div className="ds-pcard-code">{p.promptText}</div>
                {p.testTotal != null && (
                  <div style={{ marginTop: 8, fontSize: 10.5, color: 'var(--t2)', display: 'flex', gap: 8 }}>
                    <span>✅ {p.testCorrect}/{p.testTotal} đúng</span>
                    <span>🔢 {p.testTotal} mẫu test</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Prompt editor */}
        <div className="lg:col-span-2">
          {!editing ? (
            <div className="ds-card" style={{ padding: 48, textAlign: 'center', color: 'var(--t3)' }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>🤖</div>
              <div style={{ fontWeight: 700, fontSize: 14 }}>Chọn một prompt để chỉnh sửa</div>
              <div style={{ fontSize: 12, marginTop: 6 }}>Hoặc tạo prompt mới cho loại chứng từ mới</div>
            </div>
          ) : (
            <div className="ds-card">
              <div className="ds-ch">
                <div className="ds-ch-title">
                  <span className={`ds-tag ${docCls(editing.docType ?? '')}`}>{docLabel(editing.docType ?? '')}</span>
                  {editing.branch && <span className="ds-badge ds-b-gray">{editing.branch.code}</span>}
                  <span className="text-[12.5px] font-bold">{editing.name}</span>
                </div>
                <div className="flex gap-1.5">
                  <button className="ds-btn ds-btn-d ds-btn-xs" onClick={() => deletePrompt(activeId!)}>🗑️ Xoá</button>
                  <button className="ds-btn ds-btn-p ds-btn-sm" onClick={savePrompt} disabled={saving}>
                    {saving ? 'Đang lưu...' : '💾 Lưu'}
                  </button>
                </div>
              </div>
              <div className="ds-cb">
                {/* Name + Toggle */}
                <div className="flex gap-3 mb-3 items-center">
                  <div className="flex-1">
                    <label className="ds-flbl">Tên Prompt</label>
                    <input className="ds-inp" value={editing.name ?? ''} onChange={e => setEditing(prev => ({ ...prev!, name: e.target.value }))} />
                  </div>
                  <div style={{ marginTop: 16 }}>
                    <label className="ds-flbl">Active</label>
                    <label className="ds-toggle">
                      <input type="checkbox" checked={editing.isActive ?? true}
                        onChange={e => setEditing(prev => ({ ...prev!, isActive: e.target.checked }))} />
                      <span className="ds-tslider"></span>
                    </label>
                  </div>
                </div>

                {/* Prompt editor */}
                <div className="ds-fgrp">
                  <label className="ds-flbl">Prompt Text</label>
                  <textarea className="ds-pe"
                    style={{ minHeight: 280, fontFamily: 'JetBrains Mono, monospace' }}
                    value={editing.promptText ?? ''}
                    onChange={e => setEditing(prev => ({ ...prev!, promptText: e.target.value }))}
                    spellCheck={false}
                  />
                  <div className="ds-fhint">
                    Tokens ước tính: ~{Math.ceil((editing.promptText?.length ?? 0) / 4).toLocaleString()}
                    · Hỗ trợ biến: <code style={{ fontSize: 10 }}>{'{{filename}}'}</code>, <code style={{ fontSize: 10 }}>{'{{branch}}'}</code>
                  </div>
                </div>

                {/* Test stats */}
                {(editing.testScore != null || editing.testTotal != null) && (
                  <div className="ds-card" style={{ padding: '10px 14px', background: 'var(--surface-2)' }}>
                    <div className="ds-sec-label">Kết quả test</div>
                    <div className="flex gap-4 flex-wrap">
                      <div>
                        <div style={{ fontSize: 10.5, color: 'var(--t2)' }}>Độ chính xác</div>
                        <div className="ds-mono text-[18px]" style={{ color: scoreColor(editing.testScore ?? null) }}>
                          {editing.testScore?.toFixed(1) ?? '—'}%
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: 10.5, color: 'var(--t2)' }}>Mẫu test</div>
                        <div className="ds-mono text-[18px]">{editing.testTotal ?? 0}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 10.5, color: 'var(--t2)' }}>Đúng</div>
                        <div className="ds-mono text-[18px]" style={{ color: 'var(--ok)' }}>{editing.testCorrect ?? 0}</div>
                      </div>
                    </div>
                  </div>
                )}

                <div style={{ marginTop: 10, fontSize: 11, color: 'var(--t3)' }}>
                  Cập nhật lần cuối: {editing.updatedAt ? new Date(editing.updatedAt).toLocaleString('vi-VN') : '—'}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Create Modal */}
      {showModal && (
        <div className="ds-modal-overlay open" onClick={e => { if (e.target === e.currentTarget) setShowModal(false); }}>
          <div className="ds-modal">
            <div className="ds-modal-hdr">
              <span className="ds-modal-title">🤖 Tạo Prompt mới</span>
              <button className="ds-btn ds-btn-g ds-btn-sm" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <div className="ds-modal-body">
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="ds-flbl">Chi nhánh</label>
                  <select className="ds-sel" value={newBranch} onChange={e => setNewBranch(e.target.value)}>
                    {branches.map(b => <option key={b.id} value={b.id}>{b.code} — {b.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="ds-flbl">Loại chứng từ</label>
                  <select className="ds-sel" value={newDocType} onChange={e => setNewDocType(e.target.value)}>
                    {DOC_TYPES.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
                  </select>
                </div>
              </div>
              <div className="ds-fgrp">
                <label className="ds-flbl">Tên prompt</label>
                <input className="ds-inp" placeholder="VD: NRT Ground Handling v2" value={newName} onChange={e => setNewName(e.target.value)} />
              </div>
              <div className="ds-fgrp">
                <label className="ds-flbl">Prompt text (có thể chỉnh sau)</label>
                <textarea className="ds-pe" rows={6} value={newText} onChange={e => setNewText(e.target.value)} />
              </div>
            </div>
            <div className="ds-modal-footer">
              <button className="ds-btn ds-btn-g ds-btn-sm" onClick={() => setShowModal(false)}>Huỷ</button>
              <button className="ds-btn ds-btn-p ds-btn-sm" onClick={createPrompt} disabled={saving}>
                {saving ? 'Đang tạo...' : '+ Tạo Prompt'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="ds-toast" style={{ background: toastOk ? 'var(--ok)' : 'var(--err)' }}>{toast}</div>
      )}
    </div>
  );
};
