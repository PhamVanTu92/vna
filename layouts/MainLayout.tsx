import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  Calculator, FileText, BarChart2, Users, GitBranch,
  Settings, ShieldCheck, LogOut, Menu, X, ChevronRight
} from 'lucide-react';

interface AuthUser { id: number; email: string; fullName: string; role: string; }
interface Props { user: AuthUser; onLogout: () => void; children: React.ReactNode; }

const navItem = 'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors';
const active  = 'bg-[#005c8f] text-white';
const inactive = 'text-slate-600 hover:bg-slate-100';

export const MainLayout: React.FC<Props> = ({ user, onLogout, children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const navigate = useNavigate();

  const isAdmin = user.role === 'system_admin' || user.role === 'branch_admin';
  const isSysAdmin = user.role === 'system_admin';

  const handleLogout = () => { onLogout(); navigate('/'); };

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="p-4 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <div className="bg-[#005c8f] p-1.5 rounded-lg">
            <Calculator className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="text-sm font-bold text-slate-800">VNA Accountant</div>
            <div className="text-xs text-slate-400">Assistant</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        <p className="text-xs font-semibold text-slate-400 px-3 py-2 uppercase tracking-wide">Chính</p>

        <NavLink to="/" end className={({ isActive }) => `${navItem} ${isActive ? active : inactive}`}
          onClick={() => setSidebarOpen(false)}>
          <Calculator className="w-4 h-4" /> OCR Processing
        </NavLink>

        <NavLink to="/documents" className={({ isActive }) => `${navItem} ${isActive ? active : inactive}`}
          onClick={() => setSidebarOpen(false)}>
          <FileText className="w-4 h-4" /> Chứng từ OCR
        </NavLink>

        <NavLink to="/stats" className={({ isActive }) => `${navItem} ${isActive ? active : inactive}`}
          onClick={() => setSidebarOpen(false)}>
          <BarChart2 className="w-4 h-4" /> Thống kê
        </NavLink>

        {isAdmin && (
          <>
            <p className="text-xs font-semibold text-slate-400 px-3 py-2 mt-4 uppercase tracking-wide">Quản trị</p>

            <NavLink to="/admin/users" className={({ isActive }) => `${navItem} ${isActive ? active : inactive}`}
              onClick={() => setSidebarOpen(false)}>
              <Users className="w-4 h-4" /> Người dùng
            </NavLink>

            {isSysAdmin && (
              <NavLink to="/admin/branches" className={({ isActive }) => `${navItem} ${isActive ? active : inactive}`}
                onClick={() => setSidebarOpen(false)}>
                <GitBranch className="w-4 h-4" /> Chi nhánh
              </NavLink>
            )}

            <NavLink to="/admin/settings" className={({ isActive }) => `${navItem} ${isActive ? active : inactive}`}
              onClick={() => setSidebarOpen(false)}>
              <Settings className="w-4 h-4" /> Cài đặt chi nhánh
            </NavLink>

            {isSysAdmin && (
              <NavLink to="/admin/license" className={({ isActive }) => `${navItem} ${isActive ? active : inactive}`}
                onClick={() => setSidebarOpen(false)}>
                <ShieldCheck className="w-4 h-4" /> License
              </NavLink>
            )}
          </>
        )}
      </nav>

      {/* User info */}
      <div className="p-3 border-t border-slate-200">
        <div className="flex items-center gap-3 px-2 py-2">
          <div className="w-8 h-8 rounded-full bg-[#005c8f] flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
            {user.fullName.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-slate-800 truncate">{user.fullName}</div>
            <div className="text-xs text-slate-400 capitalize">{user.role.replace('_', ' ')}</div>
          </div>
          <button onClick={handleLogout} title="Đăng xuất"
            className="text-slate-400 hover:text-red-500 transition-colors p-1">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {/* Sidebar desktop */}
      <aside className="hidden md:flex flex-col w-60 bg-white border-r border-slate-200 flex-shrink-0">
        <SidebarContent />
      </aside>

      {/* Sidebar mobile overlay */}
      {sidebarOpen && (
        <div className="md:hidden fixed inset-0 z-40 flex">
          <div className="fixed inset-0 bg-black/40" onClick={() => setSidebarOpen(false)} />
          <aside className="relative flex flex-col w-64 bg-white z-50">
            <button onClick={() => setSidebarOpen(false)}
              className="absolute top-3 right-3 text-slate-400 hover:text-slate-600">
              <X className="w-5 h-5" />
            </button>
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile header */}
        <header className="md:hidden flex items-center gap-3 bg-[#005c8f] text-white px-4 py-3 flex-shrink-0">
          <button onClick={() => setSidebarOpen(true)}>
            <Menu className="w-5 h-5" />
          </button>
          <span className="font-semibold text-sm">VNA Accountant Assistant</span>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
};
