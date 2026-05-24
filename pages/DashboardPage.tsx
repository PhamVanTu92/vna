import React, { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const token = () => localStorage.getItem('auth_token') ?? '';

interface KpiData { thisMonth: number; completed: number; processing: number; mismatches: number; }
interface AuditItem { id: number; action: string; detail: string; branchId?: number; createdAt: string; }
interface BranchStat { id: number; name: string; code: string; docsThisMonth: number; completed: number; mismatches: number; totalCost: number; status: string; }

export const DashboardPage: React.FC = () => {
  const [kpi, setKpi] = useState<KpiData>({ thisMonth: 0, completed: 0, processing: 0, mismatches: 0 });
  const [recentActivity, setRecentActivity] = useState<AuditItem[]>([]);
  const [branchStats, setBranchStats] = useState<BranchStat[]>([]);
  const [chartData, setChartData] = useState<{name:string;value:number}[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [statsRes, auditRes, reconRes] = await Promise.all([
          fetch('/api/stats', { headers: { Authorization: `Bearer ${token()}` } }),
          fetch('/api/audit-log?limit=5', { headers: { Authorization: `Bearer ${token()}` } }),
          fetch('/api/reconcile/summary', { headers: { Authorization: `Bearer ${token()}` } }),
        ]);
        if (statsRes.ok) {
          const stats = await statsRes.json();
          // Build chart data from monthly
          const chart = (stats.monthly ?? []).slice(-5).map((m: any) => ({ name: m.month?.slice(5), value: m.count }));
          setChartData(chart);
          setKpi({
            thisMonth: stats.kpi?.thisMonth ?? 0,
            completed: stats.kpi?.total ?? 0,
            processing: 0,
            mismatches: 0
          });
        }
        if (auditRes.ok) {
          const { items } = await auditRes.json();
          setRecentActivity(items ?? []);
        }
        if (reconRes.ok) {
          const reconData = await reconRes.json();
          setKpi(prev => ({ ...prev, mismatches: (reconData.minorMismatch ?? 0) + (reconData.majorMismatch ?? 0) }));
        }
      } catch {}
      setLoading(false);
    };
    fetchAll();
  }, []);

  const actIcon: Record<string, string> = {
    OCR_COMPLETED: '🔍', BATCH_APPROVED: '✅', FILE_UPLOADED: '📤',
    MISMATCH_DETECTED: '⚠️', GAS_PUSH_SUCCESS: '📨', USER_LOGIN: '🔐',
    PROMPT_UPDATED: '⚙️', MISMATCH_FLAGGED: '🚨'
  };
  const actClass: Record<string, string> = {
    OCR_COMPLETED: 'ds-ai-ocr', BATCH_APPROVED: 'ds-ai-ok', FILE_UPLOADED: 'ds-ai-push',
    MISMATCH_DETECTED: 'ds-ai-warn', GAS_PUSH_SUCCESS: 'ds-ai-push', USER_LOGIN: 'ds-ai-ocr',
    MISMATCH_FLAGGED: 'ds-ai-err'
  };

  const timeAgo = (dt: string) => {
    const diff = (Date.now() - new Date(dt).getTime()) / 1000;
    if (diff < 60) return `${Math.floor(diff)}s`;
    if (diff < 3600) return `${Math.floor(diff/60)} phút`;
    if (diff < 86400) return `${Math.floor(diff/3600)} giờ`;
    return `${Math.floor(diff/86400)} ngày`;
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="text-[13px]" style={{ color: 'var(--t3)' }}>Đang tải...</div>
    </div>
  );

  return (
    <div>
      {/* Page header */}
      <div className="flex items-end justify-between mb-[18px] gap-3">
        <div>
          <div className="text-[19px] font-extrabold" style={{ color: 'var(--t1)' }}>📊 Dashboard Tổng quan</div>
          <div className="text-[12.5px] mt-1" style={{ color: 'var(--t2)' }}>
            Kỳ tháng {new Date().toLocaleDateString('vi-VN', { month: '2-digit', year: 'numeric' })} · Hệ thống đối soát VNA
          </div>
        </div>
        <div className="flex gap-2 items-center flex-shrink-0">
          <span className="ds-ai-pill"><span className="ds-ai-dot"></span>AI Active</span>
          <button className="ds-btn ds-btn-s ds-btn-sm" onClick={() => alert('Xuất PDF...')}>📄 Xuất</button>
          <a href="/upload" className="ds-btn ds-btn-p ds-btn-sm">+ Upload</a>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <div className="ds-kpi ds-kpi-or">
          <div className="ds-kpi-label">Chứng từ tháng này</div>
          <div className="ds-kpi-val">{kpi.thisMonth.toLocaleString()}</div>
          <div className="ds-kpi-sub" style={{ color: 'var(--t2)' }}>Tổng đã xử lý: {kpi.completed.toLocaleString()}</div>
          <div className="ds-kpi-bg">📄</div>
        </div>
        <div className="ds-kpi ds-kpi-gn">
          <div className="ds-kpi-label">Đã đối soát xong</div>
          <div className="ds-kpi-val">{kpi.completed.toLocaleString()}</div>
          <div className="ds-kpi-sub"><span className="ds-c-ok font-bold">Hoàn thành</span></div>
          <div className="ds-kpi-bg">✅</div>
        </div>
        <div className="ds-kpi ds-kpi-bl">
          <div className="ds-kpi-label">Đang xử lý</div>
          <div className="ds-kpi-val">{kpi.processing}</div>
          <div className="ds-kpi-sub"><span className="ds-ai-pill text-[9.5px] px-1.5 py-0.5"><span className="ds-ai-dot"></span>AI batch</span></div>
          <div className="ds-kpi-bg">⚙️</div>
        </div>
        <div className="ds-kpi ds-kpi-pu">
          <div className="ds-kpi-label">Chênh lệch phát hiện</div>
          <div className="ds-kpi-val">{kpi.mismatches}</div>
          <div className="ds-kpi-sub">Cần review</div>
          <div className="ds-kpi-bg">⚠️</div>
        </div>
      </div>

      {/* Charts + Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mb-4">
        <div className="ds-card lg:col-span-2">
          <div className="ds-ch">
            <div className="ds-ch-title"><div className="ds-ch-ic" style={{ background: 'var(--info-bg)' }}>📈</div>Khối lượng xử lý</div>
          </div>
          <div className="ds-cb">
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'var(--t3)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: 'var(--t3)' }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, fontSize: 11 }}
                  cursor={{ fill: 'rgba(0,0,0,.04)' }}
                />
                <Bar dataKey="value" radius={[3,3,0,0]}>
                  {chartData.map((_, i) => (
                    <Cell key={i} fill={i === chartData.length - 1 ? '#CBD5E1' : i < Math.ceil(chartData.length/2) ? '#3B82F6' : '#FF7A00'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="ds-card">
          <div className="ds-ch">
            <div className="ds-ch-title"><div className="ds-ch-ic" style={{ background: 'var(--fox-lt)' }}>⚡</div>Hoạt động gần đây</div>
            <span className="ds-badge ds-b-info text-[10px]">Live</span>
          </div>
          <div className="p-3">
            {recentActivity.length === 0 ? (
              <div className="text-[12px] text-center py-8" style={{ color: 'var(--t3)' }}>Chưa có hoạt động</div>
            ) : recentActivity.map(item => (
              <div key={item.id} className="ds-act-item">
                <div className={`ds-act-ic ${actClass[item.action] ?? 'ds-ai-ocr'}`}>{actIcon[item.action] ?? '📋'}</div>
                <div className="flex-1 min-w-0">
                  <div className="ds-act-title truncate">{item.action}</div>
                  <div className="ds-act-meta truncate">{item.detail}</div>
                </div>
                <div className="ds-act-time">{timeAgo(item.createdAt)}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Quick actions */}
      <div className="ds-card">
        <div className="ds-ch">
          <div className="ds-ch-title">🚀 Truy cập nhanh</div>
        </div>
        <div className="ds-cb">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { href: '/upload', icon: '📤', label: 'Upload & OCR', color: 'var(--fox-lt)' },
              { href: '/reconcile', icon: '🔍', label: 'Đối soát', color: 'var(--info-bg)' },
              { href: '/summary', icon: '📋', label: 'Báo cáo', color: 'var(--ok-bg)' },
              { href: '/admin/audit', icon: '📜', label: 'Nhật ký', color: 'var(--ai-bg)' },
            ].map(item => (
              <a key={item.href} href={item.href}
                className="flex flex-col items-center gap-2 p-4 rounded-[10px] cursor-pointer transition-all hover:shadow-md"
                style={{ background: item.color, border: '1px solid var(--border)' }}>
                <span className="text-2xl">{item.icon}</span>
                <span className="text-[12px] font-semibold" style={{ color: 'var(--t1)' }}>{item.label}</span>
              </a>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
