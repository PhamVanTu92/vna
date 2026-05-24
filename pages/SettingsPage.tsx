import React, { useEffect, useState } from 'react';
import { Save, RotateCcw, Settings, Cpu, ShieldCheck } from 'lucide-react';
import { SYSTEM_PROMPT } from '../constants';

interface AuthUser { id: number; role: string; branchId?: number | null; }
interface Branch { id: number; name: string; code: string; }

const MODELS = [
  { value: 'gemini-3-pro-preview',   label: 'Gemini 3.0 Pro (Chính xác cao)' },
  { value: 'gemini-2.0-flash',       label: 'Gemini 2.0 Flash (Nhanh hơn, tiết kiệm quota)' },
  { value: 'gemini-2.5-pro-preview', label: 'Gemini 2.5 Pro Preview' }
];

const authHeader = () => ({ Authorization: `Bearer ${localStorage.getItem('auth_token')}`, 'Content-Type': 'application/json' });

export const SettingsPage: React.FC<{ user: AuthUser }> = ({ user }) => {
  const [branches, setBranches]   = useState<Branch[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<number | null>(null);
  const [prompt, setPrompt]       = useState('');
  const [model, setModel]         = useState('gemini-3-pro-preview');
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);
  const [saved, setSaved]         = useState(false);
  const [error, setError]         = useState('');

  const isSysAdmin = user.role === 'system_admin';

  useEffect(() => {
    const init = async () => {
      if (isSysAdmin) {
        const res = await fetch('/api/admin/branches', { headers: authHeader() });
        const list = await res.json();
        setBranches(list ?? []);
        if (list?.length > 0) setSelectedBranch(list[0].id);
      } else {
        setSelectedBranch(user.branchId ?? null);
      }
    };
    init();
  }, []);

  useEffect(() => {
    if (!selectedBranch) { setLoading(false); return; }
    setLoading(true);
    fetch(`/api/admin/branches/${selectedBranch}/settings`, { headers: authHeader() })
      .then(r => r.json())
      .then(({ settings }) => {
        setPrompt(settings?.systemPrompt ?? '');
        setModel(settings?.geminiModel ?? 'gemini-3-pro-preview');
      })
      .finally(() => setLoading(false));
  }, [selectedBranch]);

  const handleSave = async () => {
    if (!selectedBranch) return;
    setSaving(true); setError(''); setSaved(false);
    try {
      const res = await fetch(`/api/admin/branches/${selectedBranch}/settings`, {
        method:  'PUT',
        headers: authHeader(),
        body:    JSON.stringify({ systemPrompt: prompt || null, geminiModel: model })
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? 'Lưu thất bại.'); return; }
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } finally { setSaving(false); }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Settings className="w-5 h-5 text-[#005c8f]" />
        <div>
          <h1 className="text-xl font-bold text-slate-800">Cài đặt chi nhánh</h1>
          <p className="text-sm text-slate-500">Cấu hình AI model và system prompt cho từng chi nhánh</p>
        </div>
      </div>

      {/* Branch selector (system_admin only) */}
      {isSysAdmin && branches.length > 0 && (
        <div className="mb-6">
          <label className="block text-sm font-medium text-slate-700 mb-2">Chọn chi nhánh</label>
          <select value={selectedBranch ?? ''} onChange={e => setSelectedBranch(parseInt(e.target.value))}
            className="w-full sm:w-72 px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[#005c8f] outline-none">
            {branches.map(b => <option key={b.id} value={b.id}>{b.name} ({b.code})</option>)}
          </select>
        </div>
      )}

      {loading ? (
        <div className="text-slate-400 text-sm">Đang tải cài đặt...</div>
      ) : !selectedBranch ? (
        <div className="text-slate-400 text-sm">Tài khoản của bạn chưa được gán vào chi nhánh nào.</div>
      ) : (
        <div className="space-y-6">
          {/* AI Model */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="bg-slate-50 px-6 py-4 border-b border-slate-100 flex items-center gap-2">
              <Cpu className="w-4 h-4 text-slate-600" />
              <h3 className="font-semibold text-slate-700 text-sm">AI Model</h3>
            </div>
            <div className="p-6">
              <select value={model} onChange={e => setModel(e.target.value)}
                className="w-full sm:w-96 px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[#005c8f] outline-none">
                {MODELS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>
          </div>

          {/* System Prompt */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="bg-slate-50 px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-slate-600" />
                <h3 className="font-semibold text-slate-700 text-sm">Extraction Logic (System Prompt)</h3>
              </div>
              <button onClick={() => setPrompt('')}
                className="text-xs flex items-center gap-1 text-slate-400 hover:text-red-500 transition-colors">
                <RotateCcw className="w-3 h-3" /> Dùng prompt mặc định
              </button>
            </div>
            <div className="p-6">
              <p className="text-xs text-slate-500 mb-3 bg-blue-50 p-3 rounded-lg border border-blue-100">
                <strong>Lưu ý:</strong> Để trống để dùng prompt mặc định của hệ thống.
                Chỉ sửa nếu hóa đơn chi nhánh có cấu trúc đặc biệt khác.
              </p>
              <textarea value={prompt} onChange={e => setPrompt(e.target.value)}
                placeholder="Để trống = dùng prompt mặc định hệ thống..."
                className="w-full h-64 p-4 font-mono text-xs bg-slate-900 text-green-400 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none resize-y"
                spellCheck={false} />
            </div>
          </div>

          {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm p-3 rounded-lg">{error}</div>}

          <div className="flex justify-end gap-3">
            {saved && <span className="flex items-center text-green-600 text-sm">✓ Đã lưu</span>}
            <button onClick={handleSave} disabled={saving}
              className="flex items-center gap-2 bg-[#005c8f] hover:bg-[#004a73] disabled:opacity-50 text-white px-6 py-2.5 rounded-lg font-medium transition-colors">
              <Save className="w-4 h-4" /> {saving ? 'Đang lưu...' : 'Lưu cài đặt'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
