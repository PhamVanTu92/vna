import React, { useEffect, useState } from 'react';

const token = () => localStorage.getItem('auth_token') ?? '';

interface FieldMapping {
  systemField: string;
  docLabel: string;
  required: boolean;
  type: 'text' | 'number' | 'date' | 'currency';
}

interface Branch { id: number; name: string; code: string; }

const DEFAULT_FIELDS: FieldMapping[] = [
  { systemField: 'invoice_number', docLabel: 'Số hóa đơn',    required: true,  type: 'text' },
  { systemField: 'date',           docLabel: 'Ngày phát hành', required: true,  type: 'date' },
  { systemField: 'vendor',         docLabel: 'Nhà cung cấp',   required: true,  type: 'text' },
  { systemField: 'amount',         docLabel: 'Tổng tiền',      required: true,  type: 'currency' },
  { systemField: 'currency',       docLabel: 'Loại tiền',      required: true,  type: 'text' },
  { systemField: 'service_period', docLabel: 'Kỳ dịch vụ',    required: false, type: 'text' },
  { systemField: 'flight_count',   docLabel: 'Số chuyến bay',  required: false, type: 'number' },
  { systemField: 'tax_code',       docLabel: 'Mã số thuế',     required: false, type: 'text' },
];

const DOC_TYPES = [
  { value: 'ground_handling', label: 'Ground Handling' },
  { value: 'airport_charges', label: 'Airport Charges' },
  { value: 'fuel',            label: 'Fuel' },
  { value: 'catering',        label: 'Catering' },
];

const FORMATS = ['pdf', 'xlsx', 'jpg', 'png', 'docx', 'xml'];

export const InputConfigPage: React.FC = () => {
  const [branches, setBranches]     = useState<Branch[]>([]);
  const [selBranch, setSelBranch]   = useState('');
  const [selDocType, setSelDocType] = useState('ground_handling');
  const [fields, setFields]         = useState<FieldMapping[]>(DEFAULT_FIELDS);
  const [formats, setFormats]       = useState<string[]>(['pdf', 'xlsx', 'jpg']);
  const [loading, setLoading]       = useState(false);
  const [saving, setSaving]         = useState(false);

  const [toast, setToast]     = useState('');
  const [toastOk, setToastOk] = useState(true);
  const showToast = (msg: string, ok = true) => { setToast(msg); setToastOk(ok); setTimeout(() => setToast(''), 3000); };

  useEffect(() => {
    fetch('/api/branches', { headers: { Authorization: `Bearer ${token()}` } })
      .then(r => r.ok ? r.json() : [])
      .then((d: Branch[]) => {
        setBranches(d ?? []);
        if (d.length > 0) setSelBranch(String(d[0].id));
      }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!selBranch) return;
    setLoading(true);
    fetch(`/api/config/input/${selBranch}/${selDocType}`, { headers: { Authorization: `Bearer ${token()}` } })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d) {
          try { setFields(JSON.parse(d.fieldMappings) || DEFAULT_FIELDS); } catch { setFields(DEFAULT_FIELDS); }
          try { setFormats(JSON.parse(d.acceptedFormats) || ['pdf', 'xlsx', 'jpg']); } catch { setFormats(['pdf', 'xlsx', 'jpg']); }
        } else {
          setFields(DEFAULT_FIELDS);
          setFormats(['pdf', 'xlsx', 'jpg']);
        }
      }).catch(() => {}).finally(() => setLoading(false));
  }, [selBranch, selDocType]);

  const save = async () => {
    if (!selBranch) return;
    setSaving(true);
    const res = await fetch(`/api/config/input/${selBranch}/${selDocType}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ fieldMappings: JSON.stringify(fields), acceptedFormats: JSON.stringify(formats) }),
    });
    setSaving(false);
    if (res.ok) showToast('Đã lưu cấu hình Input ✔️');
    else showToast('Lỗi khi lưu', false);
  };

  const toggleFormat = (f: string) => setFormats(prev => prev.includes(f) ? prev.filter(x => x !== f) : [...prev, f]);

  const updateField = (i: number, key: keyof FieldMapping, val: string | boolean) => {
    setFields(prev => prev.map((fld, idx) => idx === i ? { ...fld, [key]: val } : fld));
  };

  const addField = () => {
    setFields(prev => [...prev, { systemField: `field_${Date.now()}`, docLabel: '', required: false, type: 'text' }]);
  };

  const removeField = (i: number) => setFields(prev => prev.filter((_, idx) => idx !== i));

  return (
    <div>
      <div className="flex items-end justify-between mb-4 gap-3">
        <div>
          <div className="text-[19px] font-extrabold" style={{ color: 'var(--t1)' }}>📁 Cấu hình Input</div>
          <div className="text-[12.5px] mt-1" style={{ color: 'var(--t2)' }}>
            Định nghĩa field mapping và định dạng file cho từng loại chứng từ
          </div>
        </div>
        <button className="ds-btn ds-btn-p ds-btn-sm" onClick={save} disabled={saving || !selBranch}>
          {saving ? 'Đang lưu...' : '💾 Lưu cấu hình'}
        </button>
      </div>

      {/* Selector */}
      <div className="ds-card mb-3">
        <div className="ds-cb">
          <div className="flex gap-3 flex-wrap items-end">
            <div>
              <label className="ds-flbl">Chi nhánh (Airport)</label>
              <select className="ds-sel" value={selBranch} onChange={e => setSelBranch(e.target.value)} style={{ minWidth: 200 }}>
                {branches.map(b => <option key={b.id} value={b.id}>{b.code} — {b.name}</option>)}
              </select>
            </div>
            <div>
              <label className="ds-flbl">Loại chứng từ</label>
              <select className="ds-sel" value={selDocType} onChange={e => setSelDocType(e.target.value)} style={{ minWidth: 180 }}>
                {DOC_TYPES.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Accepted formats */}
      <div className="ds-card mb-3">
        <div className="ds-ch">
          <div className="ds-ch-title">
            <div className="ds-ch-ic" style={{ background: 'var(--info-bg)' }}>📎</div>
            Định dạng file chấp nhận
          </div>
        </div>
        <div className="ds-cb">
          <div className="flex gap-2 flex-wrap">
            {FORMATS.map(f => (
              <button key={f}
                className={`ds-btn ${formats.includes(f) ? 'ds-btn-p' : 'ds-btn-g'} ds-btn-sm`}
                onClick={() => toggleFormat(f)}
                style={formats.includes(f) ? {} : { opacity: 0.5 }}>
                {f === 'pdf' ? '📄' : f === 'xlsx' ? '📊' : f === 'jpg' || f === 'png' ? '🖼️' : f === 'docx' ? '📝' : '📋'} .{f.toUpperCase()}
              </button>
            ))}
          </div>
          <div className="ds-fhint mt-2">File không nằm trong danh sách sẽ bị từ chối khi upload.</div>
        </div>
      </div>

      {/* Field mapping */}
      <div className="ds-card overflow-hidden">
        <div className="ds-ch">
          <div className="ds-ch-title">
            <div className="ds-ch-ic" style={{ background: 'var(--fox-lt)' }}>🗂️</div>
            Field Mapping ({fields.length} trường)
          </div>
          <button className="ds-btn ds-btn-s ds-btn-sm" onClick={addField}>+ Thêm trường</button>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 32, color: 'var(--t3)' }}>Đang tải...</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="ds-dt">
              <thead>
                <tr>
                  <th style={{ width: 36 }}>#</th>
                  <th>System Field</th>
                  <th>Nhãn trong chứng từ</th>
                  <th style={{ textAlign: 'center' }}>Kiểu dữ liệu</th>
                  <th style={{ textAlign: 'center' }}>Bắt buộc</th>
                  <th style={{ textAlign: 'center', width: 48 }}>Xoá</th>
                </tr>
              </thead>
              <tbody>
                {fields.map((f, i) => (
                  <tr key={i}>
                    <td style={{ color: 'var(--t3)', fontSize: 11 }}>{i + 1}</td>
                    <td>
                      <input className="ds-inp" value={f.systemField}
                        onChange={e => updateField(i, 'systemField', e.target.value)}
                        style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11.5 }} />
                    </td>
                    <td>
                      <input className="ds-inp" value={f.docLabel} placeholder="Tên cột / nhãn trong file..."
                        onChange={e => updateField(i, 'docLabel', e.target.value)} />
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <select className="ds-sel" value={f.type} onChange={e => updateField(i, 'type', e.target.value as FieldMapping['type'])}
                        style={{ width: 110 }}>
                        <option value="text">Text</option>
                        <option value="number">Number</option>
                        <option value="date">Date</option>
                        <option value="currency">Currency</option>
                      </select>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <label className="ds-toggle">
                        <input type="checkbox" checked={f.required} onChange={e => updateField(i, 'required', e.target.checked)} />
                        <span className="ds-tslider"></span>
                      </label>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <button className="ds-btn ds-btn-d ds-btn-xs" onClick={() => removeField(i)}>✕</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {toast && (
        <div className="ds-toast" style={{ background: toastOk ? 'var(--ok)' : 'var(--err)' }}>{toast}</div>
      )}
    </div>
  );
};
