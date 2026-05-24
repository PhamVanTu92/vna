import React, { useEffect, useState } from 'react';

const token = () => localStorage.getItem('auth_token') ?? '';

interface ColMapping { col: string; field: string; label: string; enabled: boolean; }

interface Branch { id: number; name: string; code: string; }

const DEFAULT_COLS: ColMapping[] = [
  { col: 'A', field: 'invoice_number',  label: 'Số hóa đơn',       enabled: true },
  { col: 'B', field: 'date',            label: 'Ngày phát hành',    enabled: true },
  { col: 'C', field: 'vendor',          label: 'Nhà cung cấp',      enabled: true },
  { col: 'D', field: 'service_period',  label: 'Kỳ dịch vụ',       enabled: true },
  { col: 'E', field: 'ocr_amount',      label: 'Số tiền OCR',       enabled: true },
  { col: 'F', field: 'gas_amount',      label: 'Số tiền GAS',       enabled: true },
  { col: 'G', field: 'difference',      label: 'Chênh lệch',        enabled: true },
  { col: 'H', field: 'match_status',    label: 'Trạng thái',        enabled: true },
  { col: 'I', field: 'ai_confidence',   label: 'AI Confidence (%)', enabled: true },
  { col: 'J', field: 'approved_by',     label: 'Người duyệt',       enabled: false },
  { col: 'K', field: 'approved_at',     label: 'Ngày duyệt',        enabled: false },
  { col: 'L', field: 'flag_reason',     label: 'Lý do flag',        enabled: false },
];

const CURRENCY_FORMATS = ['¥ #,##0.00', '¥ #,##0', 'USD #,##0.00', '€ #,##0.00', '#,##0 VND'];
const DATE_FORMATS      = ['YYYY-MM-DD', 'DD/MM/YYYY', 'MM/DD/YYYY', 'DD-MM-YYYY'];
const SCHEDULE_TYPES    = ['daily_0200', 'daily_0600', 'weekly_mon', 'manual'];

export const OutputConfigPage: React.FC = () => {
  const [branches, setBranches]     = useState<Branch[]>([]);
  const [selBranch, setSelBranch]   = useState('');
  const [cols, setCols]             = useState<ColMapping[]>(DEFAULT_COLS);
  const [templateName, setTemplateName] = useState('CV2006_Template_VNA_v3.xlsx');
  const [startRow, setStartRow]     = useState(5);
  const [currencyFmt, setCurrencyFmt] = useState('¥ #,##0.00');
  const [dateFmt, setDateFmt]       = useState('YYYY-MM-DD');
  const [inclConf, setInclConf]     = useState(true);
  const [inclAudit, setInclAudit]   = useState(true);
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
    fetch(`/api/config/output/${selBranch}`, { headers: { Authorization: `Bearer ${token()}` } })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d) {
          setTemplateName(d.templateName ?? 'CV2006_Template_VNA_v3.xlsx');
          setStartRow(d.startRow ?? 5);
          setCurrencyFmt(d.currencyFormat ?? '¥ #,##0.00');
          setDateFmt(d.dateFormat ?? 'YYYY-MM-DD');
          setInclConf(d.includeAIConfidence ?? true);
          setInclAudit(d.includeAuditTrail ?? true);
          try { setCols(JSON.parse(d.columnMapping) || DEFAULT_COLS); } catch { setCols(DEFAULT_COLS); }
        }
      }).catch(() => {}).finally(() => setLoading(false));
  }, [selBranch]);

  const save = async () => {
    if (!selBranch) return;
    setSaving(true);
    const res = await fetch(`/api/config/output/${selBranch}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        templateName, startRow, currencyFormat: currencyFmt, dateFormat: dateFmt,
        includeAIConfidence: inclConf, includeAuditTrail: inclAudit,
        columnMapping: JSON.stringify(cols),
      }),
    });
    setSaving(false);
    if (res.ok) showToast('Đã lưu cấu hình Output ✔️');
    else showToast('Lỗi khi lưu', false);
  };

  const toggleCol = (i: number) => setCols(prev => prev.map((c, idx) => idx === i ? { ...c, enabled: !c.enabled } : c));
  const updateLabel = (i: number, val: string) => setCols(prev => prev.map((c, idx) => idx === i ? { ...c, label: val } : c));

  return (
    <div>
      <div className="flex items-end justify-between mb-4 gap-3">
        <div>
          <div className="text-[19px] font-extrabold" style={{ color: 'var(--t1)' }}>📤 Cấu hình Output</div>
          <div className="text-[12.5px] mt-1" style={{ color: 'var(--t2)' }}>
            Định dạng file Excel xuất, mapping cột và tuỳ chọn bao gồm
          </div>
        </div>
        <div className="flex gap-2">
          <select className="ds-fsel" value={selBranch} onChange={e => setSelBranch(e.target.value)}>
            {branches.map(b => <option key={b.id} value={b.id}>{b.code} — {b.name}</option>)}
          </select>
          <button className="ds-btn ds-btn-p ds-btn-sm" onClick={save} disabled={saving || !selBranch}>
            {saving ? 'Đang lưu...' : '💾 Lưu'}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="ds-card" style={{ padding: 32, textAlign: 'center', color: 'var(--t3)' }}>Đang tải...</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {/* Excel settings */}
          <div className="ds-card">
            <div className="ds-ch">
              <div className="ds-ch-title">
                <div className="ds-ch-ic" style={{ background: '#EDFFF7' }}>📊</div>
                Cài đặt Excel
              </div>
            </div>
            <div className="ds-cb">
              <div className="ds-fgrp">
                <label className="ds-flbl">Template file</label>
                <input className="ds-inp" value={templateName} onChange={e => setTemplateName(e.target.value)}
                  placeholder="CV2006_Template_VNA_v3.xlsx" />
                <div className="ds-fhint">Tên file template trong thư mục templates/</div>
              </div>
              <div className="ds-fgrp">
                <label className="ds-flbl">Bắt đầu từ dòng</label>
                <input className="ds-inp" type="number" min={1} max={50} value={startRow}
                  onChange={e => setStartRow(Number(e.target.value))} style={{ width: 100 }} />
                <div className="ds-fhint">Dòng đầu tiên ghi dữ liệu (ví dụ: 5 = sau 4 dòng header)</div>
              </div>
              <div className="ds-fgrp">
                <label className="ds-flbl">Định dạng tiền tệ</label>
                <select className="ds-sel" value={currencyFmt} onChange={e => setCurrencyFmt(e.target.value)}>
                  {CURRENCY_FORMATS.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
              </div>
              <div className="ds-fgrp">
                <label className="ds-flbl">Định dạng ngày</label>
                <select className="ds-sel" value={dateFmt} onChange={e => setDateFmt(e.target.value)}>
                  {DATE_FORMATS.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
              </div>
              <div className="ds-dvd"></div>
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 12.5, color: 'var(--t1)' }}>Bao gồm AI Confidence</div>
                    <div style={{ fontSize: 11.5, color: 'var(--t2)' }}>Thêm cột điểm tin cậy OCR</div>
                  </div>
                  <label className="ds-toggle">
                    <input type="checkbox" checked={inclConf} onChange={e => setInclConf(e.target.checked)} />
                    <span className="ds-tslider"></span>
                  </label>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 12.5, color: 'var(--t1)' }}>Bao gồm Audit Trail</div>
                    <div style={{ fontSize: 11.5, color: 'var(--t2)' }}>Thêm sheet lịch sử thao tác</div>
                  </div>
                  <label className="ds-toggle">
                    <input type="checkbox" checked={inclAudit} onChange={e => setInclAudit(e.target.checked)} />
                    <span className="ds-tslider"></span>
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* Column mapping */}
          <div className="ds-card overflow-hidden">
            <div className="ds-ch">
              <div className="ds-ch-title">
                <div className="ds-ch-ic" style={{ background: 'var(--fox-lt)' }}>🗂️</div>
                Mapping cột Excel
              </div>
              <span className="ds-badge ds-b-ok">{cols.filter(c => c.enabled).length} cột active</span>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table className="ds-dt">
                <thead>
                  <tr>
                    <th style={{ textAlign: 'center' }}>Cột</th>
                    <th>Field</th>
                    <th>Nhãn cột Excel</th>
                    <th style={{ textAlign: 'center' }}>Bật</th>
                  </tr>
                </thead>
                <tbody>
                  {cols.map((c, i) => (
                    <tr key={i} style={!c.enabled ? { opacity: 0.45 } : {}}>
                      <td style={{ textAlign: 'center' }}>
                        <span className="ds-mono ds-badge ds-b-gray">{c.col}</span>
                      </td>
                      <td>
                        <span className="ds-mono" style={{ fontSize: 11, color: 'var(--t2)' }}>{c.field}</span>
                      </td>
                      <td>
                        <input className="ds-inp" value={c.label} disabled={!c.enabled}
                          onChange={e => updateLabel(i, e.target.value)} />
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <label className="ds-toggle">
                          <input type="checkbox" checked={c.enabled} onChange={() => toggleCol(i)} />
                          <span className="ds-tslider"></span>
                        </label>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="ds-toast" style={{ background: toastOk ? 'var(--ok)' : 'var(--err)' }}>{toast}</div>
      )}
    </div>
  );
};
