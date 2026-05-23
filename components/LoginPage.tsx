import React, { useState } from 'react';
import { Calculator, LogIn, Eye, EyeOff, AlertCircle } from 'lucide-react';

interface Props {
  onLoginSuccess: (token: string, user: { id: number; email: string; fullName: string; role: string }) => void;
}

export const LoginPage: React.FC<Props> = ({ onLoginSuccess }) => {
  const [email, setEmail]         = useState('');
  const [password, setPassword]   = useState('');
  const [showPwd, setShowPwd]     = useState(false);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;

    setLoading(true);
    setError('');

    try {
      const res  = await fetch('/api/auth/login', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email, password })
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Đăng nhập thất bại.');
        return;
      }

      localStorage.setItem('auth_token', data.token);
      onLoginSuccess(data.token, data.user);
    } catch {
      setError('Không kết nối được đến server. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden">

        {/* Header */}
        <div className="bg-[#005c8f] px-8 py-7 text-center">
          <div className="flex justify-center mb-3">
            <div className="bg-white p-2.5 rounded-xl shadow">
              <Calculator className="w-8 h-8 text-[#005c8f]" />
            </div>
          </div>
          <h1 className="text-white text-lg font-bold">VNA Accountant Assistant</h1>
          <p className="text-blue-200 text-sm mt-1">Đăng nhập để tiếp tục</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-8 py-7 space-y-5">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm p-3
                            rounded-lg flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="email@vna.vn"
              required
              className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-sm
                         focus:ring-2 focus:ring-[#005c8f] focus:border-[#005c8f] outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Mật khẩu
            </label>
            <div className="relative">
              <input
                type={showPwd ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-sm
                           focus:ring-2 focus:ring-[#005c8f] focus:border-[#005c8f] outline-none
                           pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPwd(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400
                           hover:text-slate-600 transition-colors"
              >
                {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || !email || !password}
            className="w-full bg-[#005c8f] hover:bg-[#004a73] disabled:opacity-40
                       text-white py-3 rounded-lg font-semibold transition-colors
                       flex items-center justify-center gap-2"
          >
            <LogIn className="w-4 h-4" />
            {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
          </button>
        </form>
      </div>
    </div>
  );
};
