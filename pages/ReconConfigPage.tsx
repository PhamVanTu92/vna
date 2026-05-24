import React, { useEffect, useState } from 'react';

const token = () => localStorage.getItem('auth_token') ?? '';

interface Branch { id: number; name: string; code: string; }

const MATCH_KEY_OPTIONS = [
  { key: 'invoice_number', label: 'Số hóa đơn' },
  { key: 'vendor',         label: 'Nhà cung cấp' },
  { key: 'period',         label: 'Kỳ dịch vụ' },
  { key: 'amount',         label: 'Số tiền' },
  { key: 'flight_number',  label: 'Số hiệu chuyến bay' },
  { key: 'tax_code',       label: 'Mã số thuế' },
];

const ON_NOT_FOUND_OPTIONS = [
  { value: 'mark_new',    label: 'Đánh dấu Mới — chờ xử lý thủ công' },
  { value: 'auto_draft',  label: 'Tạo bản nháp GAS tự động' },
  { value: 'email_admin', label: 'Gửi email cảnh báo cho Admin' },
];

const SCHEDULE_OPTIONS = [
  { value: 'daily_0200',  label: '⏰ Hàng ngày lúc 02:00' },
  { value: 'daily_0600',  label: '⏰ Hàng ngày lúc 06:00' },
  { value: 'weekly_mon',  label: '📅 Hàng tuần (Thứ Hai)' },
  { value: 'manual',      label: '🤚 Thủ công (không tự động)' },
];

const CONF_THRESHOLDS = [99.0, 97.0, 95.0, 90.0, 85.0];

export const ReconConfigPage: React.FC = () => {
  const [branches, setBranches]     = useState<Branch[]>([]);
  const [selBranch, setSelBranch]   = useState('');
  const [matchKeys, setMatchKeys]   = useState<string[]>(['invoice_number', 'vendor', 'period']);
  const [tolPct, setTolPct]         = useState(0.5);
  const [tolAmt, setTolAmt]         = useState(1000);
  const [onNotFound, setOnNotFound] = useState('mark_new');
  const [autoApprConf, setAutoApprConf] = useState(99.0);
  const [autoAfterOcr, setAutoAfterOcr] = useState(true);
  const [scheduleBatch, setScheduleBatch] = useState(true);
  const [scheduleType, setScheduleType]   = useState('daily_0200');
  const [maxTimeout, setMaxTimeout] = useState(30);
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
    fetch(`/api/config/recon/${selBranch}`, { headers: { Authorization: `Bearer ${token()}` } })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d) {
          try { setMatchKeys(JSON.parse(d.matchKeys) || ['invoice_number', 'vendor', 'period']); } catch {}
          setTolPct(d.tolerancePct ?? 0.5);
          setTolAmt(d.toleranceAmt ?? 1000);
          setOnNotFound(d.onNotFound ?? 'mark_new');
          setAutoApprConf(d.autoApproveConf ?? 99.0);
          setAutoAfterOcr(d.autoAfterOcr ?? true);
          setScheduleBatch(d.scheduleBatch ?? true);
          setScheduleType(d.scheduleType ?? 'daily_0200');
          setMaxTimeout(d.maxTimeoutSec ?? 30);
        }
      }).catch(() => {}).finally(() => setLoading(false));
  }, [selBranch]);

  const save = async () => {
    if (!selBranch) return;
    setSaving(true);
    const res = await fetch(`/api/config/recon/${selBranch}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        matchKeys: JSON.stringify(matchKeys),
        tolerancePct: tolPct,
        toleranceAmt: tolAmt,
        onNotFound,
        autoApproveConf: autoApprConf,
        autoAfterOcr,
        scheduleBatch,
        scheduleType,
        maxTimeoutSec: maxTimeout,
      }),
    });
    setSaving(false);
    if (res.ok) showToast('Đã lưu cấu hình Đối soát ✔️');
    else showToast('Lỗi khi lưu', false);
  };

  const toggleKey = (k: string) => setMatchKeys(prev => prev.includes(k) ? prev.filter(x => x !== k) : [...prev, k]);

  return (
    <div>
      <div className="flex items-end justify-between mb-4 gap-3">
        <div>
          <div className="text-[19px] font-extrabold" style={{ color: 'var(--t1)' }}>⚙️ Cấu hình Đối soát</div>
          <div className="text-[12.5px] mt-1" style={{ color: 'var(--t2)' }}>
            Thiết lập quy tắc matching, ngưỡng sai số và lịch xử lý tự động
          </div>
        </div>
        <div className="flex gap-2">
          <select className="ds-fsel" value={selBranch} onChange={e => setSelBranch(e.target.value)}>
            {branches.map(b => <option key={b.id} value={b.id}>{b.code} — {b.name}</option>)}
          </select>
          <button className="ds-btn ds-btn-p ds-btn-sm" onClick={save} disabled={saving || !selBranch}>
            {saving ? 'Đang lưu...' : '💾 Lưu cấu hình'}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="ds-card" style={{ padding: 32, textAlign: 'center', color: 'var(--t3)' }}>Đang tải...</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">

          {/* Match keys */}
          <div className="ds-card">
            <div className="ds-ch">
              <div className="ds-ch-title">
                <div className="ds-ch-ic" style={{ background: 'var(--info-bg)' }}>🔑</div>
                Khoá đối soát (Match Keys)
              </div>
              <span className="ds-badge ds-b-info">{matchKeys.length} keys</span>
            </div>
            <div className="ds-cb">
              <div style={{ fontSize: 12, color: 'var(--t2)', marginBottom: 12 }}>
                Chọn các trường dùng để xác định cặp chứng từ trùng khớp:
              </div>
              <div className="flex flex-col gap-2">
                {MATCH_KEY_OPTIONS.map(opt => (
                  <label key={opt.key} className="flex items-center gap-2 cursor-pointer"
                    style={{ padding: '7px 10px', borderRadius: 6, background: matchKeys.includes(opt.key) ? 'var(--fox-lt)' : 'var(--surface-2)', border: `1px solid ${matchKeys.includes(opt.key) ? 'rgba(255,122,0,.3)' : 'var(--border)'}` }}>
                    <input type="checkbox" checked={matchKeys.includes(opt.key)} onChange={() => toggleKey(opt.key)} />
                    <span style={{ fontSize: 12.5, fontWeight: 600, color: matchKeys.includes(opt.key) ? 'var(--fox)' : 'var(--t1)' }}>
                      {opt.label}
                    </span>
                    <span className="ds-mono text-[10.5px] ml-auto" style={{ color: 'var(--t3)' }}>{opt.key}</span>
                  </label>
                ))}
              </div>
              <div className="ds-fhint mt-3">Khuyến nghị: luôn bao gồm invoice_number + vendor</div>
            </div>
          </div>

          {/* Tolerance */}
          <div className="ds-card">
            <div className="ds-ch">
              <div className="ds-ch-title">
                <div className="ds-ch-ic" style={{ background: 'var(--warn-bg)' }}>📏</div>
                Ngưỡng sai số
              </div>
            </div>
            <div className="ds-cb">
              <div className="ds-fgrp">
                <label className="ds-flbl">Sai số % (mismatch_minor)</label>
                <div className="flex items-center gap-2">
                  <input className="ds-inp" type="number" step="0.1" min={0} max={20} value={tolPct}
                    onChange={e => setTolPct(Number(e.target.value))} style={{ width: 100 }} />
                  <span style={{ fontSize: 12, color: 'var(--t2)' }}>%</span>
                </div>
                <div className="ds-fhint">Chênh lệch ≤ {tolPct}% → minor mismatch</div>
              </div>
              <div className="ds-fgrp">
                <label className="ds-flbl">Sai số cố định (mismatch_minor)</label>
                <div className="flex items-center gap-2">
                  <input className="ds-inp" type="number" step="100" min={0} value={tolAmt}
                    onChange={e => setTolAmt(Number(e.target.value))} style={{ width: 120 }} />
                  <span style={{ fontSize: 12, color: 'var(--t2)' }}>JPY</span>
                </div>
                <div className="ds-fhint">Chênh lệch ≤ ¥{tolAmt.toLocaleString()} → minor mismatch</div>
              </div>
              <div className="ds-dvd"></div>
              <div className="ds-fgrp">
                <label className="ds-flbl">Khi không tìm thấy cặp GAS</label>
                <select className="ds-sel" value={onNotFound} onChange={e => setOnNotFound(e.target.value)}>
                  {ON_NOT_FOUND_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div className="ds-fgrp">
                <label className="ds-flbl">Timeout xử lý</label>
                <div className="flex items-center gap-2">
                  <input className="ds-inp" type="number" min={10} max={300} value={maxTimeout}
                    onChange={e => setMaxTimeout(Number(e.target.value))} style={{ width: 100 }} />
                  <span style={{ fontSize: 12, color: 'var(--t2)' }}>giây</span>
                </div>
              </div>
            </div>
          </div>

          {/* Auto approve */}
          <div className="ds-card">
            <div className="ds-ch">
              <div className="ds-ch-title">
                <div className="ds-ch-ic" style={{ background: 'var(--ok-bg)' }}>🤖</div>
                Tự động duyệt (AI Auto-Approve)
              </div>
            </div>
            <div className="ds-cb">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div style={{ fontWeight: 700, fontSize: 12.5, color: 'var(--t1)' }}>Tự động đối soát sau OCR</div>
                  <div style={{ fontSize: 11.5, color: 'var(--t2)' }}>Chạy matching ngay khi OCR hoàn thành</div>
                </div>
                <label className="ds-toggle">
                  <input type="checkbox" checked={autoAfterOcr} onChange={e => setAutoAfterOcr(e.target.checked)} />
                  <span className="ds-tslider"></span>
                </label>
              </div>
              <div className="ds-fgrp">
                <label className="ds-flbl">Ngưỡng tự động duyệt (%)</label>
                <select className="ds-sel" value={autoApprConf} onChange={e => setAutoApprConf(Number(e.target.value))}>
                  {CONF_THRESHOLDS.map(t => (
                    <option key={t} value={t}>≥ {t}% confidence — {t >= 99 ? 'cực an toàn' : t >= 97 ? 'rất an toàn' : t >= 95 ? 'an toàn' : t >= 90 ? 'vừa phải' : 'rộng rãi'}</option>
                  ))}
                </select>
                <div className="ds-fhint">Kết quả khớp có độ tin cậy ≥ {autoApprConf}% sẽ tự động duyệt</div>
              </div>
              <div className="ds-card" style={{ padding: '10px 14px', background: 'var(--fox-lt)', border: '1px solid rgba(255,122,0,.2)' }}>
                <div style={{ fontSize: 12, color: 'var(--fox)', fontWeight: 700 }}>⚠️ Lưu ý</div>
                <div style={{ fontSize: 11.5, color: 'var(--t2)', marginTop: 4 }}>
                  Ngưỡng thấp hơn sẽ tự động duyệt nhiều hơn nhưng tăng rủi ro bỏ sót chênh lệch.
                  Khuyến nghị dùng ≥ 97% cho chứng từ có giá trị cao.
                </div>
              </div>
            </div>
          </div>

          {/* Schedule */}
          <div className="ds-card">
            <div className="ds-ch">
              <div className="ds-ch-title">
                <div className="ds-ch-ic" style={{ background: 'var(--ai-bg)' }}>⏰</div>
                Lịch xử lý Batch
              </div>
            </div>
            <div className="ds-cb">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div style={{ fontWeight: 700, fontSize: 12.5, color: 'var(--t1)' }}>Bật lịch xử lý tự động</div>
                  <div style={{ fontSize: 11.5, color: 'var(--t2)' }}>AI batch chạy theo lịch định sẵn</div>
                </div>
                <label className="ds-toggle">
                  <input type="checkbox" checked={scheduleBatch} onChange={e => setScheduleBatch(e.target.checked)} />
                  <span className="ds-tslider"></span>
                </label>
              </div>
              {scheduleBatch && (
                <div className="ds-fgrp">
                  <label className="ds-flbl">Lịch batch</label>
                  <div className="flex flex-col gap-2">
                    {SCHEDULE_OPTIONS.map(o => (
                      <label key={o.value} className="flex items-center gap-2 cursor-pointer"
                        style={{ padding: '8px 10px', borderRadius: 6, background: scheduleType === o.value ? 'var(--ai-bg)' : 'var(--surface-2)', border: `1px solid ${scheduleType === o.value ? 'rgba(124,58,237,.3)' : 'var(--border)'}` }}>
                        <input type="radio" name="scheduleType" value={o.value} checked={scheduleType === o.value}
                          onChange={() => setScheduleType(o.value)} />
                        <span style={{ fontSize: 12.5, fontWeight: 600, color: scheduleType === o.value ? 'var(--ai)' : 'var(--t1)' }}>
                          {o.label}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
              {!scheduleBatch && (
                <div style={{ padding: '12px 14px', background: 'var(--surface-2)', borderRadius: 8, fontSize: 12.5, color: 'var(--t2)' }}>
                  Lịch batch đã tắt. Đối soát chỉ chạy khi được kích hoạt thủ công.
                </div>
              )}
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
