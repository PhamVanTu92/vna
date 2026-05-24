import React, { useEffect, useState, useCallback } from 'react';

const token = () => localStorage.getItem('auth_token') ?? '';

interface FieldMapping {
  systemField: string;
  docLabel: string;
  required: boolean;
  type: 'text' | 'number' | 'date' | 'currency';
}
interface Branch  { id: number; name: string; code: string; }
interface DocType { id: number; code: string; name: string; icon: string; color: string; bgColor: string; isActive: boolean; sortOrder: number; }
interface ConfigState { fields: FieldMapping[]; formats: string[]; loaded: boolean; }

const DEFAULT_FIELDS: FieldMapping[] = [
  { systemField: 'invoice_number', docLabel: 'Số hóa đơn',    required: true,  type: 'text' },
  { systemField: 'date',           docLabel: 'Ngày phát hành', required: true,  type: 'date' },
  { systemField: 'vendor',         docLabel: 'Nhà cung cấp',   required: true,  type: 'text' },
  { systemField: 'amount',         docLabel: 'Tổng tiền',      required: true,  type: 'currency' },
  { systemField: 'currency',       docLabel: 'Loại tiền tệ',   required: true,  type: 'text' },
  { systemField: 'service_period', docLabel: 'Kỳ dịch vụ',    required: false, type: 'text' },
  { systemField: 'flight_count',   docLabel: 'Số chuyến bay',  required: false, type: 'number' },
  { systemField: 'tax_code',       docLabel: 'Mã số thuế',     required: false, type: 'text' },
];
const FORMATS = ['pdf', 'xlsx', 'jpg', 'png', 'docx', 'xml'];
const fmtIcon = (f: string) => f === 'pdf' ? '📄' : f === 'xlsx' ? '📊' : ['jpg','png'].includes(f) ? '🖼️' : f === 'docx' ? '📝' : '📋';
const FIELD_TYPES = ['text','number','date','currency'];

export const InputConfigPage: React.FC = () => {
  const [branches, setBranches]     = useState<Branch[]>([]);
  const [selBranch, setSelBranch]   = useState<Branch | null>(null);
  const [docTypes, setDocTypes]     = useState<DocType[]>([]);
  const [selDt, setSelDt]           = useState('');
  const [cache, setCache]           = useState<Record<string, ConfigState>>({});
  const [loading, setLoading]       = useState(false);
  const [saving, setSaving]         = useState(false);

  // Doc-type management modal
  const [showDtModal, setShowDtModal] = useState(false);
  const [editDt, setEditDt]           = useState<DocType | null>(null);
  const [dtForm, setDtForm]           = useState({ code: '', name: '', icon: '📄', color: '#5B21B6', bgColor: '#EDE9FE', sortOrder: 99 });
  const [dtSaving, setDtSaving]       = useState(false);

  const [toast, setToast]   = useState('');
  const [toastOk, setToastOk] = useState(true);
  const showToast = (msg: string, ok = true) => { setToast(msg); setToastOk(ok); setTimeout(() => setToast(''), 3000); };

  // Load doc types
  const loadDocTypes = useCallback(async () => {
    const r = await fetch('/api/doc-types/all', { headers: { Authorization: `Bearer ${token()}` } });
    if (r.ok) {
      const d: DocType[] = await r.json();
      setDocTypes(d);
      // Set initial selection to first active type
      setSelDt(prev => prev || (d.find(x => x.isActive)?.code ?? ''));
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetch('/api/admin/branches', { headers: { Authorization: `Bearer ${token()}` } })
      .then(r => r.ok ? r.json() : [])
      .then((d: Branch[]) => { setBranches(d ?? []); if (d.length > 0) setSelBranch(d[0]); })
      .catch(() => {});
    loadDocTypes();
  }, [loadDocTypes]);

  const cacheKey = (b: Branch | null, dt: string) => b ? `${b.id}_${dt}` : '';

  // Load config for selected branch + docType
  useEffect(() => {
    if (!selBranch || !selDt) return;
    const key = cacheKey(selBranch, selDt);
    if (cache[key]?.loaded) return;
    setLoading(true);
    fetch(`/api/config/input/${selBranch.id}/${selDt}`, { headers: { Authorization: `Bearer ${token()}` } })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        let fields = DEFAULT_FIELDS;
        let formats = ['pdf', 'xlsx', 'jpg'];
        if (d) {
          try { fields  = JSON.parse(d.fieldMappings)  || DEFAULT_FIELDS; } catch {}
          try { formats = JSON.parse(d.acceptedFormats) || formats; } catch {}
        }
        setCache(prev => ({ ...prev, [key]: { fields, formats, loaded: true } }));
      })
      .catch(() => setCache(prev => ({ ...prev, [key]: { fields: DEFAULT_FIELDS, formats: ['pdf','xlsx','jpg'], loaded: true } })))
      .finally(() => setLoading(false));
  }, [selBranch, selDt]);

  const cfg = cache[cacheKey(selBranch, selDt)];
  const mutateCfg = (fn: (c: ConfigState) => ConfigState) => {
    const key = cacheKey(selBranch, selDt);
    setCache(prev => ({ ...prev, [key]: fn(prev[key]) }));
  };

  const save = async () => {
    if (!selBranch || !selDt || !cfg) return;
    setSaving(true);
    const res = await fetch(`/api/config/input/${selBranch.id}/${selDt}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ fieldMappings: JSON.stringify(cfg.fields), acceptedFormats: JSON.stringify(cfg.formats) }),
    });
    setSaving(false);
    res.ok ? showToast('Đã lưu ✔️') : showToast('Lỗi khi lưu', false);
  };

  const addField = () => mutateCfg(c => ({ ...c, fields: [...c.fields, { systemField: '', docLabel: '', required: false, type: 'text' as const }] }));
  const removeField = (i: number) => mutateCfg(c => ({ ...c, fields: c.fields.filter((_, idx) => idx !== i) }));
  const updateField = (i: number, key: keyof FieldMapping, val: any) =>
    mutateCfg(c => { const f = [...c.fields]; f[i] = { ...f[i], [key]: val }; return { ...c, fields: f }; });
  const toggleFmt = (f: string) =>
    mutateCfg(c => ({ ...c, formats: c.formats.includes(f) ? c.formats.filter(x => x !== f) : [...c.formats, f] }));

  // DocType management
  const openCreate = () => {
    setEditDt(null);
    setDtForm({ code: '', name: '', icon: '📄', color: '#5B21B6', bgColor: '#EDE9FE', sortOrder: 99 });
    setShowDtModal(true);
  };
  const openEdit = (dt: DocType) => {
    setEditDt(dt);
    setDtForm({ code: dt.code, name: dt.name, icon: dt.icon, color: dt.color, bgColor: dt.bgColor, sortOrder: dt.sortOrder });
    setShowDtModal(true);
  };
  const saveDt = async () => {
    if (!dtForm.name.trim()) { showToast('Tên không được để trống', false); return; }
    setDtSaving(true);
    let res: Response;
    if (editDt) {
      res = await fetch(`/api/doc-types/${editDt.id}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: dtForm.name, icon: dtForm.icon, color: dtForm.color, bgColor: dtForm.bgColor, sortOrder: dtForm.sortOrder }),
      });
    } else {
      if (!dtForm.code.trim()) { showToast('Mã không được để trống', false); setDtSaving(false); return; }
      res = await fetch('/api/doc-types', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(dtForm),
      });
    }
    setDtSaving(false);
    if (res.ok) {
      setShowDtModal(false);
      await loadDocTypes();
      showToast(editDt ? 'Đã cập nhật loại chứng từ ✔️' : 'Đã thêm loại chứng từ mới ✔️');
    } else {
      const err = await res.json().catch(() => ({}));
      showToast((err as any).error || 'Lỗi khi lưu', false);
    }
  };
  const toggleActive = async (dt: DocType) => {
    const res = await fetch(`/api/doc-types/${dt.id}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !dt.isActive }),
    });
    if (res.ok) { await loadDocTypes(); showToast(dt.isActive ? 'Đã ẩn loại chứng từ' : 'Đã bật loại chứng từ'); }
  };

  const activeDts = docTypes.filter(d => d.isActive);

  return (
    <div>
      {/* Header */}
      <div className="flex items-end justify-between mb-4 gap-3">
        <div>
          <div className="text-[19px] font-extrabold" style={{ color: 'var(--t1)' }}>📁 Cấu hình Input</div>
          <div className="text-[12.5px] mt-1" style={{ color: 'var(--t2)' }}>
            Quản lý loại chứng từ · Cấu hình định dạng file và trường dữ liệu theo chi nhánh
          </div>
        </div>
        <button className="ds-btn ds-btn-p ds-btn-sm" onClick={save} disabled={saving || !selBranch || !selDt || !cfg}>
          {saving ? 'Đang lưu...' : '💾 Lưu Field Mapping'}
        </button>
      </div>

      {/* ── Section 1: Doc Type Management ── */}
      <div className="ds-card mb-3">
        <div className="ds-ch">
          <div className="ds-ch-title">
            <div className="ds-ch-ic" style={{ background: 'var(--fox-lt)' }}>🗂️</div>
            Quản lý Loại chứng từ
          </div>
          <button className="ds-btn ds-btn-p ds-btn-sm" onClick={openCreate}>＋ Thêm loại</button>
        </div>
        <div className="ds-cb">
          <div style={{ fontSize: 12, color: 'var(--t2)', marginBottom: 12 }}>
            Khai báo các loại chứng từ mà hệ thống xử lý. Các trang Prompt Config, Output Config và Tổng hợp sẽ tự động cập nhật theo danh sách này.
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {docTypes.map(dt => (
              <div key={dt.id}
                className="flex items-center gap-2 px-3 py-2 rounded-[8px] border"
                style={{ background: dt.isActive ? dt.bgColor : 'var(--surface-2)', borderColor: dt.isActive ? `${dt.color}33` : 'var(--border)', opacity: dt.isActive ? 1 : 0.55 }}>
                <span style={{ fontSize: 18 }}>{dt.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-[12.5px] truncate" style={{ color: dt.isActive ? dt.color : 'var(--t3)' }}>{dt.name}</div>
                  <div className="text-[10.5px] font-mono" style={{ color: 'var(--t3)' }}>{dt.code}</div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button className="ds-btn ds-btn-g ds-btn-xs" onClick={() => openEdit(dt)} title="Sửa">✏️</button>
                  <label className="ds-toggle" style={{ width: 28, height: 15 }}>
                    <input type="checkbox" checked={dt.isActive} onChange={() => toggleActive(dt)} />
                    <span className="ds-tslider"></span>
                  </label>
                </div>
              </div>
            ))}
          </div>
          {docTypes.length === 0 && (
            <div className="text-center py-6 text-[12px]" style={{ color: 'var(--t3)' }}>Chưa có loại nào — nhấn "+ Thêm loại"</div>
          )}
        </div>
      </div>

      {/* ── Section 2: Field Mapping (per branch × docType) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-3">
        {/* Branch list */}
        <div className="ds-card lg:col-span-1">
          <div className="ds-ch">
            <div className="ds-ch-title">
              <div className="ds-ch-ic" style={{ background: 'var(--ok-bg)' }}>🏢</div>
              Chi nhánh
            </div>
          </div>
          <div style={{ padding: '8px 0' }}>
            {branches.map(b => (
              <div key={b.id}
                onClick={() => setSelBranch(b)}
                className="flex items-center gap-2 px-3 py-2 cursor-pointer transition-all"
                style={{
                  background: selBranch?.id === b.id ? 'var(--fox-lt)' : 'transparent',
                  borderLeft: `3px solid ${selBranch?.id === b.id ? 'var(--fox)' : 'transparent'}`,
                }}>
                <span className="ds-badge ds-b-gray" style={{ fontSize: 10, padding: '1px 6px' }}>{b.code}</span>
                <span className="text-[12px] flex-1 truncate" style={{ color: 'var(--t2)' }}>{b.name}</span>
                <span className="text-[10px] font-bold" style={{ color: 'var(--fox)' }}>{activeDts.length}/4+</span>
              </div>
            ))}
          </div>
        </div>

        {/* Config panel */}
        <div className="ds-card lg:col-span-3">
          {/* DocType tabs */}
          <div className="flex gap-1 px-3 pt-3 pb-2 flex-wrap border-b" style={{ borderColor: 'var(--border)' }}>
            {activeDts.map(dt => (
              <button key={dt.code}
                onClick={() => setSelDt(dt.code)}
                className="ds-btn ds-btn-sm"
                style={{
                  background: selDt === dt.code ? dt.bgColor : 'var(--surface-2)',
                  color: selDt === dt.code ? dt.color : 'var(--t2)',
                  border: `1px solid ${selDt === dt.code ? `${dt.color}44` : 'var(--border)'}`,
                  fontWeight: selDt === dt.code ? 700 : 500,
                }}>
                {dt.icon} {dt.name}
              </button>
            ))}
          </div>

          {!selBranch ? (
            <div className="text-center py-10 text-[12px]" style={{ color: 'var(--t3)' }}>Chọn chi nhánh</div>
          ) : !selDt ? (
            <div className="text-center py-10 text-[12px]" style={{ color: 'var(--t3)' }}>Chọn loại chứng từ</div>
          ) : loading ? (
            <div className="text-center py-10 text-[12px]" style={{ color: 'var(--t3)' }}>Đang tải...</div>
          ) : cfg ? (
            <div className="ds-cb">
              {/* File formats */}
              <div className="ds-fgrp">
                <label className="ds-flbl">Định dạng file chấp nhận</label>
                <div className="flex flex-wrap gap-2">
                  {FORMATS.map(f => (
                    <label key={f} className="flex items-center gap-1.5 cursor-pointer px-2.5 py-1 rounded-[6px] text-[12px] font-semibold"
                      style={{
                        background: cfg.formats.includes(f) ? 'var(--fox-lt)' : 'var(--surface-2)',
                        color: cfg.formats.includes(f) ? 'var(--fox)' : 'var(--t2)',
                        border: `1px solid ${cfg.formats.includes(f) ? 'rgba(255,122,0,.3)' : 'var(--border)'}`,
                      }}>
                      <input type="checkbox" className="sr-only" checked={cfg.formats.includes(f)} onChange={() => toggleFmt(f)} />
                      <span>{fmtIcon(f)}</span> .{f}
                    </label>
                  ))}
                </div>
              </div>

              <div className="ds-dvd" />

              {/* Field mapping table */}
              <div className="ds-fgrp">
                <div className="flex items-center justify-between mb-2">
                  <label className="ds-flbl" style={{ margin: 0 }}>Field Mapping</label>
                  <button className="ds-btn ds-btn-s ds-btn-xs" onClick={addField}>＋ Thêm trường</button>
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table className="ds-dt">
                    <thead>
                      <tr>
                        <th>System Field</th>
                        <th>Nhãn trong chứng từ</th>
                        <th style={{ textAlign: 'center' }}>Kiểu</th>
                        <th style={{ textAlign: 'center' }}>Bắt buộc</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {cfg.fields.map((f, i) => (
                        <tr key={i}>
                          <td>
                            <input className="ds-inp" value={f.systemField} onChange={e => updateField(i, 'systemField', e.target.value)}
                              placeholder="invoice_number" style={{ fontFamily: 'monospace', fontSize: 11.5 }} />
                          </td>
                          <td>
                            <input className="ds-inp" value={f.docLabel} onChange={e => updateField(i, 'docLabel', e.target.value)} placeholder="Tên trường..." />
                          </td>
                          <td>
                            <select className="ds-sel" value={f.type} onChange={e => updateField(i, 'type', e.target.value)}>
                              {FIELD_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <input type="checkbox" checked={f.required} onChange={e => updateField(i, 'required', e.target.checked)} />
                          </td>
                          <td>
                            <button className="ds-btn ds-btn-d ds-btn-xs" onClick={() => removeField(i)}>✕</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {/* Doc Type Modal */}
      <div className={`ds-modal-overlay ${showDtModal ? 'open' : ''}`} onClick={e => { if (e.target === e.currentTarget) setShowDtModal(false); }}>
        <div className="ds-modal" style={{ width: 460 }}>
          <div className="ds-modal-hdr">
            <span className="ds-modal-title">{editDt ? '✏️ Sửa loại chứng từ' : '＋ Thêm loại chứng từ mới'}</span>
            <button className="ds-btn ds-btn-g ds-btn-xs" onClick={() => setShowDtModal(false)}>✕</button>
          </div>
          <div className="ds-modal-body">
            {!editDt && (
              <div className="ds-fgrp">
                <label className="ds-flbl">Mã (code) <span style={{ color: 'var(--err)' }}>*</span></label>
                <input className="ds-inp" value={dtForm.code} onChange={e => setDtForm(p => ({ ...p, code: e.target.value }))}
                  placeholder="vd: handling_fee, navigation_charge..." style={{ fontFamily: 'monospace' }} />
                <div className="ds-fhint">Chỉ dùng chữ thường, số và dấu gạch dưới. Không thể sửa sau khi tạo.</div>
              </div>
            )}
            <div className="ds-fgrp">
              <label className="ds-flbl">Tên hiển thị <span style={{ color: 'var(--err)' }}>*</span></label>
              <input className="ds-inp" value={dtForm.name} onChange={e => setDtForm(p => ({ ...p, name: e.target.value }))} placeholder="Ground Handling, Fuel..." />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="ds-fgrp">
                <label className="ds-flbl">Icon (emoji)</label>
                <input className="ds-inp" value={dtForm.icon} onChange={e => setDtForm(p => ({ ...p, icon: e.target.value }))} style={{ textAlign: 'center', fontSize: 18 }} />
              </div>
              <div className="ds-fgrp">
                <label className="ds-flbl">Màu chữ</label>
                <div className="flex items-center gap-1.5">
                  <input type="color" value={dtForm.color} onChange={e => setDtForm(p => ({ ...p, color: e.target.value }))}
                    style={{ width: 32, height: 32, border: 'none', borderRadius: 6, cursor: 'pointer' }} />
                  <input className="ds-inp" value={dtForm.color} onChange={e => setDtForm(p => ({ ...p, color: e.target.value }))}
                    style={{ fontFamily: 'monospace', fontSize: 11 }} />
                </div>
              </div>
              <div className="ds-fgrp">
                <label className="ds-flbl">Màu nền</label>
                <div className="flex items-center gap-1.5">
                  <input type="color" value={dtForm.bgColor} onChange={e => setDtForm(p => ({ ...p, bgColor: e.target.value }))}
                    style={{ width: 32, height: 32, border: 'none', borderRadius: 6, cursor: 'pointer' }} />
                  <input className="ds-inp" value={dtForm.bgColor} onChange={e => setDtForm(p => ({ ...p, bgColor: e.target.value }))}
                    style={{ fontFamily: 'monospace', fontSize: 11 }} />
                </div>
              </div>
            </div>
            {/* Preview */}
            <div className="ds-fgrp">
              <label className="ds-flbl">Xem trước</label>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 6,
                background: dtForm.bgColor, color: dtForm.color, fontWeight: 700, fontSize: 12.5, border: `1px solid ${dtForm.color}33` }}>
                {dtForm.icon} {dtForm.name || 'Tên loại'}
              </span>
            </div>
            <div className="ds-fgrp">
              <label className="ds-flbl">Thứ tự sắp xếp</label>
              <input className="ds-inp" type="number" min={0} max={999} value={dtForm.sortOrder}
                onChange={e => setDtForm(p => ({ ...p, sortOrder: Number(e.target.value) }))} style={{ width: 100 }} />
              <div className="ds-fhint">Số nhỏ hơn hiện trước (0 = đầu tiên)</div>
            </div>
          </div>
          <div className="ds-modal-footer">
            <button className="ds-btn ds-btn-g ds-btn-sm" onClick={() => setShowDtModal(false)}>Hủy</button>
            <button className="ds-btn ds-btn-p ds-btn-sm" onClick={saveDt} disabled={dtSaving}>
              {dtSaving ? 'Đang lưu...' : editDt ? '💾 Cập nhật' : '＋ Tạo loại'}
            </button>
          </div>
        </div>
      </div>

      {toast && <div className="ds-toast" style={{ background: toastOk ? 'var(--ok)' : 'var(--err)' }}>{toast}</div>}
    </div>
  );
};
