import React, { useEffect, useState } from 'react';

const token = () => localStorage.getItem('auth_token') ?? '';

interface Integration {
  id: number;
  name: string;
  displayName: string;
  isActive: boolean;
  config: string;
  lastSyncAt: string | null;
}

const INT_META: Record<string, { icon: string; bg: string; desc: string; fields: { key: string; label: string; type: string; placeholder: string }[] }> = {
  gas_oracle: {
    icon: '🗄️',
    bg: '#EFF6FF',
    desc: 'Oracle EBS — Hệ thống tài chính GAS Oracle EBS. Đồng bộ dữ liệu hóa đơn và thanh toán.',
    fields: [
      { key: 'url', label: 'URL kết nối', type: 'text', placeholder: 'http://gas-oracle:8080/api' },
      { key: 'username', label: 'Username', type: 'text', placeholder: 'VNA_USER' },
      { key: 'password', label: 'Password', type: 'password', placeholder: '••••••••' },
      { key: 'dbInstance', label: 'DB Instance', type: 'text', placeholder: 'PROD_DB' },
    ],
  },
  payment_system: {
    icon: '💳',
    bg: '#F5F3FF',
    desc: 'Payment Request System — Hệ thống yêu cầu thanh toán nội bộ VNA.',
    fields: [
      { key: 'url', label: 'API Endpoint', type: 'text', placeholder: 'https://payment.vna.vn/api/v2' },
      { key: 'apiKey', label: 'API Key', type: 'password', placeholder: 'pk_live_...' },
      { key: 'timeout', label: 'Timeout (ms)', type: 'number', placeholder: '30000' },
    ],
  },
  smtp: {
    icon: '📧',
    bg: '#EDFFF7',
    desc: 'Email thông báo — Gửi cảnh báo chênh lệch và báo cáo định kỳ qua email.',
    fields: [
      { key: 'host', label: 'SMTP Host', type: 'text', placeholder: 'smtp.gmail.com' },
      { key: 'port', label: 'Port', type: 'number', placeholder: '587' },
      { key: 'user', label: 'Email', type: 'email', placeholder: 'noreply@foxai.com.vn' },
      { key: 'pass', label: 'App Password', type: 'password', placeholder: '••••••••' },
    ],
  },
  teams: {
    icon: '💬',
    bg: '#FFF0E0',
    desc: 'Microsoft Teams — Gửi thông báo tức thời về trạng thái đối soát vào channel Teams.',
    fields: [
      { key: 'webhookUrl', label: 'Webhook URL', type: 'text', placeholder: 'https://outlook.office.com/webhook/...' },
      { key: 'channel', label: 'Channel', type: 'text', placeholder: '#vna-reconcile-alerts' },
    ],
  },
};

const WEBHOOK_DEMO = [
  { event: 'reconcile.mismatch_major', url: 'https://hooks.teams.com/xyz123', status: 'active', lastCall: '2 phút trước' },
  { event: 'ocr.completed',            url: 'https://payment.vna.vn/webhook/ocr', status: 'active', lastCall: '15 phút trước' },
  { event: 'batch.approved',           url: 'https://gas-oracle:8080/notify', status: 'error', lastCall: '1 giờ trước' },
];

export const IntegrationPage: React.FC = () => {
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading]           = useState(true);
  const [editId, setEditId]             = useState<string | null>(null);
  const [editCfg, setEditCfg]           = useState<Record<string, string>>({});
  const [editActive, setEditActive]     = useState(false);
  const [saving, setSaving]             = useState(false);
  const [testing, setTesting]           = useState(false);

  const [toast, setToast]   = useState('');
  const [toastOk, setToastOk] = useState(true);
  const showToast = (msg: string, ok = true) => { setToast(msg); setToastOk(ok); setTimeout(() => setToast(''), 3000); };

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/integrations', { headers: { Authorization: `Bearer ${token()}` } });
      if (res.ok) { const d = await res.json(); setIntegrations(d ?? []); }
    } catch {}
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openEdit = (i: Integration) => {
    setEditId(i.name);
    try { setEditCfg(JSON.parse(i.config) || {}); } catch { setEditCfg({}); }
    setEditActive(i.isActive);
  };

  const save = async () => {
    if (!editId) return;
    setSaving(true);
    const res = await fetch(`/api/integrations/${editId}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: editActive, config: JSON.stringify(editCfg) }),
    });
    setSaving(false);
    if (res.ok) { showToast('Đã lưu cấu hình ✔️'); setEditId(null); load(); }
    else showToast('Lỗi khi lưu', false);
  };

  const test = async () => {
    if (!editId) return;
    setTesting(true);
    const res = await fetch(`/api/integrations/${editId}/test`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token()}` },
    });
    setTesting(false);
    if (res.ok) showToast('Kết nối thành công ✔️');
    else showToast('Kết nối thất bại — kiểm tra cấu hình', false);
  };

  const activeInt = integrations.find(i => i.name === editId) ?? null;
  const activeMeta = editId ? INT_META[editId] : null;

  const fmtSync = (dt: string | null) => !dt ? 'Chưa đồng bộ'
    : new Date(dt).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

  return (
    <div>
      {/* Header */}
      <div className="flex items-end justify-between mb-4 gap-3">
        <div>
          <div className="text-[19px] font-extrabold" style={{ color: 'var(--t1)' }}>🔌 Tích hợp Hệ thống</div>
          <div className="text-[12.5px] mt-1" style={{ color: 'var(--t2)' }}>
            Quản lý kết nối với GAS Oracle, Payment System, Email, Teams
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-4">
        {loading ? (
          <div className="ds-card" style={{ padding: 32, textAlign: 'center', color: 'var(--t3)', gridColumn: '1/-1' }}>Đang tải...</div>
        ) : integrations.map(i => {
          const meta = INT_META[i.name];
          if (!meta) return null;
          return (
            <div key={i.id} className="ds-int-card" onClick={() => openEdit(i)}>
              <div className="ds-int-ic" style={{ background: meta.bg }}>{meta.icon}</div>
              <div className="flex-1 min-w-0">
                <div className="ds-int-name">{i.displayName}</div>
                <div className="ds-int-desc" style={{ maxWidth: '90%' }}>{meta.desc.split(' — ')[0]}</div>
                <div className="ds-int-meta">Sync: {fmtSync(i.lastSyncAt)}</div>
              </div>
              <div className="flex flex-col items-end gap-1.5">
                <span className={`ds-badge ${i.isActive ? 'ds-b-ok' : 'ds-b-gray'}`}>
                  <span className={i.isActive ? 'ds-dot-live' : 'ds-dot-off'}></span>
                  {i.isActive ? 'Active' : 'Inactive'}
                </span>
                <button className="ds-btn ds-btn-g ds-btn-xs" onClick={e => { e.stopPropagation(); openEdit(i); }}>
                  ⚙️ Cài đặt
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Webhook table */}
      <div className="ds-card overflow-hidden mb-3">
        <div className="ds-ch">
          <div className="ds-ch-title">
            <div className="ds-ch-ic" style={{ background: 'var(--info-bg)' }}>🔗</div>
            Webhook Events
          </div>
          <button className="ds-btn ds-btn-s ds-btn-sm">+ Thêm webhook</button>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="ds-dt">
            <thead>
              <tr>
                <th>Event</th>
                <th>URL</th>
                <th>Trạng thái</th>
                <th>Lần gọi cuối</th>
                <th style={{ textAlign: 'center' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {WEBHOOK_DEMO.map((w, i) => (
                <tr key={i}>
                  <td><span className="ds-mono" style={{ fontSize: 11.5 }}>{w.event}</span></td>
                  <td><span style={{ fontSize: 11.5, color: 'var(--info)' }}>{w.url}</span></td>
                  <td>
                    <span className={`ds-badge ${w.status === 'active' ? 'ds-b-ok' : 'ds-b-err'}`}>
                      {w.status === 'active' ? '● Active' : '✗ Error'}
                    </span>
                  </td>
                  <td style={{ color: 'var(--t3)', fontSize: 11.5 }}>{w.lastCall}</td>
                  <td style={{ textAlign: 'center' }}>
                    <button className="ds-btn ds-btn-g ds-btn-xs">✏️</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit modal */}
      {editId && activeInt && activeMeta && (
        <div className="ds-modal-overlay open" onClick={e => { if (e.target === e.currentTarget) setEditId(null); }}>
          <div className="ds-modal" style={{ maxWidth: 540 }}>
            <div className="ds-modal-hdr">
              <div className="flex items-center gap-2">
                <span style={{ fontSize: 20 }}>{activeMeta.icon}</span>
                <span className="ds-modal-title">{activeInt.displayName}</span>
              </div>
              <button className="ds-btn ds-btn-g ds-btn-sm" onClick={() => setEditId(null)}>✕</button>
            </div>
            <div className="ds-modal-body">
              <p style={{ fontSize: 12, color: 'var(--t2)', marginBottom: 14 }}>{activeMeta.desc}</p>

              <div className="flex items-center gap-2 mb-4">
                <label className="ds-flbl" style={{ margin: 0 }}>Kích hoạt tích hợp</label>
                <label className="ds-toggle">
                  <input type="checkbox" checked={editActive} onChange={e => setEditActive(e.target.checked)} />
                  <span className="ds-tslider"></span>
                </label>
              </div>

              {activeMeta.fields.map(f => (
                <div key={f.key} className="ds-fgrp">
                  <label className="ds-flbl">{f.label}</label>
                  <input
                    className="ds-inp"
                    type={f.type}
                    placeholder={f.placeholder}
                    value={editCfg[f.key] ?? ''}
                    onChange={e => setEditCfg(prev => ({ ...prev, [f.key]: e.target.value }))}
                  />
                </div>
              ))}
            </div>
            <div className="ds-modal-footer">
              <button className="ds-btn ds-btn-g ds-btn-sm" onClick={test} disabled={testing}>
                {testing ? 'Đang kiểm tra...' : '🔌 Test kết nối'}
              </button>
              <button className="ds-btn ds-btn-g ds-btn-sm" onClick={() => setEditId(null)}>Huỷ</button>
              <button className="ds-btn ds-btn-p ds-btn-sm" onClick={save} disabled={saving}>
                {saving ? 'Đang lưu...' : '💾 Lưu'}
              </button>
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
