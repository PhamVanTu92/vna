import React, { useEffect, useState } from 'react';

const token = () => localStorage.getItem('auth_token') ?? '';

interface ColMapping { col: string; field: string; label: string; enabled: boolean; }
interface Branch { id: number; name: string; code: string; }

// Default columns per doc type (different fields relevant to each)
const COLS_BY_DOCTYPE: Record<string, ColMapping[]> = {
  _common: [
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
  ],
  ground_handling: [
    { col: 'A', field: 'invoice_number',  label: 'Số hóa đơn',       enabled: true },
    { col: 'B', field: 'date',            label: 'Ngày phát hành',    enabled: true },
    { col: 'C', field: 'vendor',          label: 'Đại lý Ground',     enabled: true },
    { col: 'D', field: 'flight_count',    label: 'Số chuyến bay',     enabled: true },
    { col: 'E', field: 'service_period',  label: 'Kỳ dịch vụ',       enabled: true },
    { col: 'F', field: 'ocr_amount',      label: 'Phí OCR (JPY)',     enabled: true },
    { col: 'G', field: 'gas_amount',      label: 'Phí GAS (JPY)',     enabled: true },
    { col: 'H', field: 'difference',      label: 'Chênh lệch',        enabled: true },
    { col: 'I', field: 'match_status',    label: 'Kết quả',           enabled: true },
    { col: 'J', field: 'ai_confidence',   label: 'AI Conf %',         enabled: true },
  ],
  fuel: [
    { col: 'A', field: 'invoice_number',  label: 'Số hóa đơn',       enabled: true },
    { col: 'B', field: 'date',            label: 'Ngày',              enabled: true },
    { col: 'C', field: 'vendor',          label: 'Nhà cung cấp xăng', enabled: true },
    { col: 'D', field: 'fuel_volume',     label: 'Khối lượng (L)',    enabled: true },
    { col: 'E', field: 'unit_price',      label: 'Đơn giá',           enabled: true },
    { col: 'F', field: 'ocr_amount',      label: 'Thành tiền OCR',    enabled: true },
    { col: 'G', field: 'gas_amount',      label: 'Thành tiền GAS',    enabled: true },
    { col: 'H', field: 'difference',      label: 'Chênh lệch',        enabled: true },
    { col: 'I', field: 'match_status',    label: 'Kết quả',           enabled: true },
  ],
};

const getDefaultCols = (dt: string) => COLS_BY_DOCTYPE[dt] ?? COLS_BY_DOCTYPE['_common'];

const DOC_TYPES = [
  { value: 'ground_handling', label: 'Ground Handling', icon: '✈️', color: '#5B21B6', bg: '#EDE9FE' },
  { value: 'airport_charges', label: 'Airport Charges',  icon: '🏢', color: '#1E40AF', bg: '#DBEAFE' },
  { value: 'fuel',            label: 'Fuel',             icon: '⛽', color: '#92400E', bg: '#FEF3C7' },
  { value: 'catering',        label: 'Catering',         icon: '🍱', color: '#166534', bg: '#DCFCE7' },
];
const CURRENCY_FORMATS = ['¥ #,##0.00', '¥ #,##0', 'USD #,##0.00', '€ #,##0.00', '#,##0 VND'];
const DATE_FORMATS      = ['YYYY-MM-DD', 'DD/MM/YYYY', 'MM/DD/YYYY', 'DD-MM-YYYY'];

interface BranchConfig {
  templateName: string; startRow: number; currencyFormat: string; dateFormat: string;
  includeAIConfidence: boolean; includeAuditTrail: boolean;
  columnMapping: Record<string, ColMapping[]>; // per docType
  loaded: boolean;
}

const DEFAULT_CFG = (): BranchConfig => ({
  templateName: 'CV2006_Template_VNA_v3.xlsx', startRow: 5,
  currencyFormat: '¥ #,##0.00', dateFormat: 'YYYY-MM-DD',
  includeAIConfidence: true, includeAuditTrail: true,
  columnMapping: Object.fromEntries(DOC_TYPES.map(d => [d.value, getDefaultCols(d.value)])),
  loaded: false,
});

export const OutputConfigPage: React.FC = () => {
  const [branches, setBranches]       = useState<Branch[]>([]);
  const [selBranch, setSelBranch]     = useState<Branch | null>(null);
  const [selDocType, setSelDocType]   = useState(DOC_TYPES[0].value);
  const [cfgMap, setCfgMap]           = useState<Record<number, BranchConfig>>({});
  const [loading, setLoading]         = useState(false);
  const [saving, setSaving]           = useState(false);

  const [toast, setToast]     = useState('');
  const [toastOk, setToastOk] = useState(true);
  const showToast = (msg: string, ok = true) => { setToast(msg); setToastOk(ok); setTimeout(() => setToast(''), 3000); };

  useEffect(() => {
    fetch('/api/admin/branches', { headers: { Authorization: `Bearer ${token()}` } })
      .then(r => r.ok ? r.json() : [])
      .then((d: Branch[]) => { setBranches(d ?? []); if (d.length > 0) setSelBranch(d[0]); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!selBranch) return;
    if (cfgMap[selBranch.id]?.loaded) return;
    setLoading(true);
    fetch(`/api/config/output/${selBranch.id}`, { headers: { Authorization: `Bearer ${token()}` } })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        const cfg = DEFAULT_CFG();
        if (d) {
          cfg.templateName = d.templateName ?? cfg.templateName;
          cfg.startRow = d.startRow ?? cfg.startRow;
          cfg.currencyFormat = d.currencyFormat ?? cfg.currencyFormat;
          cfg.dateFormat = d.dateFormat ?? cfg.dateFormat;
          cfg.includeAIConfidence = d.includeAIConfidence ?? true;
          cfg.includeAuditTrail = d.includeAuditTrail ?? true;
          try {
            const saved: ColMapping[] = JSON.parse(d.columnMapping) || [];
            if (saved.length > 0) {
              // Store under current docType if no per-type saved
              cfg.columnMapping['_common'] = saved;
              DOC_TYPES.forEach(dt => { cfg.columnMapping[dt.value] = saved; });
            }
          } catch {}
        }
        cfg.loaded = true;
        setCfgMap(prev => ({ ...prev, [selBranch.id]: cfg }));
      }).catch(() => {}).finally(() => setLoading(false));
  }, [selBranch]);

  const cfg = selBranch ? (cfgMap[selBranch.id] ?? DEFAULT_CFG()) : DEFAULT_CFG();
  const cols = cfg.columnMapping[selDocType] ?? getDefaultCols(selDocType);

  const updateCfg = (fn: (c: BranchConfig) => BranchConfig) => {
    if (!selBranch) return;
    setCfgMap(prev => ({ ...prev, [selBranch.id]: fn(prev[selBranch.id] ?? DEFAULT_CFG()) }));
  };
  const setCols = (newCols: ColMapping[]) => {
    updateCfg(c => ({ ...c, columnMapping: { ...c.columnMapping, [selDocType]: newCols } }));
  };

  const save = async () => {
    if (!selBranch) return;
    setSaving(true);
    // Flatten all columnMappings into array (save all docTypes)
    const allCols = cols; // save current docType's cols
    const res = await fetch(`/api/config/output/${selBranch.id}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        templateName: cfg.templateName, startRow: cfg.startRow,
        currencyFormat: cfg.currencyFormat, dateFormat: cfg.dateFormat,
        includeAIConfidence: cfg.includeAIConfidence, includeAuditTrail: cfg.includeAuditTrail,
        columnMapping: JSON.stringify(allCols),
      }),
    });
    setSaving(false);
    if (res.ok) showToast(`Đã lưu: ${selBranch.code} ✔️`);
    else showToast('Lỗi khi lưu', false);
  };

  const docTypeMeta = DOC_TYPES.find(d => d.value === selDocType)!;

  return (
    <div>
      {/* Header */}
      <div className="flex items-end justify-between mb-4 gap-3">
        <div>
          <div className="text-[19px] font-extrabold" style={{ color: 'var(--t1)' }}>📤 Cấu hình Output</div>
          <div className="text-[12.5px] mt-1" style={{ color: 'var(--t2)' }}>
            Template Excel, mapping cột xuất — theo từng Chi nhánh × Loại chứng từ
          </div>
        </div>
        <button className="ds-btn ds-btn-p ds-btn-sm" onClick={save} disabled={saving || !selBranch}>
          {saving ? 'Đang lưu...' : '💾 Lưu cấu hình'}
        </button>
      </div>

      <div className="flex gap-3" style={{ alignItems: 'flex-start' }}>

        {/* ── Left: Branch list ──────────────────────────────── */}
        <div style={{ width: 200, flexShrink: 0 }}>
          <div className="ds-sec-label">Chi nhánh</div>
          {branches.map(b => {
            const active = selBranch?.id === b.id;
            const loaded = !!cfgMap[b.id]?.loaded;
            return (
              <div key={b.id} onClick={() => setSelBranch(b)} className="ds-card"
                style={{ marginBottom: 6, cursor: 'pointer', padding: '10px 12px',
                  border: active ? '2px solid var(--fox)' : '1px solid var(--border)',
                  background: active ? 'var(--fox-lt)' : 'var(--surface)' }}>
                <div className="flex items-center justify-between">
                  <span style={{ fontWeight: 700, fontSize: 13, color: active ? 'var(--fox)' : 'var(--t1)' }}>{b.code}</span>
                  <span className={`ds-badge ${loaded ? 'ds-b-ok' : 'ds-b-gray'}`} style={{ fontSize: 9.5 }}>
                    {loaded ? '✓' : '○'}
                  </span>
                </div>
                <div style={{ fontSize: 11, color: 'var(--t2)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {b.name}
                </div>
              </div>
            );
          })}
        </div>

        {/* ── Right panel ────────────────────────────────────── */}
        <div className="flex-1 min-w-0">
          {!selBranch ? (
            <div className="ds-card" style={{ padding: 48, textAlign: 'center', color: 'var(--t3)' }}>
              ← Chọn chi nhánh để cấu hình
            </div>
          ) : loading ? (
            <div className="ds-card" style={{ padding: 32, textAlign: 'center', color: 'var(--t3)' }}>Đang tải...</div>
          ) : (
            <>
              {/* Branch header */}
              <div className="ds-card mb-3" style={{ padding: '10px 14px', background: 'var(--fox-lt)', border: '1px solid rgba(255,122,0,.2)' }}>
                <div style={{ fontWeight: 800, fontSize: 14, color: 'var(--fox)' }}>{selBranch.code} — {selBranch.name}</div>
                <div style={{ fontSize: 11, color: 'var(--t2)', marginTop: 2 }}>
                  Cài đặt chung áp dụng cho tất cả loại chứng từ · Mapping cột theo từng loại
                </div>
              </div>

              {/* Excel general settings */}
              <div className="ds-card mb-3">
                <div className="ds-ch">
                  <div className="ds-ch-title"><div className="ds-ch-ic" style={{ background: '#EDFFF7' }}>📊</div>Cài đặt Excel chung</div>
                </div>
                <div className="ds-cb">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="ds-fgrp">
                      <label className="ds-flbl">Template file</label>
                      <input className="ds-inp" value={cfg.templateName}
                        onChange={e => updateCfg(c => ({ ...c, templateName: e.target.value }))}
                        placeholder="CV2006_Template_VNA_v3.xlsx" />
                    </div>
                    <div className="ds-fgrp">
                      <label className="ds-flbl">Bắt đầu từ dòng</label>
                      <input className="ds-inp" type="number" min={1} max={50} value={cfg.startRow}
                        onChange={e => updateCfg(c => ({ ...c, startRow: Number(e.target.value) }))}
                        style={{ width: 80 }} />
                    </div>
                    <div className="ds-fgrp">
                      <label className="ds-flbl">Định dạng tiền tệ</label>
                      <select className="ds-sel" value={cfg.currencyFormat}
                        onChange={e => updateCfg(c => ({ ...c, currencyFormat: e.target.value }))}>
                        {CURRENCY_FORMATS.map(f => <option key={f} value={f}>{f}</option>)}
                      </select>
                    </div>
                    <div className="ds-fgrp">
                      <label className="ds-flbl">Định dạng ngày</label>
                      <select className="ds-sel" value={cfg.dateFormat}
                        onChange={e => updateCfg(c => ({ ...c, dateFormat: e.target.value }))}>
                        {DATE_FORMATS.map(f => <option key={f} value={f}>{f}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="flex gap-6 mt-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <label className="ds-toggle">
                        <input type="checkbox" checked={cfg.includeAIConfidence}
                          onChange={e => updateCfg(c => ({ ...c, includeAIConfidence: e.target.checked }))} />
                        <span className="ds-tslider"></span>
                      </label>
                      <span style={{ fontSize: 12, fontWeight: 600 }}>Bao gồm AI Confidence</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <label className="ds-toggle">
                        <input type="checkbox" checked={cfg.includeAuditTrail}
                          onChange={e => updateCfg(c => ({ ...c, includeAuditTrail: e.target.checked }))} />
                        <span className="ds-tslider"></span>
                      </label>
                      <span style={{ fontSize: 12, fontWeight: 600 }}>Bao gồm Audit Trail</span>
                    </label>
                  </div>
                </div>
              </div>

              {/* DocType tabs for column mapping */}
              <div className="flex gap-2 mb-2 flex-wrap">
                {DOC_TYPES.map(d => {
                  const active = selDocType === d.value;
                  return (
                    <button key={d.value} onClick={() => setSelDocType(d.value)}
                      style={{ padding: '7px 13px', borderRadius: 7, cursor: 'pointer', border: 'none', fontWeight: 700, fontSize: 12,
                        background: active ? d.color : d.bg, color: active ? '#fff' : d.color,
                        outline: active ? `2px solid ${d.color}` : '1px solid var(--border)', outlineOffset: active ? 2 : 0 }}>
                      {d.icon} {d.label}
                    </button>
                  );
                })}
              </div>

              {/* Column mapping for selected docType */}
              <div className="ds-card overflow-hidden">
                <div className="ds-ch">
                  <div className="ds-ch-title">
                    <div className="ds-ch-ic" style={{ background: docTypeMeta.bg }}>🗂️</div>
                    Mapping cột — <span style={{ color: docTypeMeta.color }}>{docTypeMeta.label}</span>
                  </div>
                  <span className="ds-badge ds-b-ok">{cols.filter(c => c.enabled).length} cột bật</span>
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table className="ds-dt">
                    <thead>
                      <tr>
                        <th style={{ textAlign: 'center', width: 50 }}>Cột</th>
                        <th>Field</th>
                        <th>Nhãn cột Excel</th>
                        <th style={{ textAlign: 'center', width: 60 }}>Bật</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cols.map((c, i) => (
                        <tr key={i} style={!c.enabled ? { opacity: 0.4 } : {}}>
                          <td style={{ textAlign: 'center' }}><span className="ds-mono ds-badge ds-b-gray">{c.col}</span></td>
                          <td><span className="ds-mono" style={{ fontSize: 11, color: 'var(--t2)' }}>{c.field}</span></td>
                          <td>
                            <input className="ds-inp" value={c.label} disabled={!c.enabled}
                              onChange={e => setCols(cols.map((col, ci) => ci === i ? { ...col, label: e.target.value } : col))} />
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <label className="ds-toggle">
                              <input type="checkbox" checked={c.enabled}
                                onChange={() => setCols(cols.map((col, ci) => ci === i ? { ...col, enabled: !col.enabled } : col))} />
                              <span className="ds-tslider"></span>
                            </label>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {toast && <div className="ds-toast" style={{ background: toastOk ? 'var(--ok)' : 'var(--err)' }}>{toast}</div>}
    </div>
  );
};
