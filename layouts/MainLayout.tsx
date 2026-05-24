import React, { useState } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { LogOut, Menu, X, Bell, Moon, Sun } from 'lucide-react';

interface AuthUser { id: number; email: string; fullName: string; role: string; branchId?: number | null; }
interface Props { user: AuthUser; onLogout: () => void; children: React.ReactNode; }

export const MainLayout: React.FC<Props> = ({ user, onLogout, children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [theme, setTheme] = useState<'light'|'dark'>('light');
  const [lang, setLang] = useState('VI');
  const navigate = useNavigate();
  const location = useLocation();

  const isAdmin = user.role === 'system_admin' || user.role === 'branch_admin';
  const isSysAdmin = user.role === 'system_admin';

  const toggleTheme = () => {
    const next = theme === 'light' ? 'dark' : 'light';
    setTheme(next);
    document.documentElement.setAttribute('data-theme', next);
  };

  const handleLogout = () => { onLogout(); navigate('/'); };

  const currentMonth = new Date().toLocaleDateString('vi-VN', { month: '2-digit', year: 'numeric' }).replace('/', '-');

  // Nav item helper
  const ni = (to: string, icon: string, label: string, badge?: string, badgeColor?: string) => (
    <NavLink
      to={to}
      end={to === '/'}
      onClick={() => setSidebarOpen(false)}
      className={({ isActive }) =>
        `flex items-center gap-2 px-2.5 py-2 rounded-[7px] cursor-pointer text-[12.5px] font-medium transition-all relative
        ${isActive
          ? 'bg-[rgba(255,122,0,0.14)] text-white font-semibold before:content-[""] before:absolute before:left-0 before:top-[22%] before:bottom-[22%] before:w-[2.5px] before:rounded-r-sm before:bg-[#FF7A00]'
          : 'text-white/55 hover:bg-white/5 hover:text-white'
        }`
      }
    >
      <span className="w-4 text-center text-sm flex-shrink-0">{icon}</span>
      <span className="flex-1">{label}</span>
      {badge && (
        <span className={`ml-auto text-[9.5px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center text-white ${badgeColor ?? 'bg-[#FF7A00]'}`}>
          {badge}
        </span>
      )}
    </NavLink>
  );

  const secLabel = (text: string) => (
    <div className="text-[9.5px] font-bold uppercase tracking-[1.3px] text-white/18 px-2.5 pt-3 pb-1">{text}</div>
  );

  const avatarLetters = user.fullName.split(' ').map(w => w[0]).slice(-2).join('').toUpperCase();

  const Sidebar = () => (
    <div className="flex flex-col h-full" style={{ background: 'var(--sb)' }}>
      {/* Brand */}
      <div className="px-4 py-5 border-b border-white/6">
        <div className="flex items-center gap-2.5 mb-3">
          <div className="w-[38px] h-[38px] rounded-[10px] flex items-center justify-center text-xl flex-shrink-0"
            style={{ background: 'linear-gradient(135deg,#FF7A00,#FF4500)', boxShadow: '0 4px 14px rgba(255,122,0,.4)' }}>
            🦊
          </div>
          <div>
            <div className="text-[13px] font-extrabold text-white tracking-[0.2px]">FOXAI NATIVE</div>
            <div className="text-[10px] text-white/35 mt-0.5">AI Reconciliation · VNA</div>
          </div>
        </div>
        <div className="rounded-[7px] px-2.5 py-1.5 flex items-center gap-1.5"
          style={{ background: 'rgba(255,122,0,.08)', border: '1px solid rgba(255,122,0,.2)' }}>
          <span className="ds-dot-live flex-shrink-0"></span>
          <span className="text-[10.5px] text-white/50 leading-snug">
            <strong className="text-[#FFA040] font-bold">Chi nhánh đang hoạt động</strong><br />
            Kỳ: Tháng {currentMonth}
          </span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2.5 py-2 overflow-y-auto flex flex-col gap-0.5">
        {secLabel('Nghiệp vụ')}
        {ni('/', '📊', 'Dashboard')}
        {ni('/upload', '📤', 'Upload & OCR')}
        {ni('/reconcile', '🔍', 'Đối soát Chi tiết')}
        {ni('/summary', '📋', 'Tổng hợp Đối soát')}

        {secLabel('Cài đặt')}
        {ni('/admin/users', '👥', 'Phân quyền RBAC')}
        {isAdmin && ni('/admin/integration', '🔌', 'Tích hợp Hệ thống')}
        {isAdmin && ni('/admin/input-config', '📁', 'Cấu hình Input')}
        {isAdmin && ni('/admin/output-config', '📤', 'Cấu hình Output')}
        {isAdmin && ni('/admin/prompts', '🤖', 'Prompt Config')}
        {isAdmin && ni('/admin/recon-config', '⚙️', 'Cấu hình Đối soát')}

        {secLabel('Hệ thống')}
        {ni('/admin/audit', '📜', 'Nhật ký Truy cập')}
        {isSysAdmin && ni('/admin/branches', '🏢', 'Chi nhánh')}
        {isSysAdmin && ni('/admin/license', '🛡️', 'License')}
      </nav>

      {/* User footer */}
      <div className="px-3.5 py-3 border-t border-white/6">
        <div className="flex items-center gap-2 cursor-pointer" onClick={handleLogout} title="Đăng xuất">
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-extrabold text-white flex-shrink-0"
            style={{ background: 'linear-gradient(135deg,#003D7A,#0066CC)' }}>
            {avatarLetters}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[11.5px] font-bold text-white/75 truncate">{user.fullName}</div>
            <div className="text-[10px] text-white/30 mt-0.5 capitalize">{user.role.replace('_', ' ')}</div>
          </div>
          <LogOut className="w-3.5 h-3.5 text-white/30 hover:text-white/70 transition-colors flex-shrink-0" />
        </div>
      </div>
    </div>
  );

  // Page title from route
  const titleMap: Record<string, [string, string]> = {
    '/': ['Dashboard Tổng quan', 'Tổng quan hệ thống · Tháng ' + currentMonth],
    '/upload': ['Upload & OCR', 'Tải chứng từ · AI xử lý tự động'],
    '/reconcile': ['Đối soát Chi tiết', 'So sánh OCR vs GAS · Oracle EBS R12'],
    '/summary': ['Tổng hợp Đối soát', 'Báo cáo tổng hợp · Kỳ ' + currentMonth],
    '/documents': ['Chứng từ OCR', 'Lịch sử chứng từ đã xử lý'],
    '/stats': ['Thống kê', 'Thống kê OCR theo thời gian'],
    '/admin/users': ['Phân quyền RBAC', 'Cài đặt > Quản lý người dùng'],
    '/admin/integration': ['Tích hợp Hệ thống', 'Cài đặt > Integration'],
    '/admin/input-config': ['Cấu hình Input', 'Cài đặt > File & Field Mapping'],
    '/admin/output-config': ['Cấu hình Output', 'Cài đặt > Excel Template'],
    '/admin/prompts': ['Prompt Config', 'Cài đặt > AI Prompt Management'],
    '/admin/recon-config': ['Cấu hình Đối soát', 'Cài đặt > Matching Rules & Schedule'],
    '/admin/audit': ['Nhật ký Truy cập', 'Hệ thống > Immutable Audit Trail'],
    '/admin/branches': ['Chi nhánh', 'Quản trị > Chi nhánh'],
    '/admin/settings': ['Cài đặt chi nhánh', 'Quản trị > Settings'],
    '/admin/license': ['License', 'Hệ thống > License Management'],
  };
  const [pageTitle, pageCrumb] = titleMap[location.pathname] ?? ['Dashboard', ''];

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--bg)', fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>
      {/* Sidebar desktop */}
      <aside className="hidden md:flex flex-col w-[248px] flex-shrink-0" style={{ background: 'var(--sb)' }}>
        <Sidebar />
      </aside>

      {/* Sidebar mobile overlay */}
      {sidebarOpen && (
        <div className="md:hidden fixed inset-0 z-40 flex">
          <div className="fixed inset-0 bg-black/40" onClick={() => setSidebarOpen(false)} />
          <aside className="relative flex flex-col w-[248px] z-50" style={{ background: 'var(--sb)' }}>
            <button onClick={() => setSidebarOpen(false)} className="absolute top-3 right-3 text-white/40 hover:text-white/80">
              <X className="w-5 h-5" />
            </button>
            <Sidebar />
          </aside>
        </div>
      )}

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Topbar */}
        <header className="h-[52px] flex-shrink-0 flex items-center px-5 gap-2.5 border-b"
          style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
          <button className="md:hidden mr-1 text-[var(--t2)]" onClick={() => setSidebarOpen(true)}>
            <Menu className="w-5 h-5" />
          </button>
          <div>
            <div className="text-[14px] font-bold" style={{ color: 'var(--t1)' }}>{pageTitle}</div>
            <div className="text-[11px]" style={{ color: 'var(--t3)' }}>{pageCrumb}</div>
          </div>
          <div className="flex-1" />

          {/* Language switcher */}
          <div className="flex rounded-[6px] overflow-hidden border" style={{ background: 'var(--surface-2)', borderColor: 'var(--border)' }}>
            {['VI','EN','JP','FR','ZH'].map(l => (
              <button key={l} onClick={() => setLang(l)}
                className="px-2 py-1 text-[10.5px] font-bold border-none cursor-pointer transition-all"
                style={{ background: lang === l ? 'var(--fox)' : 'transparent', color: lang === l ? '#fff' : 'var(--t2)', fontFamily: 'inherit' }}>
                {l}
              </button>
            ))}
          </div>

          {/* Timezone badges */}
          <div className="hidden lg:flex items-center gap-1.5">
            <span className="text-[11px] font-bold px-2 py-1 rounded-[5px]" style={{ background: '#FFF0F0', color: '#991B1B', border: '1px solid #FECACA' }}>🇯🇵 NRT+4</span>
            <span className="text-[11px] font-bold px-2 py-1 rounded-[5px]" style={{ background: '#EFF6FF', color: '#1D4ED8', border: '1px solid #BFDBFE' }}>🇫🇷 CDG+4</span>
            <span className="text-[11px] font-bold px-2 py-1 rounded-[5px]" style={{ background: '#FFF7ED', color: '#9A3412', border: '1px solid #FED7AA' }}>🇨🇳 PVG+6</span>
          </div>

          {/* Bell */}
          <button className="w-[30px] h-[30px] rounded-[6px] border flex items-center justify-center text-sm relative"
            style={{ borderColor: 'var(--border)', background: 'var(--surface-2)', color: 'var(--t2)' }}>
            <Bell className="w-[14px] h-[14px]" />
            <span className="absolute top-1 right-1 w-[7px] h-[7px] rounded-full bg-red-500 border-2" style={{ borderColor: 'var(--surface)' }}></span>
          </button>

          {/* Theme toggle */}
          <button onClick={toggleTheme}
            className="w-[30px] h-[30px] rounded-[6px] border flex items-center justify-center text-sm"
            style={{ borderColor: 'var(--border)', background: 'var(--surface-2)', color: 'var(--t2)' }}>
            {theme === 'light' ? <Moon className="w-[14px] h-[14px]" /> : <Sun className="w-[14px] h-[14px]" />}
          </button>

          {/* User avatar */}
          <div className="w-[30px] h-[30px] rounded-full flex items-center justify-center text-[11px] font-extrabold text-white cursor-pointer flex-shrink-0"
            style={{ background: 'linear-gradient(135deg,var(--fox),#FF4500)' }}>
            {avatarLetters}
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-[18px_22px]" style={{ background: 'var(--bg)' }}>
          {children}
        </main>
      </div>
    </div>
  );
};
