import React, { useEffect, useState } from 'react';
import { GitBranch, Plus, Edit2, ChevronRight, Users, RefreshCw } from 'lucide-react';

interface Branch {
  id: number; parentId: number | null; name: string; code: string;
  description: string | null; isActive: boolean;
  settings?: { geminiModel: string } | null;
  _count?: { users: number };
  children?: Branch[];
}

const authHeader = () => ({ Authorization: `Bearer ${localStorage.getItem('auth_token')}`, 'Content-Type': 'application/json' });

function buildTree(flat: Branch[]): Branch[] {
  const map = new Map(flat.map(b => [b.id, { ...b, children: [] as Branch[] }]));
  const roots: Branch[] = [];
  map.forEach(b => {
    if (b.parentId && map.has(b.parentId)) map.get(b.parentId)!.children!.push(b);
    else roots.push(b);
  });
  return roots;
}

export const BranchesPage: React.FC = () => {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading]   = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing]   = useState<Branch | null>(null);
  const [form, setForm]         = useState({ name: '', code: '', description: '', parentId: '' });
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState('');

  const load = async () => {
    setLoading(true);
    const res = await fetch('/api/admin/branches', { headers: authHeader() });
    const { branches: flat } = await res.json();
    setBranches(flat ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => { setEditing(null); setForm({ name: '', code: '', description: '', parentId: '' }); setError(''); setShowModal(true); };
  const openEdit   = (b: Branch) => { setEditing(b); setForm({ name: b.name, code: b.code, description: b.description ?? '', parentId: String(b.parentId ?? '') }); setError(''); setShowModal(true); };

  const handleSave = async () => {
    setSaving(true); setError('');
    try {
      const body = { name: form.name, code: form.code, description: form.description || null, parentId: form.parentId ? parseInt(form.parentId) : null };
      const url    = editing ? `/api/admin/branches/${editing.id}` : '/api/admin/branches';
      const method = editing ? 'PUT' : 'POST';
      const res    = await fetch(url, { method, headers: authHeader(), body: JSON.stringify(body) });
      const data   = await res.json();
      if (!res.ok) { setError(data.error ?? 'Lỗi.'); return; }
      setShowModal(false); load();
    } finally { setSaving(false); }
  };

  const tree  = buildTree(branches);
  const flat  = branches; // for parentId dropdown

  const BranchNode: React.FC<{ branch: Branch; depth: number }> = ({ branch, depth }) => (
    <>
      <div className={`flex items-center gap-3 px-4 py-3 hover:bg-slate-50 border-b border-slate-100`}
        style={{ paddingLeft: `${16 + depth * 24}px` }}>
        {depth > 0 && <ChevronRight className="w-3 h-3 text-slate-300 flex-shrink-0" />}
        <GitBranch className="w-4 h-4 text-[#005c8f] flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-slate-800 text-sm">{branch.name}</span>
            <span className="text-xs text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded font-mono">{branch.code}</span>
            {!branch.isActive && <span className="text-xs text-red-500 bg-red-50 px-1.5 py-0.5 rounded">Vô hiệu</span>}
          </div>
          {branch.description && <p className="text-xs text-slate-400 mt-0.5">{branch.description}</p>}
        </div>
        <div className="flex items-center gap-4 text-xs text-slate-400">
          <span className="flex items-center gap-1"><Users className="w-3 h-3" />{branch._count?.users ?? 0}</span>
          <span>{branch.settings?.geminiModel ?? 'default'}</span>
        </div>
        <button onClick={() => openEdit(branch)} className="text-slate-400 hover:text-[#005c8f] ml-2">
          <Edit2 className="w-4 h-4" />
        </button>
      </div>
      {branch.children?.map(c => <BranchNode key={c.id} branch={c} depth={depth + 1} />)}
    </>
  );

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Cơ cấu tổ chức</h1>
          <p className="text-sm text-slate-500 mt-0.5">{branches.filter(b => b.isActive).length} chi nhánh đang hoạt động</p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="p-2 text-slate-400 hover:text-slate-600"><RefreshCw className="w-4 h-4" /></button>
          <button onClick={openCreate}
            className="flex items-center gap-2 bg-[#005c8f] hover:bg-[#004a73] text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
            <Plus className="w-4 h-4" /> Thêm chi nhánh
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-400 text-sm">Đang tải...</div>
        ) : tree.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-sm">Chưa có chi nhánh nào. Thêm chi nhánh đầu tiên.</div>
        ) : (
          tree.map(b => <BranchNode key={b.id} branch={b} depth={0} />)
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="px-6 py-4 border-b border-slate-100">
              <h2 className="font-semibold text-slate-800">{editing ? 'Sửa chi nhánh' : 'Thêm chi nhánh mới'}</h2>
            </div>
            <div className="p-6 space-y-4">
              {error && <div className="bg-red-50 text-red-700 text-sm p-3 rounded-lg">{error}</div>}
              {[
                { label: 'Tên chi nhánh *', key: 'name', placeholder: 'Vietnam Airlines NRT Branch' },
                { label: 'Mã chi nhánh *', key: 'code', placeholder: 'NRT' },
                { label: 'Mô tả', key: 'description', placeholder: 'Chi nhánh tại sân bay Narita' }
              ].map(({ label, key, placeholder }) => (
                <div key={key}>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">{label}</label>
                  <input value={(form as any)[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                    placeholder={placeholder}
                    className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[#005c8f] outline-none" />
                </div>
              ))}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Chi nhánh cha</label>
                <select value={form.parentId} onChange={e => setForm(f => ({ ...f, parentId: e.target.value }))}
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[#005c8f] outline-none">
                  <option value="">— Không có (chi nhánh gốc) —</option>
                  {flat.filter(b => b.id !== editing?.id).map(b => (
                    <option key={b.id} value={b.id}>{b.name} ({b.code})</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm text-slate-600">Huỷ</button>
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
