import React, { useEffect, useState } from 'react';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell
} from 'recharts';
import { FileText, DollarSign, TrendingUp, GitBranch, RefreshCw } from 'lucide-react';

interface MonthStat { month: string; count: number; tokens: number; costUsd: number; }
interface BranchStat { branchId: number; branch?: { name: string; code: string }; count: number; costUsd: number; }
interface Kpi { thisMonth: number; thisMonthCost: number; total: number; totalCost: number; }
interface Stats { monthly: MonthStat[]; kpi: Kpi; byBranch: BranchStat[]; }

const authHeader = () => ({ Authorization: `Bearer ${localStorage.getItem('auth_token')}` });
const fmtMonth   = (m: string) => { const [y, mo] = m.split('-'); return `${mo}/${y.slice(2)}`; };
const COLORS      = ['#005c8f', '#0284c7', '#38bdf8', '#7dd3fc', '#bae6fd'];

const KpiCard: React.FC<{ icon: React.ReactNode; label: string; value: string; sub?: string; color: string }> =
  ({ icon, label, value, sub, color }) => (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-slate-500">{label}</p>
          <p className="text-2xl font-bold text-slate-800 mt-1">{value}</p>
          {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
        </div>
        <div className={`p-2.5 rounded-lg ${color}`}>{icon}</div>
      </div>
    </div>
  );

export const StatsPage: React.FC = () => {
  const [stats, setStats]   = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const res  = await fetch('/api/stats', { headers: authHeader() });
    const data = await res.json();
    setStats(data);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  if (loading) return <div className="p-6 text-slate-400 text-sm flex items-center gap-2"><RefreshCw className="w-4 h-4 animate-spin" />Đang tải...</div>;
  if (!stats)  return <div className="p-6 text-red-500 text-sm">Không tải được dữ liệu.</div>;

  const { monthly, kpi, byBranch } = stats;

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-800">Thống kê</h1>
        <button onClick={load} className="text-slate-400 hover:text-slate-600"><RefreshCw className="w-4 h-4" /></button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          icon={<FileText className="w-5 h-5 text-white" />}
          label="Chứng từ tháng này"
          value={String(kpi.thisMonth)}
          color="bg-[#005c8f]"
        />
        <KpiCard
          icon={<DollarSign className="w-5 h-5 text-white" />}
          label="Chi phí OCR tháng này"
          value={`$${kpi.thisMonthCost.toFixed(3)}`}
          color="bg-emerald-600"
        />
        <KpiCard
          icon={<TrendingUp className="w-5 h-5 text-white" />}
          label="Tổng chứng từ (12T)"
          value={String(kpi.total)}
          color="bg-violet-600"
        />
        <KpiCard
          icon={<DollarSign className="w-5 h-5 text-white" />}
          label="Tổng chi phí (12T)"
          value={`$${kpi.totalCost.toFixed(3)}`}
          color="bg-amber-600"
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Bar: số chứng từ theo tháng */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <h2 className="font-semibold text-slate-700 text-sm mb-4">Số chứng từ OCR theo tháng</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={monthly} barSize={20}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="month" tickFormatter={fmtMonth} tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: any) => [`${v} chứng từ`, 'Số lượng']} labelFormatter={fmtMonth} />
              <Bar dataKey="count" fill="#005c8f" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Line: chi phí OCR theo tháng */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <h2 className="font-semibold text-slate-700 text-sm mb-4">Chi phí OCR theo tháng (USD)</h2>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={monthly}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="month" tickFormatter={fmtMonth} tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: number) => `$${v.toFixed(2)}`} />
              <Tooltip formatter={(v: any) => [`$${Number(v).toFixed(4)}`, 'Chi phí']} labelFormatter={fmtMonth} />
              <Line type="monotone" dataKey="costUsd" stroke="#005c8f" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Per-branch breakdown (system_admin) */}
      {byBranch.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-4">
            <GitBranch className="w-4 h-4 text-slate-500" />
            <h2 className="font-semibold text-slate-700 text-sm">Theo chi nhánh (12 tháng gần nhất)</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="bg-slate-50">
                {['Chi nhánh', 'Mã', 'Số chứng từ', 'Chi phí (USD)'].map(h => (
                  <th key={h} className="px-4 py-2 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr></thead>
              <tbody className="divide-y divide-slate-100">
                {byBranch.sort((a, b) => b.count - a.count).map((b, i) => (
                  <tr key={b.branchId} className="hover:bg-slate-50">
                    <td className="px-4 py-2.5 font-medium text-slate-800">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                        {b.branch?.name ?? `Branch ${b.branchId}`}
                      </div>
                    </td>
                    <td className="px-4 py-2.5 font-mono text-slate-400 text-xs">{b.branch?.code}</td>
                    <td className="px-4 py-2.5 text-slate-700">{b.count}</td>
                    <td className="px-4 py-2.5 font-mono text-slate-600">${b.costUsd.toFixed(4)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
