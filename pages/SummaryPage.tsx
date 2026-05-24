import React, { useEffect, useState } from 'react';

const token = () => localStorage.getItem('auth_token') ?? '';

interface BranchRow {
  id: number;
  code: string;
  name: string;
  groundHandling: number;
  airportCharges: number;
  fuel: number;
  catering: number;
  total: number;
  difference: number;
  matchRate: number;
  count: number;
}

interface KpiData {
  totalCost: number;
  matchRate: number;
  totalDiff: number;
  aiSavings: number;
  totalDocs: number;
  matchedDocs: number;
}

export const SummaryPage: React.FC = () => {
  const [kpi, setKpi]       = useState<KpiData>({ totalCost: 0, matchRate: 0, totalDiff: 0, aiSavings: 0, totalDocs: 0, matchedDocs: 0 });
  const [rows, setRows]     = useState<BranchRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod]  = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

  const load = async () => {
    setLoading(true);
    try {
      const [statsRes, reconRes, branchRes] = await Promise.all([
        fetch(`/api/stats`, { headers: { Authorization: `Bearer ${token()}` } }),
        fetch(`/api/reconcile?limit=1000&period=${period}`, { headers: { Authorization: `Bearer ${token()}` } }),
        fetch('/api/branches', { headers: { Authorization: `Bearer ${token()}` } }),
      ]);

      let allItems: any[] = [];
      let branches: any[]  = [];

      if (reconRes.ok) { const d = await reconRes.json(); allItems = d.items ?? []; }
      if (branchRes.ok) { const d = await branchRes.json(); branches = d ?? []; }

      // Compute KPI
      const matched = allItems.filter((i: any) => i.status === 'matched' || i.status === 'approved');
      const totalCost = allItems.reduce((s: number, i: any) => s + (i.ocrAmount ?? 0), 0);
      const totalDiff = allItems.reduce((s: number, i: any) => s + Math.abs(i.difference ?? 0), 0);
      const matchRate = allItems.length > 0 ? (matched.length / allItems.length) * 100 : 0;

      if (statsRes.ok) {
        const st = await statsRes.json();
        setKpi({
          totalCost,
          matchRate,
          totalDiff,
          aiSavings: st.kpi?.thisMonthCost ?? 0,
          totalDocs: allItems.length,
          matchedDocs: matched.length,
        });
      } else {
        setKpi({ totalCost, matchRate, totalDiff, aiSavings: 0, totalDocs: allItems.length, matchedDocs: matched.length });
      }

      // Build branch rows
      const branchRows: BranchRow[] = branches.map((b: any) => {
        const bItems = allItems.filter((i: any) => i.branchId === b.id);
        const byType = (t: string) => bItems
          .filter((i: any) => i.document?.docType === t)
          .reduce((s: number, i: any) => s + (i.ocrAmount ?? 0), 0);
        const total = bItems.reduce((s: number, i: any) => s + (i.ocrAmount ?? 0), 0);
        const diff  = bItems.reduce((s: number, i: any) => s + Math.abs(i.difference ?? 0), 0);
        const ok    = bItems.filter((i: any) => i.status === 'matched' || i.status === 'approved').length;
        return {
          id: b.id, code: b.code, name: b.name,
          groundHandling: byType('ground_handling'),
          airportCharges: byType('airport_charges'),
          fuel: byType('fuel'),
          catering: byType('catering'),
          total, difference: diff,
          matchRate: bItems.length > 0 ? (ok / bItems.length) * 100 : 0,
          count: bItems.length,
        };
      }).filter((r: BranchRow) => r.count > 0);

      setRows(branchRows);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { load(); }, [period]);

  const fmt = (v: number) => v === 0 ? '—' : `¥${v.toLocaleString('ja-JP', { maximumFractionDigits: 0 })}`;
  const fmtPct = (v: number) => `${v.toFixed(1)}%`;

  const matchColor = (r: number) => r >= 95 ? 'var(--ok)' : r >= 80 ? 'var(--warn)' : 'var(--err)';

  const exportCSV = () => {
    const header = 'Chi nhánh,Ground Hdl,Airport Chrg,Fuel,Catering,Tổng,Chênh lệch,% Khớp\n';
    const csv = rows.map(r =>
      `${r.code} ${r.name},${r.groundHandling},${r.airportCharges},${r.fuel},${r.catering},${r.total},${r.difference},${r.matchRate.toFixed(1)}%`
    ).join('\n');
    const blob = new Blob([header + csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a'); a.href = url;
    a.download = `VNA_Summary_${period}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-end justify-between mb-4 gap-3">
        <div>
          <div className="text-[19px] font-extrabold" style={{ color: 'var(--t1)' }}>📋 Tổng hợp Đối soát</div>
          <div className="text-[12.5px] mt-1" style={{ color: 'var(--t2)' }}>
            Tổng quan chi phí theo chi nhánh và loại dịch vụ
          </div>
        </div>
        <div className="flex gap-2 items-center flex-shrink-0">
          <input type="month" className="ds-finp" value={period}
            onChange={e => setPeriod(e.target.value)} style={{ width: 145 }} />
          <button className="ds-btn ds-btn-s ds-btn-sm" onClick={exportCSV}>📥 CSV</button>
          <button className="ds-btn ds-btn-s ds-btn-sm" onClick={() => window.print()}>🖨️ PDF</button>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <div className="ds-kpi ds-kpi-or">
          <div className="ds-kpi-label">Tổng chi phí kỳ này</div>
          <div className="ds-kpi-val" style={{ fontSize: 18 }}>{fmt(kpi.totalCost)}</div>
          <div className="ds-kpi-sub">{kpi.totalDocs} chứng từ</div>
          <div className="ds-kpi-bg">💰</div>
        </div>
        <div className="ds-kpi ds-kpi-gn">
          <div className="ds-kpi-label">Tỷ lệ khớp</div>
          <div className="ds-kpi-val">{fmtPct(kpi.matchRate)}</div>
          <div className="ds-kpi-sub">{kpi.matchedDocs}/{kpi.totalDocs} bản ghi</div>
          <div className="ds-kpi-bg">✅</div>
        </div>
        <div className="ds-kpi ds-kpi-pu">
          <div className="ds-kpi-label">Tổng chênh lệch</div>
          <div className="ds-kpi-val" style={{ fontSize: 18 }}>{fmt(kpi.totalDiff)}</div>
          <div className="ds-kpi-sub">Cần xem xét</div>
          <div className="ds-kpi-bg">⚠️</div>
        </div>
        <div className="ds-kpi ds-kpi-bl">
          <div className="ds-kpi-label">Tiết kiệm nhờ AI</div>
          <div className="ds-kpi-val" style={{ fontSize: 18 }}>{fmt(kpi.aiSavings * 100)}</div>
          <div className="ds-kpi-sub">Ước tính chi phí thủ công</div>
          <div className="ds-kpi-bg">🤖</div>
        </div>
      </div>

      {/* Matrix table */}
      <div className="ds-card overflow-hidden">
        <div className="ds-ch">
          <div className="ds-ch-title">
            <div className="ds-ch-ic" style={{ background: 'var(--info-bg)' }}>🗺️</div>
            Chi tiết theo Chi nhánh × Loại dịch vụ
          </div>
          <span className="ds-badge ds-b-gray">{period}</span>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="ds-dt">
            <thead>
              <tr>
                <th>Chi nhánh (Airport)</th>
                <th style={{ textAlign: 'right' }}>
                  <span className="ds-tag ds-t-grd">Ground Hdl</span>
                </th>
                <th style={{ textAlign: 'right' }}>
                  <span className="ds-tag ds-t-apt">Airport Chrg</span>
                </th>
                <th style={{ textAlign: 'right' }}>
                  <span className="ds-tag ds-t-fuel">Fuel</span>
                </th>
                <th style={{ textAlign: 'right' }}>
                  <span className="ds-tag ds-t-ctr">Catering</span>
                </th>
                <th style={{ textAlign: 'right' }}>Tổng</th>
                <th style={{ textAlign: 'right' }}>Chênh lệch</th>
                <th style={{ textAlign: 'center' }}>% Khớp</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} style={{ textAlign: 'center', padding: 32, color: 'var(--t3)' }}>Đang tải...</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={8} style={{ textAlign: 'center', padding: 32, color: 'var(--t3)' }}>
                  Chưa có dữ liệu cho kỳ {period}
                </td></tr>
              ) : (
                <>
                  {rows.map(r => (
                    <tr key={r.id}>
                      <td>
                        <div className="flex items-center gap-2">
                          <span className="ds-badge ds-b-gray">{r.code}</span>
                          <span style={{ color: 'var(--t2)', fontSize: 12 }}>{r.name}</span>
                        </div>
                      </td>
                      <td style={{ textAlign: 'right' }}><span className="ds-amt ds-c2">{fmt(r.groundHandling)}</span></td>
                      <td style={{ textAlign: 'right' }}><span className="ds-amt ds-c2">{fmt(r.airportCharges)}</span></td>
                      <td style={{ textAlign: 'right' }}><span className="ds-amt ds-c2">{fmt(r.fuel)}</span></td>
                      <td style={{ textAlign: 'right' }}><span className="ds-amt ds-c2">{fmt(r.catering)}</span></td>
                      <td style={{ textAlign: 'right' }}><span className="ds-amt font-extrabold">{fmt(r.total)}</span></td>
                      <td style={{ textAlign: 'right' }}>
                        <span className="ds-amt" style={{ color: r.difference > 0 ? 'var(--warn)' : 'var(--t3)' }}>
                          {fmt(r.difference)}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <div className="flex items-center justify-center gap-2">
                          <div style={{ width: 48, height: 4, background: 'var(--border)', borderRadius: 2, overflow: 'hidden' }}>
                            <div style={{ width: `${r.matchRate}%`, height: '100%', background: matchColor(r.matchRate), borderRadius: 2 }} />
                          </div>
                          <span className="ds-mono text-[11px]" style={{ color: matchColor(r.matchRate) }}>
                            {fmtPct(r.matchRate)}
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {/* Totals row */}
                  <tr style={{ background: 'var(--surface-2)', fontWeight: 800 }}>
                    <td style={{ fontWeight: 800 }}>📊 TỔNG CỘNG</td>
                    <td style={{ textAlign: 'right' }}><span className="ds-amt">{fmt(rows.reduce((s,r) => s+r.groundHandling, 0))}</span></td>
                    <td style={{ textAlign: 'right' }}><span className="ds-amt">{fmt(rows.reduce((s,r) => s+r.airportCharges, 0))}</span></td>
                    <td style={{ textAlign: 'right' }}><span className="ds-amt">{fmt(rows.reduce((s,r) => s+r.fuel, 0))}</span></td>
                    <td style={{ textAlign: 'right' }}><span className="ds-amt">{fmt(rows.reduce((s,r) => s+r.catering, 0))}</span></td>
                    <td style={{ textAlign: 'right' }}><span className="ds-amt ds-c-fox">{fmt(rows.reduce((s,r) => s+r.total, 0))}</span></td>
                    <td style={{ textAlign: 'right' }}><span className="ds-amt ds-c-warn">{fmt(rows.reduce((s,r) => s+r.difference, 0))}</span></td>
                    <td style={{ textAlign: 'center' }}>
                      <span className="ds-mono" style={{ color: matchColor(kpi.matchRate) }}>{fmtPct(kpi.matchRate)}</span>
                    </td>
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Info footer */}
      <div className="flex gap-2 mt-3 flex-wrap">
        <span className="ds-ai-pill"><span className="ds-ai-dot"></span>Dữ liệu tổng hợp từ AI OCR</span>
        <span style={{ fontSize: 11, color: 'var(--t3)' }}>
          Cập nhật lần cuối: {new Date().toLocaleString('vi-VN')}
        </span>
      </div>
    </div>
  );
};
