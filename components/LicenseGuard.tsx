import React, { useEffect, useState, useCallback } from 'react';
import { ShieldAlert, ShieldCheck, Clock, RefreshCw } from 'lucide-react';

interface LicenseInfo {
  customerName: string;
  expiresAt: string;
  maxUsers: number;
  daysRemaining: number;
  isWarning: boolean;
}

interface LicenseStatus {
  valid: boolean;
  reason?: 'LICENSE_NOT_ACTIVATED' | 'LICENSE_EXPIRED' | 'CLOCK_TAMPERED';
  license?: LicenseInfo;
}

interface Props {
  children: React.ReactNode;
}

export const LicenseGuard: React.FC<Props> = ({ children }) => {
  const [status, setStatus]       = useState<LicenseStatus | null>(null);
  const [loading, setLoading]     = useState(true);
  const [licenseKey, setKey]      = useState('');
  const [activating, setActiving] = useState(false);
  const [error, setError]         = useState('');

  const fetchStatus = useCallback(async () => {
    try {
      const res  = await fetch('/api/license/status');
      const data = await res.json();
      setStatus(data);
    } catch {
      setStatus({ valid: false, reason: 'LICENSE_NOT_ACTIVATED' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchStatus(); }, [fetchStatus]);

  const handleActivate = async () => {
    if (!licenseKey.trim()) return;
    setActiving(true);
    setError('');
    try {
      const token = localStorage.getItem('auth_token');
      const res   = await fetch('/api/license/activate', {
        method:  'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ licenseKey: licenseKey.trim() })
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Kích hoạt thất bại.');
      } else {
        setKey('');
        await fetchStatus();
      }
    } catch {
      setError('Lỗi kết nối đến server. Vui lòng thử lại.');
    } finally {
      setActiving(false);
    }
  };

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex items-center gap-3 text-slate-500">
          <RefreshCw className="w-5 h-5 animate-spin" />
          <span>Đang kiểm tra license...</span>
        </div>
      </div>
    );
  }

  // ── License hợp lệ ────────────────────────────────────────────────────────
  if (status?.valid) {
    return (
      <>
        {status.license?.isWarning && (
          <div className="bg-yellow-400 text-yellow-900 px-4 py-2 text-center text-sm font-medium">
            ⚠ License sắp hết hạn trong{' '}
            <strong>{status.license.daysRemaining} ngày</strong> —
            liên hệ vendor để gia hạn.
          </div>
        )}
        {children}
      </>
    );
  }

  // ── License không hợp lệ → màn hình kích hoạt ────────────────────────────
  const isClockTampered = status?.reason === 'CLOCK_TAMPERED';

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden">

        {/* Header */}
        <div className={`px-8 py-6 text-white text-center ${isClockTampered ? 'bg-orange-600' : 'bg-[#005c8f]'}`}>
          <div className="flex justify-center mb-3">
            {isClockTampered
              ? <Clock className="w-12 h-12 opacity-90" />
              : <ShieldAlert className="w-12 h-12 opacity-90" />
            }
          </div>
          {status?.reason === 'LICENSE_EXPIRED' && (
            <>
              <h1 className="text-xl font-bold">License đã hết hạn</h1>
              <p className="text-blue-100 text-sm mt-1">
                Nhập key gia hạn để tiếp tục sử dụng hệ thống.
              </p>
            </>
          )}
          {status?.reason === 'LICENSE_NOT_ACTIVATED' && (
            <>
              <h1 className="text-xl font-bold">Kích hoạt hệ thống</h1>
              <p className="text-blue-100 text-sm mt-1">
                Nhập license key để bắt đầu sử dụng.
              </p>
            </>
          )}
          {isClockTampered && (
            <>
              <h1 className="text-xl font-bold">Lỗi đồng hồ hệ thống</h1>
              <p className="text-orange-100 text-sm mt-1">
                Phát hiện đồng hồ server bị chỉnh lùi. Liên hệ quản trị viên.
              </p>
            </>
          )}
        </div>

        {/* Body */}
        <div className="px-8 py-6">
          {isClockTampered ? (
            <div className="text-center text-slate-600 text-sm space-y-2">
              <p>
                Hệ thống phát hiện thời gian thực của server nhỏ hơn mốc thời
                gian đã ghi nhận trước đó.
              </p>
              <p className="text-orange-600 font-medium">
                Vui lòng đồng bộ lại đồng hồ hệ thống về thời gian thực tế
                và khởi động lại server.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <label className="block text-sm font-medium text-slate-700">
                License Key
              </label>
              <textarea
                value={licenseKey}
                onChange={e => setKey(e.target.value)}
                placeholder="Dán license key nhận được từ vendor vào đây..."
                rows={5}
                className="w-full p-3 border border-slate-300 rounded-lg font-mono text-xs
                           focus:ring-2 focus:ring-[#005c8f] focus:border-[#005c8f] outline-none
                           resize-none bg-slate-50"
              />
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-sm p-3 rounded-lg">
                  {error}
                </div>
              )}
              <button
                onClick={handleActivate}
                disabled={activating || !licenseKey.trim()}
                className="w-full bg-[#005c8f] hover:bg-[#004a73] disabled:opacity-40
                           text-white py-3 rounded-lg font-semibold transition-colors
                           flex items-center justify-center gap-2"
              >
                {activating
                  ? <><RefreshCw className="w-4 h-4 animate-spin" /> Đang kích hoạt...</>
                  : <><ShieldCheck className="w-4 h-4" /> Kích hoạt License</>
                }
              </button>
            </div>
          )}
        </div>

        <div className="px-8 pb-5 text-center text-xs text-slate-400">
          VNA Accountant Assistant — Liên hệ vendor để được hỗ trợ
        </div>
      </div>
    </div>
  );
};
