import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authMiddleware, AuthRequest } from '../auth/authMiddleware';

const router = Router();
router.use(authMiddleware as any);

// ── Local type (avoid implicit any in strict mode) ────────────────────────────
type DocRow = {
  period:     string | null;
  tokensUsed: number | null;
  costUsd:    number | null;
};

// ── GET /api/stats ────────────────────────────────────────────────────────────
// Trả về thống kê 12 tháng gần nhất cho chi nhánh hiện tại (hoặc tất cả với system_admin)
router.get('/', async (req: AuthRequest, res) => {
  const branchFilter =
    req.user!.role === 'system_admin' ? {} : { branchId: req.user!.branchId ?? -1 };

  // 12 tháng gần nhất
  const months: string[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }

  // Tổng theo tháng
  const docs: DocRow[] = await prisma.ocrDocument.findMany({
    where: {
      ...branchFilter,
      status: 'completed',
      period: { in: months }
    },
    select: { period: true, tokensUsed: true, costUsd: true }
  });

  const monthly = months.map((month: string) => {
    const monthDocs = docs.filter((d: DocRow) => d.period === month);
    return {
      month,
      count:   monthDocs.length,
      tokens:  monthDocs.reduce((s: number, d: DocRow) => s + (d.tokensUsed ?? 0), 0),
      costUsd: monthDocs.reduce((s: number, d: DocRow) => s + (d.costUsd   ?? 0), 0)
    };
  });

  // KPI tháng hiện tại
  const currentMonth = months[11];
  const currentMonthDocs = docs.filter((d: DocRow) => d.period === currentMonth);
  const kpi = {
    thisMonth:     currentMonthDocs.length,
    thisMonthCost: currentMonthDocs.reduce((s: number, d: DocRow) => s + (d.costUsd ?? 0), 0),
    total:         docs.length,
    totalCost:     docs.reduce((s: number, d: DocRow) => s + (d.costUsd ?? 0), 0),
  };

  // Per-branch breakdown (chỉ system_admin)
  let byBranch: object[] = [];
  if (req.user!.role === 'system_admin') {
    // Prisma infers these types — annotating them directly conflicts with generic constraints
    const branchDocs = await prisma.ocrDocument.groupBy({
      by: ['branchId'],
      where: { status: 'completed', period: { in: months } },
      _count: { id: true },
      _sum:   { costUsd: true }
    });
    const branches = await prisma.branch.findMany({
      where: { id: { in: branchDocs.map(b => b.branchId) } },
      select: { id: true, name: true, code: true }
    });
    byBranch = branchDocs.map(b => ({
      branchId: b.branchId,
      branch:   branches.find(br => br.id === b.branchId),
      count:    b._count.id,
      costUsd:  b._sum.costUsd ?? 0
    }));
  }

  return res.json({ monthly, kpi, byBranch });
});

export default router;
