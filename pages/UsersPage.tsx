import React, { useEffect, useState } from 'react';
import { UserPlus, Edit2, UserX, RefreshCw, Search, Shield, User } from 'lucide-react';

interface Branch { id: number; name: string; code: string; }
interface UserRow {
  id: number; email: string; fullName: string;
  role: string; branchId: number | null; isActive: boolean;
  branch?: Branch;
}

const ROLE_LABELS: Record<string, string> = {
  system_admin: 'Quản trị viên hệ thống',
  branch_admin: 'Quản trị viên chi nhánh',
  user:         'Người dùng'
};
const ROLE_COLORS: Record<string, string> = {
  system_admin: 'bg-purple-100 text-purple-700',
  branch_admin: 'bg-blue-100 text-blue-700',
  user:         'bg-slate-100 text-slate-600'
};

const authHeader = () => ({ Authorization: `Bearer ${localStorage.getItem('auth_token')}`, 'Content-Type': 'application/json' });

export const UsersPage: React.FC = () => {
  const [users, setUsers]       = useState<UserRow[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing]   = useState<UserRow | null>(null);
  const [form, setForm]         = useState({ email: '', password: '', fullName: '', role: 'user', branchId: '' });
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState('');

  const load = async () => {
    setLoading(true);
    const [ur, br] = await Promise.all([
      fetch('/api/admin/users',    { headers: authHeader() }).then(r => r.json()),
      fetch('/api/admin/branches', { headers: authHeader() }).then(r => r.json())
    ]);
    setUsers(ur.users ?? []);
    setBranches(br.branches ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => { setEditing(null); setForm({ email: '', password: '', fullName: '', role: 'user', branchId: '' }); setError(''); setShowModal(true); };
  const openEdit   = (u: UserRow) => { setEditing(u); setForm({ email: u.email, password: '', fullName: u.fullName, role: u.role, branchId: String(u.branchId ?? '') }); setError(''); setShowModal(true); };

  const handleSave = async () => {
    setSaving(true); setError('');
    try {
      const body: any = { fullName: form.fullName, role: form.role, branchId: form.branchId ? parseInt(form.branchId) : null };
      if (!editing) { body.email = form.email; body.password = form.password; }
      else if (form.password) { body.password = form.password; }

      const url    = editing ? `/api/admin/users/${editing.id}` : '/api/admin/users';
      const method = editing ? 'PUT' : 'POST';
      const res    = await fetch(url, { method, headers: authHeader(), body: JSON.stringify(body) });
      const data   = await res.json();
      if (!res.ok) { setError(data.error ?? 'Lỗi.'); return; }
      setShowModal(false);
      load();
    } finally { setSaving(false); }
  };

  const handleDeactivate = async (id: number) => {
    if (!window.confirm('Vô hiệu hóa người dùng này?')) return;
    await fetch(`/api/admin/users/${id}`, { method: 'DELETE', headers: authHeader() });
    load();
  };

  const filtered = users.filter(u =>
    u.fullName.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Quản lý người dùng</h1>
          <p className="text-sm text-slate-500 mt-0.5">{users.filter(u => u.isActive).length} người dùng đang hoạt động</p>
        </div>
        <button onClick={openCreate}
          className="flex items-center gap-2 bg-[#005c8f] hover:bg-[#004a73] text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
          <UserPlus className="w-4 h-4" /> Thêm người dùng
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center gap-3">
          <Search className="w-4 h-4 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Tìm kiếm theo tên, email..."
            className="flex-1 text-sm outline-none text-slate-700 placeholder:text-slate-400" />
          <button onClick={load} className="text-slate-400 hover:text-slate-600"><RefreshCw className="w-4 h-4" /></button>
        </div>

        {loading ? (
          <div className="p-8 text-center text-slate-400 text-sm">Đang tải...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="bg-slate-50 text-left">
                {['Họ tên', 'Email', 'Role', 'Chi nhánh', 'Trạng thái', ''].map(h => (
                  <th key={h} className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr></thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map(u => (
                  <tr key={u.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-800">{u.fullName}</td>
                    <td className="px-4 py-3 text-slate-500">{u.email}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${ROLE_COLORS[u.role]}`}>
                        <Shield className="w-3 h-3" />{ROLE_LABELS[u.role] ?? u.role}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-500">{u.branch?.name ?? <span className="text-slate-300">—</span>}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${u.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-500'}`}>
                        {u.isActive ? 'Hoạt động' : 'Vô hiệu'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 justify-end">
                        <button onClick={() => openEdit(u)} className="text-slate-400 hover:text-[#005c8f]"><Edit2 className="w-4 h-4" /></button>
                        {u.isActive && (
                          <button onClick={() => handleDeactivate(u.id)} className="text-slate-400 hover:text-red-500"><UserX className="w-4 h-4" /></button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="px-6 py-4 border-b border-slate-100">
              <h2 className="font-semibold text-slate-800">{editing ? 'Sửa người dùng' : 'Thêm người dùng mới'}</h2>
            </div>
            <div className="p-6 space-y-4">
              {error && <div className="bg-red-50 text-red-700 text-sm p-3 rounded-lg">{error}</div>}
              {!editing && (
                <Field label="Email *">
                  <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                    className="input" placeholder="email@vna.vn" />
                </Field>
              )}
              <Field label="Họ tên *">
                <input value={form.fullName} onChange={e => setForm(f => ({ ...f, fullName: e.target.value }))}
                  className="input" placeholder="Nguyễn Văn A" />
              </Field>
              <Field label={editing ? 'Mật khẩu mới (để trống nếu không đổi)' : 'Mật khẩu *'}>
                <input type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  className="input" placeholder={editing ? '••••••••' : 'Tối thiểu 8 ký tự'} />
              </Field>
              <Field label="Role">
                <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))} className="input">
                  {Object.entries(ROLE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </Field>
              <Field label="Chi nhánh">
                <select value={form.branchId} onChange={e => setForm(f => ({ ...f, branchId: e.target.value }))} className="input">
                  <option value="">— Không gán chi nhánh —</option>
                  {branches.map(b => <option key={b.id} value={b.id}>{b.name} ({b.code})</option>)}
                </select>
              </Field>
            </div>
            <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800">Huỷ</button>
              <button onClick={handleSave} disabled={saving}
                className="px-4 py-2 text-sm bg-[#005c8f] text-white rounded-lg hover:bg-[#004a73] disabled:opacity-50 font-medium">
                {saving ? 'Đang lưu...' : 'Lưu'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div>
    <label className="block text-sm font-medium text-slate-700 mb-1.5">{label}</label>
    {children}
  </div>
);
