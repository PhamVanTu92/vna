import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { LicenseGuard }        from './components/LicenseGuard';
import { LoginPage }           from './components/LoginPage';
import { SetupPage }           from './components/SetupPage';
import { MainLayout }          from './layouts/MainLayout';
import { OcrPage }             from './pages/OcrPage';
import { DocumentsPage }       from './pages/DocumentsPage';
import { StatsPage }           from './pages/StatsPage';
import { UsersPage }           from './pages/UsersPage';
import { BranchesPage }        from './pages/BranchesPage';
import { SettingsPage }        from './pages/SettingsPage';
import { LicenseAdminPage }    from './pages/LicenseAdminPage';
import { DashboardPage }       from './pages/DashboardPage';
import { ReconcilePage }       from './pages/ReconcilePage';
import { SummaryPage }         from './pages/SummaryPage';
import { IntegrationPage }     from './pages/IntegrationPage';
import { InputConfigPage }     from './pages/InputConfigPage';
import { OutputConfigPage }    from './pages/OutputConfigPage';
import { PromptConfigPage }    from './pages/PromptConfigPage';
import { ReconConfigPage }     from './pages/ReconConfigPage';
import { AuditLogPage }        from './pages/AuditLogPage';

interface AuthUser { id: number; email: string; fullName: string; role: string; branchId?: number | null; }

function getStoredToken(): string | null  { return localStorage.getItem('auth_token'); }
function getStoredUser():  AuthUser | null {
  try { return JSON.parse(localStorage.getItem('auth_user') ?? 'null'); } catch { return null; }
}

const App: React.FC = () => {
  const [authToken,   setAuthToken]   = useState<string | null>(getStoredToken);
  const [authUser,    setAuthUser]    = useState<AuthUser | null>(getStoredUser);
  const [needsSetup,  setNeedsSetup]  = useState(false);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    const verify = async () => {
      const token = getStoredToken();
      if (!token) {
        try {
          const r = await fetch('/api/auth/setup', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({})
          });
          setNeedsSetup(r.status !== 403);
        } catch {}
        setAuthLoading(false);
        return;
      }
      try {
        const r = await fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } });
        if (r.ok) {
          const { user } = await r.json();
          setAuthUser(user);
          localStorage.setItem('auth_user', JSON.stringify(user));
        } else { logout(); }
      } catch {}
      setAuthLoading(false);
    };
    verify();
  }, []);

  const login = (token: string, user: AuthUser) => {
    localStorage.setItem('auth_token', token);
    localStorage.setItem('auth_user',  JSON.stringify(user));
    setAuthToken(token); setAuthUser(user); setNeedsSetup(false);
  };

  const logout = () => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');
    setAuthToken(null); setAuthUser(null);
  };

  if (authLoading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg)' }}>
      <div className="text-[13px]" style={{ color: 'var(--t3)' }}>Đang tải...</div>
    </div>
  );

  const isAdmin    = authUser?.role === 'system_admin' || authUser?.role === 'branch_admin';
  const isSysAdmin = authUser?.role === 'system_admin';

  return (
    <LicenseGuard>
      {needsSetup ? (
        <SetupPage onSetupComplete={login} />
      ) : !authToken ? (
        <LoginPage onLoginSuccess={login} />
      ) : (
        <BrowserRouter>
          <MainLayout user={authUser!} onLogout={logout}>
            <Routes>
              {/* Nghiệp vụ */}
              <Route path="/"           element={<DashboardPage />} />
              <Route path="/upload"     element={<OcrPage />} />
              <Route path="/reconcile"  element={<ReconcilePage />} />
              <Route path="/summary"    element={<SummaryPage />} />
              <Route path="/documents"  element={<DocumentsPage />} />
              <Route path="/stats"      element={<StatsPage />} />

              {/* Cài đặt */}
              <Route path="/admin/users"        element={<UsersPage />} />
              <Route path="/admin/integration"  element={<IntegrationPage />} />
              <Route path="/admin/input-config" element={<InputConfigPage />} />
              <Route path="/admin/output-config" element={<OutputConfigPage />} />
              <Route path="/admin/prompts"      element={<PromptConfigPage />} />
              <Route path="/admin/recon-config" element={<ReconConfigPage />} />
              <Route path="/admin/audit"        element={<AuditLogPage />} />

              {/* Hệ thống */}
              {isSysAdmin && <Route path="/admin/branches" element={<BranchesPage />} />}
              {isAdmin    && <Route path="/admin/settings" element={<SettingsPage user={authUser!} />} />}
              {isSysAdmin && <Route path="/admin/license"  element={<LicenseAdminPage />} />}

              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </MainLayout>
        </BrowserRouter>
      )}
    </LicenseGuard>
  );
};

export default App;
