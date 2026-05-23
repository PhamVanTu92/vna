import React, { useEffect, useState } from 'react';
import { ShieldCheck, RefreshCw, Key, Users, Calendar, AlertTriangle } from 'lucide-react';

interface LicenseInfo {
  customerName: string; expiresAt: string;
  maxUsers: number; daysRemaining: number; isWarning: boolean;
}
interface LicenseStatus { valid: boolean; reason?: string; license?: LicenseInfo; }

const authHeader = () => ({ Authorization: `Bearer ${localStorage.getItem('auth_token')}`, 'Content-Type': 'application/json' });

export const LicenseAdminPage: React.FC = () => {
  const [status, setStatus]     = useState<LicenseStatus | null>(null);
  const [userCount, setUserCount] = useState<number>(0);
  const [loading, setLoading]   = useState(true);
  const [newKey, setNewKey]     = useState('');
  const [activating, setAct]    = useState(false);
  const [message, setMessage]   = useState('');
  const [error, setError]       = useState('');

  const load = async () => {
    setLoading(true);
    const [sr, ur] = await Promise.all([
      fetch('/api/license/status',     { headers: authHeader() }).then(r => r.json()),
      fetch('/api/license/user-limit', { headers: authHeader() }).then(r => r.json())
    ]);
    setStatus(sr);
    setUserCount(ur.current ?? 0);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleActivate = async () => {
    if (!newKey.trim()) return;
    setAct(true); setError(''); setMessage('');
    const res  = await fetch('/api/license/activate', { method: 'POST', headers: authHeader(), body: JSON.stringify({ licenseKey: newKey.trim() }) });
    const data = await res.json();
    if (!res.ok) { setError(data.error ?? 'Kích hoạt thất bại.'); }
    else { setMessage('Kích hoạt thành công!'); setNewKey(''); load(); }
    setAct(false);
  };

  if (loading) return <div className="p-6 text-slate-400 text-sm">Đang tải...</div>;

  const lic = status?.license;
  const exp = lic ? new Date(lic.expiresAt) : null;

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <ShieldCheck className="w-5 h-5 text-[#005c8f]" />
        <h1 className="text-xl font-bold text-slate-800">Quản lý License</h1>
      </div>

      {/* Status card */}
      <div className={`rounded-xl border shadow-sm p-6 mb-6 ${
        status?.valid
          ? lic?.isWarning ? 'bg-yellow-50 border-yellow-200' : 'bg-green-50 border-green-200'
          : 'bg-red-50 border-red-200'
      }`}>
        <div className="flex items-start gap-4">
          <div className={`p-2 rounded-lg ${status?.valid ? (lic?.isWarning ? 'bg-yellow-100' : 'bg-green-100') : 'bg-red-100'}`}>
            {status?.valid
              ? lic?.isWarning ? <AlertTriangle className="w-5 h-5 text-yellow-600" /> : <ShieldCheck className="w-5 h-5 text-green-600" />
              : <AlertTriangle className="w-5 h-5 text-red-600" />
            }
          </div>
          <div className="flex-1">
            <h2 className={`font-semibold ${status?.valid ? (lic?.isWarning ? 'text-yellow-800' : 'text-green-800') : 'text-red-800'}`}>
              {status?.valid ? (lic?.isWarning ? 'Sắp hết hạn' : 'Đang hoạt động') : 'License không hợp lệ'}
            </h2>
            {lic && (
              <div className="mt-3 grid grid-cols-2 gap-4 text-sm">
                <InfoRow icon={<ShieldCheck className="w-4 h-4" />} label="Khách hàng" value={lic.customerName} />
                <InfoRow icon={<Calendar className="w-4 h-4" />}    label="Hết hạn"
                  value={`${exp?.toLocaleDateString('vi-VN')} (${lic.daysRemaining} ngày)`} />
                <InfoRow icon={<Users className="w-4 h-4" />}       label="Người dùng"
                  value={`${userCount} / ${lic.maxUsers}`} />
              </div>
            )}
            {!status?.valid && (
              <p className="text-red-600 text-sm mt-1">
                {status?.reason === 'LICENSE_EXPIRED'       && 'License đã hết hạn.'}
                {status?.reason === 'LICENSE_NOT_ACTIVATED' && 'Chưa kích hoạt license.'}
                {status?.reason === 'CLOCK_TAMPERED'        && 'Đồng hồ hệ thống bị chỉnh sai.'}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Cập nhật key */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="bg-slate-50 px-6 py-4 border-b border-slate-100 flex items-center gap-2">
          <Key className="w-4 h-4 text-slate-600" />
          <h3 className="font-semibold text-slate-700 text-sm">
            {status?.valid ? 'Cập nhật / Gia hạn License Key' : 'Nhập License Key'}
          </h3>
        </div>
        <div className="p-6 space-y-4">
          {message && <div className="bg-green-50 text-green-700 text-sm p-3 rounded-lg">✓ {message}</div>}
          {error   && <div className="bg-red-50 text-red-700 text-sm p-3 rounded-lg">{error}</div>}
          <textarea value={newKey} onChange={e => setNewKey(e.target.value)}
            placeholder="Dán license key nhận từ vendor vào đây..."
            rows={5}
            className="w-full p-3 border border-slate-300 rounded-lg font-mono text-xs focus:ring-2 focus:ring-[#005c8f] outline-none resize-none bg-slate-50" />
          <button onClick={handleActivate} disabled={activating || !newKey.trim()}
            className="flex items-center gap-2 bg-[#005c8f] hover:bg-[#004a73] disabled:opacity-50 text-white px-6 py-2.5 rounded-lg font-medium transition-colors">
            <RefreshCw className={`w-4 h-4 ${activating ? 'animate-spin' : ''}`} />
            {activating ? 'Đang kích hoạt...' : 'Kích hoạt'}
          </button>
        </div>
      </div>
    </div>
  );
};

const InfoRow: React.FC<{ icon: React.ReactNode; label: string; value: string }> = ({ icon, label, value }) => (
  <div className="flex items-center gap-2 text-slate-600">
    <span className="text-slate-400">{icon}</span>
    <span className="text-slate-500">{label}:</span>
    <span className="font-medium">{value}</span>
  </div>
);
