import React, { useEffect, useState } from 'react';

const token = () => localStorage.getItem('auth_token') ?? '';

interface FieldMapping {
  systemField: string;
  docLabel: string;
  required: boolean;
  type: 'text' | 'number' | 'date' | 'currency';
}
interface Branch { id: number; name: string; code: string; }
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

const DOC_TYPES = [
  { value: 'ground_handling', label: 'Ground Handling', icon: '✈️', cls: 'ds-t-grd', bg: '#EDE9FE', color: '#5B21B6' },
  { value: 'airport_charges', label: 'Airport Charges',  icon: '🏢', cls: 'ds-t-apt', bg: '#DBEAFE', color: '#1E40AF' },
  { value: 'fuel',            label: 'Fuel',             icon: '⛽', cls: 'ds-t-fuel', bg: '#FEF3C7', color: '#92400E' },
  { value: 'catering',        label: 'Catering',         icon: '🍱', cls: 'ds-t-ctr', bg: '#DCFCE7', color: '#166534' },
];
const FORMATS = ['pdf', 'xlsx', 'jpg', 'png', 'docx', 'xml'];
const fmtIcon = (f: string) => f === 'pdf' ? '📄' : f === 'xlsx' ? '📊' : ['jpg','png'].includes(f) ? '🖼️' : f === 'docx' ? '📝' : '📋';

export const InputConfigPage: React.FC = () => {
  const [branches, setBranches]       = useState<Branch[]>([]);
  const [selBranch, setSelBranch]     = useState<Branch | null>(null);
  const [selDocType, setSelDocType]   = useState(DOC_TYPES[0].value);
  // Cache: branchId_docType → ConfigState
  const [cache, setCache]             = useState<Record<string, ConfigState>>({});
  const [loading, setLoading]         = useState(false);
  const [saving, setSaving]           = useState(false);

  const [toast, setToast]     = useState('');
  const [toastOk, setToastOk] = useState(true);
  const showToast = (msg: string, ok = true) => { setToast(msg); setToastOk(ok); setTimeout(() => setToast(''), 3000); };

  // Load branches
  useEffect(() => {
    fetch('/api/branches', { headers: { Authorization: `Bearer ${token()}` } })
      .then(r => r.ok ? r.json() : [])
      .then((d: Branch[]) => { setBranches(d ?? []); if (d.length > 0) setSelBranch(d[0]); })
      .catch(() => {});
  }, []);

  const cacheKey = (b: Branch | null, dt: string) => b ? `${b.id}_${dt}` : '';

  // Load config for selected branch+docType
  useEffect(() => {
    if (!selBranch) return;
    const key = cacheKey(selBranch, selDocType);
    if (cache[key]?.loaded) return; // already cached
    setLoading(true);
    fetch(`/api/config/input/${selBranch.id}/${selDocType}`, { headers: { Authorization: `Bearer ${token()}` } })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        let fields = DEFAULT_FIELDS, formats = ['pdf', 'xlsx', 'jpg'];
        if (d) {
          try { fields = JSON.parse(d.fieldMappings) || DEFAULT_FIELDS; } catch {}
          try { formats = JSON.parse(d.acceptedFormats) || formats; } catch {}
        }
        setCache(prev => ({ ...prev, [key]: { fields, formats, loaded: true } }));
      }).catch(() => {}).finally(() => setLoading(false));
  }, [selBranch, selDocType]);

  const current = cache[cacheKey(selBranch, selDocType)];
  const fields  = current?.fields ?? DEFAULT_FIELDS;
  const formats = current?.formats ?? ['pdf', 'xlsx', 'jpg'];

  const setFields  = (fn: (f: FieldMapping[]) => FieldMapping[]) => {
    const key = cacheKey(selBranch, selDocType);
    setCache(prev => ({ ...prev, [key]: { ...prev[key], fields: fn(prev[key]?.fields ?? DEFAULT_FIELDS) } }));
  };
  const setFormats = (fn: (f: string[]) => string[]) => {
    const key = cacheKey(selBranch, selDocType);
    setCache(prev => ({ ...prev, [key]: { ...prev[key], formats: fn(prev[key]?.formats ?? ['pdf','xlsx','jpg']) } }));
  };

  const save = async () => {
    if (!selBranch) return;
    setSaving(true);
    const res = await fetch(`/api/config/input/${selBranch.id}/${selDocType}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ fieldMappings: JSON.stringify(fields), acceptedFormats: JSON.stringify(formats) }),
    });
    setSaving(false);
    if (res.ok) {
      showToast(`Đã lưu: ${selBranch.code} / ${DOC_TYPES.find(d => d.value === selDocType)?.label} ✔️`);
      // mark as configured
      const key = cacheKey(selBranch, selDocType);
      setCache(prev => ({ ...prev, [key]: { ...(prev[key] ?? { fields, formats }), loaded: true } }));
    } else showToast('Lỗi khi lưu', false);
  };

  // Check if a branch×docType combo is configured (has non-default config)
  const isConfigured = (b: Branch, dt: string) => {
    const key = `${b.id}_${dt}`;
    return !!cache[key]?.loaded;
  };

  const configuredCount = (b: Branch) => DOC_TYPES.filter(d => isConfigured(b, d.value)).length;

  const docTypeMeta = DOC_TYPES.find(d => d.value === selDocType)!;

  return (
    <div>
      {/* Header */}
      <div className="flex items-end justify-between mb-4 gap-3">
        <div>
          <div className="text-[19px] font-extrabold" style={{ color: 'var(--t1)' }}>📁 Cấu hình Input</div>
          <div className="text-[12.5px] mt-1" style={{ color: 'var(--t2)' }}>
            Field mapping và định dạng file — theo từng Chi nhánh × Loại chứng từ
          </div>
        </div>
        <button className="ds-btn ds-btn-p ds-btn-sm" onClick={save} disabled={saving || !selBranch}>
          {saving ? 'Đang lưu...' : '💾 Lưu cấu hình'}
        </button>
      </div>

      <div className="flex gap-3" style={{ alignItems: 'flex-start' }}>

        {/* ── Left: Branch list ──────────────────────────────────────────── */}
        <div style={{ width: 200, flexShrink: 0 }}>
          <div className="ds-sec-label">Chi nhánh</div>
          {branches.length === 0 ? (
            <div className="ds-card" style={{ padding: '12px 14px', fontSize: 12, color: 'var(--t3)' }}>Chưa có chi nhánh</div>
          ) : branches.map(b => {
            const cnt = configuredCount(b);
            const active = selBranch?.id === b.id;
            return (
              <div key={b.id}
                onClick={() => setSelBranch(b)}
                className="ds-card"
                style={{
                  marginBottom: 6, cursor: 'pointer', padding: '10px 12px',
                  border: active ? '2px solid var(--fox)' : '1px solid var(--border)',
                  background: active ? 'var(--fox-lt)' : 'var(--surface)',
                }}>
                <div className="flex items-center justify-between">
                  <span style={{ fontWeight: 700, fontSize: 13, color: active ? 'var(--fox)' : 'var(--t1)' }}>
                    {b.code}
                  </span>
                  <span className={`ds-badge ${cnt === 4 ? 'ds-b-ok' : cnt > 0 ? 'ds-b-warn' : 'ds-b-gray'}`}
                    style={{ fontSize: 9.5 }}>
                    {cnt}/4
                  </span>
                </div>
                <div style={{ fontSize: 11, color: 'var(--t2)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {b.name}
                </div>
                {/* Mini doc-type status */}
                <div className="flex gap-1 mt-2">
                  {DOC_TYPES.map(d => (
                    <div key={d.value} title={d.label}
                      style={{ width: 8, height: 8, borderRadius: 2, background: isConfigured(b, d.value) ? d.color : 'var(--border)' }} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* ── Right: DocType tabs + Config ───────────────────────────────── */}
        <div className="flex-1 min-w-0">
          {!selBranch ? (
            <div className="ds-card" style={{ padding: 48, textAlign: 'center', color: 'var(--t3)' }}>
              ← Chọn chi nhánh để cấu hình
            </div>
          ) : (
            <>
              {/* Branch header */}
              <div className="ds-card mb-3" style={{ padding: '10px 14px', background: 'var(--fox-lt)', border: '1px solid rgba(255,122,0,.2)' }}>
                <div className="flex items-center gap-3">
                  <span style={{ fontSize: 20 }}>🏢</span>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 14, color: 'var(--fox)' }}>{selBranch.code} — {selBranch.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--t2)' }}>
                      {configuredCount(selBranch)}/4 loại chứng từ đã cấu hình
                    </div>
                  </div>
                </div>
              </div>

              {/* DocType tabs */}
              <div className="flex gap-2 mb-3 flex-wrap">
                {DOC_TYPES.map(d => {
                  const active = selDocType === d.value;
                  const configured = isConfigured(selBranch, d.value);
                  return (
                    <button key={d.value}
                      onClick={() => setSelDocType(d.value)}
                      style={{
                        padding: '8px 14px', borderRadius: 8, cursor: 'pointer', border: 'none',
                        background: active ? d.color : configured ? d.bg : 'var(--surface-2)',
                        color: active ? '#fff' : d.color,
                        fontWeight: 700, fontSize: 12,
                        outline: active ? `2px solid ${d.color}` : '1px solid var(--border)',
                        outlineOffset: active ? 2 : 0,
                        display: 'flex', alignItems: 'center', gap: 6,
                      }}>
                      <span>{d.icon}</span>
                      {d.label}
                      {configured && !active && <span style={{ fontSize: 10, opacity: .8 }}>✓</span>}
                    </button>
                  );
                })}
              </div>

              {/* Config content */}
              {loading ? (
                <div className="ds-card" style={{ padding: 32, textAlign: 'center', color: 'var(--t3)' }}>Đang tải...</div>
              ) : (
                <>
                  {/* Accepted formats */}
                  <div className="ds-card mb-3">
                    <div className="ds-ch">
                      <div className="ds-ch-title">
                        <div className="ds-ch-ic" style={{ background: docTypeMeta.bg }}>📎</div>
                        Định dạng file — <span style={{ color: docTypeMeta.color }}>{docTypeMeta.label}</span>
                      </div>
                    </div>
                    <div className="ds-cb">
                      <div className="flex gap-2 flex-wrap">
                        {FORMATS.map(f => (
                          <button key={f}
                            className={`ds-btn ds-btn-sm`}
                            style={formats.includes(f) ? { background: docTypeMeta.color, color: '#fff' } : { opacity: 0.5, background: 'var(--surface-2)', color: 'var(--t2)', border: '1px solid var(--border)' }}
                            onClick={() => setFormats(prev => prev.includes(f) ? prev.filter(x => x !== f) : [...prev, f])}>
                            {fmtIcon(f)} .{f.toUpperCase()}
                          </button>
                        ))}
                      </div>
                      <div className="ds-fhint mt-2">File không nằm trong danh sách sẽ bị từ chối khi upload loại <strong>{docTypeMeta.label}</strong>.</div>
                    </div>
                  </div>

                  {/* Field mapping */}
                  <div className="ds-card overflow-hidden">
                    <div className="ds-ch">
                      <div className="ds-ch-title">
                        <div className="ds-ch-ic" style={{ background: docTypeMeta.bg }}>🗂️</div>
                        Field Mapping — <span style={{ color: docTypeMeta.color }}>{docTypeMeta.label}</span>
                        <span className="ds-badge ds-b-gray ml-1">{fields.length} trường</span>
                      </div>
                      <button className="ds-btn ds-btn-s ds-btn-sm"
                        onClick={() => setFields(prev => [...prev, { systemField: `field_${Date.now()}`, docLabel: '', required: false, type: 'text' }])}>
                        + Thêm trường
                      </button>
                    </div>
                    <div style={{ overflowX: 'auto' }}>
                      <table className="ds-dt">
                        <thead>
                          <tr>
                            <th style={{ width: 32 }}>#</th>
                            <th>System Field</th>
                            <th>Nhãn trong chứng từ</th>
                            <th style={{ textAlign: 'center', width: 120 }}>Kiểu</th>
                            <th style={{ textAlign: 'center', width: 80 }}>Bắt buộc</th>
                            <th style={{ textAlign: 'center', width: 48 }}>Xoá</th>
                          </tr>
                        </thead>
                        <tbody>
                          {fields.map((f, i) => (
                            <tr key={i}>
                              <td style={{ color: 'var(--t3)', fontSize: 11 }}>{i + 1}</td>
                              <td>
                                <input className="ds-inp" value={f.systemField}
                                  onChange={e => setFields(prev => prev.map((fld, idx) => idx === i ? { ...fld, systemField: e.target.value } : fld))}
                                  style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11.5 }} />
                              </td>
                              <td>
                                <input className="ds-inp" value={f.docLabel} placeholder="Tên cột / nhãn trong file..."
                                  onChange={e => setFields(prev => prev.map((fld, idx) => idx === i ? { ...fld, docLabel: e.target.value } : fld))} />
                              </td>
                              <td style={{ textAlign: 'center' }}>
                                <select className="ds-sel" value={f.type} style={{ width: 110 }}
                                  onChange={e => setFields(prev => prev.map((fld, idx) => idx === i ? { ...fld, type: e.target.value as FieldMapping['type'] } : fld))}>
                                  <option value="text">Text</option>
                                  <option value="number">Number</option>
                                  <option value="date">Date</option>
                                  <option value="currency">Currency</option>
                                </select>
                              </td>
                              <td style={{ textAlign: 'center' }}>
                                <label className="ds-toggle">
                                  <input type="checkbox" checked={f.required}
                                    onChange={e => setFields(prev => prev.map((fld, idx) => idx === i ? { ...fld, required: e.target.checked } : fld))} />
                                  <span className="ds-tslider"></span>
                                </label>
                              </td>
                              <td style={{ textAlign: 'center' }}>
                                <button className="ds-btn ds-btn-d ds-btn-xs"
                                  onClick={() => setFields(prev => prev.filter((_, idx) => idx !== i))}>✕</button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>

      {toast && <div className="ds-toast" style={{ background: toastOk ? 'var(--ok)' : 'var(--err)' }}>{toast}</div>}
    </div>
  );
};
