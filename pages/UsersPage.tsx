import React, { useEffect, useState } from 'react';

interface Branch { id: number; name: string; code: string; }
interface UserRow {
  id: number; email: string; fullName: string;
  role: string; branchId: number | null; isActive: boolean;
  branch?: Branch;
}

const ROLE_LABELS: Record<string, string> = {
  system_admin: 'Quản trị Hệ thống',
  branch_admin: 'Quản trị Chi nhánh',
  user:         'Người dùng',
};

const authHeader = () => ({
  Authorization: `Bearer ${localStorage.getItem('auth_token')}`,
  'Content-Type': 'application/json',
});

// Permission matrix data
const PERMISSIONS = [
  { module: 'Upload & OCR',           sa: true,   ba: true,   u: true  },
  { module: 'Xem Đối soát',           sa: true,   ba: true,   u: true  },
  { module: 'Duyệt Đối soát',         sa: true,   ba: true,   u: false },
  { module: 'Flag Chênh lệch',        sa: true,   ba: true,   u: false },
  { module: 'Xem Tổng hợp',           sa: true,   ba: true,   u: true  },
  { module: 'Xuất Excel/PDF',         sa: true,   ba: true,   u: 'limited' },
  { module: 'Quản lý Người dùng',     sa: true,   ba: 'limited', u: false },
  { module: 'Cấu hình Integration',   sa: true,   ba: false,  u: false },
  { module: 'Cấu hình Input/Output',  sa: true,   ba: true,   u: false },
  { module: 'Cấu hình Prompt AI',     sa: true,   ba: 'limited', u: false },
  { module: 'Cấu hình Đối soát',      sa: true,   ba: true,   u: false },
  { module: 'Xem Nhật ký',            sa: true,   ba: 'limited', u: false },
  { module: 'Quản lý License',        sa: true,   ba: false,  u: false },
];

const PermCell: React.FC<{ v: boolean | string }> = ({ v }) => {
  if (v === true)        return <td style={{ textAlign: 'center' }}><span className="ds-pyes">✓</span></td>;
  if (v === false)       return <td style={{ textAlign: 'center' }}><span className="ds-pno">—</span></td>;
  if (v === 'limited')   return <td style={{ textAlign: 'center' }}><span className="ds-ppart">○</span></td>;
  return <td></td>;
};

export const UsersPage: React.FC = () => {
  const [users, setUsers]       = useState<UserRow[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing]   = useState<UserRow | null>(null);
  const [form, setForm]         = useState({ email: '', password: '', fullName: '', role: 'user', branchId: '', market: '' });
  const [saving, setSaving]     = useState(false);
  const [formError, setFormError] = useState('');
  const [activeTab, setActiveTab] = useState<'users' | 'matrix'>('users');

  const [toast, setToast] = useState('');
  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  const load = async () => {
    setLoading(true);
    try {
      const [ur, br] = await Promise.all([
        fetch('/api/admin/users',    { headers: authHeader() }).then(r => r.json()),
        fetch('/api/admin/branches', { headers: authHeader() }).then(r => r.json()),
      ]);
      setUsers(ur.users ?? []);
      setBranches(br ?? []);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => {
    setEditing(null);
    setForm({ email: '', password: '', fullName: '', role: 'user', branchId: '', market: '' });
    setFormError('');
    setShowModal(true);
  };

  const openEdit = (u: UserRow) => {
    setEditing(u);
    setForm({ email: u.email, password: '', fullName: u.fullName, role: u.role, branchId: String(u.branchId ?? ''), market: '' });
    setFormError('');
    setShowModal(true);
  };

  const handleSave = async () => {
    setSaving(true); setFormError('');
    try {
      const body: Record<string, any> = {
        fullName: form.fullName,
        role: form.role,
        branchId: form.branchId ? parseInt(form.branchId) : null,
      };
      if (!editing) { body.email = form.email; body.password = form.password; }
      else if (form.password) { body.password = form.password; }

      const url    = editing ? `/api/admin/users/${editing.id}` : '/api/admin/users';
      const method = editing ? 'PUT' : 'POST';
      const res    = await fetch(url, { method, headers: authHeader(), body: JSON.stringify(body) });
      const data   = await res.json();
      if (!res.ok) { setFormError(data.error ?? 'Lỗi không xác định.'); return; }
      setShowModal(false);
      showToast(editing ? 'Đã cập nhật người dùng ✔️' : 'Đã tạo người dùng mới ✔️');
      load();
    } finally { setSaving(false); }
  };

  const handleDeactivate = async (id: number) => {
    if (!window.confirm('Vô hiệu hóa người dùng này?')) return;
    await fetch(`/api/admin/users/${id}`, { method: 'DELETE', headers: authHeader() });
    showToast('Đã vô hiệu hóa người dùng');
    load();
  };

  const filtered = users.filter(u =>
    u.fullName.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  );

  const roleBadge = (role: string) => {
    const cls = role === 'system_admin' ? 'ds-b-ai' : role === 'branch_admin' ? 'ds-b-info' : 'ds-b-gray';
    return <span className={`ds-badge ${cls}`}>{ROLE_LABELS[role] ?? role}</span>;
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-end justify-between mb-4 gap-3">
        <div>
          <div className="text-[19px] font-extrabold" style={{ color: 'var(--t1)' }}>👥 Phân quyền RBAC</div>
          <div className="text-[12.5px] mt-1" style={{ color: 'var(--t2)' }}>
            {users.filter(u => u.isActive).length} người dùng đang hoạt động · {branches.length} chi nhánh
          </div>
        </div>
        <button className="ds-btn ds-btn-p ds-btn-sm" onClick={openCreate}>+ Thêm người dùng</button>
      </div>

      {/* Tabs */}
      <div className="ds-steps mb-0" style={{ marginBottom: 0 }}>
        <div className={`ds-step ${activeTab === 'users' ? 'active' : ''}`} onClick={() => setActiveTab('users')}>
          <span className="ds-step-n">👥</span> Danh sách ({users.length})
        </div>
        <div className={`ds-step ${activeTab === 'matrix' ? 'active' : ''}`} onClick={() => setActiveTab('matrix')}>
          <span className="ds-step-n">🔐</span> Phân quyền Matrix
        </div>
      </div>

      {/* Users tab */}
      {activeTab === 'users' && (
        <div className="ds-card overflow-hidden" style={{ borderTopLeftRadius: 0, borderTopRightRadius: 0, borderTop: 'none' }}>
          {/* Search */}
          <div className="ds-fbar">
            <input className="ds-finp flex-1" placeholder="🔍 Tìm kiếm theo tên, email..."
              value={search} onChange={e => setSearch(e.target.value)} />
            <button className="ds-btn ds-btn-g ds-btn-sm" onClick={load}>🔄</button>
          </div>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 32, color: 'var(--t3)' }}>Đang tải...</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="ds-dt">
                <thead>
                  <tr>
                    <th>Họ tên</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Chi nhánh</th>
                    <th style={{ textAlign: 'center' }}>Trạng thái</th>
                    <th style={{ textAlign: 'center', width: 80 }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(u => (
                    <tr key={u.id}>
                      <td>
                        <div className="flex items-center gap-2">
                          <div className="flex items-center justify-center rounded-full text-[11px] font-extrabold text-white flex-shrink-0"
                            style={{ width: 28, height: 28, background: 'var(--fox)' }}>
                            {u.fullName.charAt(0).toUpperCase()}
                          </div>
                          <span style={{ fontWeight: 600, color: 'var(--t1)', fontSize: 12.5 }}>{u.fullName}</span>
                        </div>
                      </td>
                      <td style={{ color: 'var(--t2)', fontSize: 12 }}>{u.email}</td>
                      <td>{roleBadge(u.role)}</td>
                      <td>
                        {u.branch
                          ? <span className="ds-badge ds-b-gray">{u.branch.code}</span>
                          : <span style={{ color: 'var(--t3)' }}>—</span>}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span className={`ds-badge ${u.isActive ? 'ds-b-ok' : 'ds-b-err'}`}>
                          {u.isActive ? '● Hoạt động' : '○ Vô hiệu'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <div className="flex gap-1 justify-center">
                          <button className="ds-btn ds-btn-s ds-btn-xs" onClick={() => openEdit(u)}>✏️</button>
                          {u.isActive && (
                            <button className="ds-btn ds-btn-d ds-btn-xs" onClick={() => handleDeactivate(u.id)}>🚫</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr><td colSpan={6} style={{ textAlign: 'center', padding: 32, color: 'var(--t3)' }}>
                      Không tìm thấy người dùng
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Permission matrix tab */}
      {activeTab === 'matrix' && (
        <div className="ds-card overflow-hidden" style={{ borderTopLeftRadius: 0, borderTopRightRadius: 0, borderTop: 'none' }}>
          <div className="ds-ch">
            <div className="ds-ch-title">
              <div className="ds-ch-ic" style={{ background: 'var(--ai-bg)' }}>🔐</div>
              Ma trận Phân quyền
            </div>
            <div className="flex gap-2">
              <span className="ds-badge ds-b-ok">✓ Đầy đủ</span>
              <span className="ds-badge ds-b-warn">○ Hạn chế</span>
              <span className="ds-badge ds-b-gray">— Không có</span>
            </div>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="ds-rbt">
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', paddingLeft: 16 }}>Module / Chức năng</th>
                  <th style={{ minWidth: 120 }}>
                    <span className="ds-badge ds-b-ai">Quản trị HT</span>
                  </th>
                  <th style={{ minWidth: 130 }}>
                    <span className="ds-badge ds-b-info">Quản trị CN</span>
                  </th>
                  <th style={{ minWidth: 100 }}>
                    <span className="ds-badge ds-b-gray">Người dùng</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {PERMISSIONS.map((p, i) => (
                  <tr key={i}>
                    <td style={{ textAlign: 'left', paddingLeft: 16, fontWeight: 600, fontSize: 12.5, color: 'var(--t1)' }}>
                      {p.module}
                    </td>
                    <PermCell v={p.sa} />
                    <PermCell v={p.ba} />
                    <PermCell v={p.u} />
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ padding: '10px 14px', fontSize: 11, color: 'var(--t3)', borderTop: '1px solid var(--border)' }}>
            ○ Hạn chế = chỉ xem/thực hiện trong phạm vi chi nhánh được gán
          </div>
        </div>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="ds-modal-overlay open" onClick={e => { if (e.target === e.currentTarget) setShowModal(false); }}>
          <div className="ds-modal">
            <div className="ds-modal-hdr">
              <span className="ds-modal-title">{editing ? '✏️ Sửa người dùng' : '+ Thêm người dùng mới'}</span>
              <button className="ds-btn ds-btn-g ds-btn-sm" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <div className="ds-modal-body">
              {formError && (
                <div style={{ background: 'var(--err-bg)', border: '1px solid rgba(229,62,62,.2)', borderRadius: 6, padding: '8px 12px', fontSize: 12, color: 'var(--err)', marginBottom: 12 }}>
                  {formError}
                </div>
              )}
              {!editing && (
                <div className="ds-fgrp">
                  <label className="ds-flbl">Email *</label>
                  <input className="ds-inp" type="email" placeholder="email@vna.vn"
                    value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
                </div>
              )}
              <div className="ds-fgrp">
                <label className="ds-flbl">Họ tên *</label>
                <input className="ds-inp" placeholder="Nguyễn Văn A"
                  value={form.fullName} onChange={e => setForm(f => ({ ...f, fullName: e.target.value }))} />
              </div>
              <div className="ds-fgrp">
                <label className="ds-flbl">{editing ? 'Mật khẩu mới (bỏ trống = không đổi)' : 'Mật khẩu *'}</label>
                <input className="ds-inp" type="password" placeholder={editing ? '••••••••' : 'Tối thiểu 8 ký tự'}
                  value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="ds-fgrp">
                  <label className="ds-flbl">Role</label>
                  <select className="ds-sel" value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
                    {Object.entries(ROLE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
                <div className="ds-fgrp">
                  <label className="ds-flbl">Chi nhánh</label>
                  <select className="ds-sel" value={form.branchId} onChange={e => setForm(f => ({ ...f, branchId: e.target.value }))}>
                    <option value="">— Tất cả CN —</option>
                    {branches.map(b => <option key={b.id} value={b.id}>{b.code}</option>)}
                  </select>
                </div>
              </div>
              <div className="ds-fgrp">
                <label className="ds-flbl">Thị trường (tuỳ chọn)</label>
                <input className="ds-inp" placeholder="Nhật Bản, Pháp, Trung Quốc..."
                  value={form.market} onChange={e => setForm(f => ({ ...f, market: e.target.value }))} />
              </div>
            </div>
            <div className="ds-modal-footer">
              <button className="ds-btn ds-btn-g ds-btn-sm" onClick={() => setShowModal(false)}>Huỷ</button>
              <button className="ds-btn ds-btn-p ds-btn-sm" onClick={handleSave} disabled={saving}>
                {saving ? 'Đang lưu...' : editing ? '💾 Cập nhật' : '+ Tạo người dùng'}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="ds-toast" style={{ background: 'var(--ok)' }}>{toast}</div>
      )}
    </div>
  );
};
