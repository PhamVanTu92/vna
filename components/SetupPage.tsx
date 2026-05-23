import React, { useState } from 'react';
import { UserPlus, Eye, EyeOff, AlertCircle, CheckCircle } from 'lucide-react';

interface Props {
  onSetupComplete: (token: string, user: { id: number; email: string; fullName: string; role: string }) => void;
}

export const SetupPage: React.FC<Props> = ({ onSetupComplete }) => {
  const [fullName, setFullName]   = useState('');
  const [email, setEmail]         = useState('');
  const [password, setPassword]   = useState('');
  const [confirm, setConfirm]     = useState('');
  const [showPwd, setShowPwd]     = useState(false);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      setError('Mật khẩu xác nhận không khớp.');
      return;
    }
    if (password.length < 8) {
      setError('Mật khẩu tối thiểu 8 ký tự.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res  = await fetch('/api/auth/setup', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email, password, fullName })
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Thiết lập thất bại.');
        return;
      }

      localStorage.setItem('auth_token', data.token);
      onSetupComplete(data.token, data.user);
    } catch {
      setError('Không kết nối được đến server.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden">

        <div className="bg-[#005c8f] px-8 py-6 text-center">
          <div className="flex justify-center mb-3">
            <UserPlus className="w-10 h-10 text-white opacity-90" />
          </div>
          <h1 className="text-white text-lg font-bold">Thiết lập lần đầu</h1>
          <p className="text-blue-200 text-sm mt-1">
            Tạo tài khoản Quản trị viên hệ thống
          </p>
        </div>

        <form onSubmit={handleSubmit} className="px-8 py-7 space-y-4">
          <div className="bg-blue-50 border border-blue-100 text-blue-700 text-xs p-3 rounded-lg flex gap-2">
            <CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            Tài khoản này có toàn quyền quản trị hệ thống.
            Sau khi tạo xong, thêm người dùng khác trong phần Quản lý người dùng.
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm p-3
                            rounded-lg flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Họ tên</label>
            <input
              type="text"
              value={fullName}
              onChange={e => setFullName(e.target.value)}
              placeholder="Nguyễn Văn A"
              required
              className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-sm
                         focus:ring-2 focus:ring-[#005c8f] outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="admin@vna.vn"
              required
              className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-sm
                         focus:ring-2 focus:ring-[#005c8f] outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Mật khẩu <span className="text-slate-400 font-normal">(tối thiểu 8 ký tự)</span>
            </label>
            <div className="relative">
              <input
                type={showPwd ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-sm
                           focus:ring-2 focus:ring-[#005c8f] outline-none pr-10"
              />
              <button type="button" onClick={() => setShowPwd(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Xác nhận mật khẩu</label>
            <input
              type="password"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              required
              className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-sm
                         focus:ring-2 focus:ring-[#005c8f] outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#005c8f] hover:bg-[#004a73] disabled:opacity-40
                       text-white py-3 rounded-lg font-semibold transition-colors mt-2"
          >
            {loading ? 'Đang tạo...' : 'Tạo tài khoản Admin'}
          </button>
        </form>
      </div>
    </div>
  );
};
