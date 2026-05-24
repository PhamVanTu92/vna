import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authMiddleware, AuthRequest } from '../auth/authMiddleware';

const router = Router();
router.use(authMiddleware as any);

// GET /api/reconcile — list với filter
router.get('/', async (req: AuthRequest, res) => {
  const { status, period, branchId, search, page = '1', limit = '20' } = req.query as Record<string,string>;
  const isAdmin = req.user!.role === 'system_admin';
  const skip = (parseInt(page) - 1) * parseInt(limit);

  const where: any = {};
  if (!isAdmin) where.branchId = req.user!.branchId ?? -1;
  else if (branchId) where.branchId = parseInt(branchId);
  if (status) where.status = status;
  if (period) where.document = { period };
  if (search) where.document = { ...where.document, fileName: { contains: search } };

  const [items, total] = await Promise.all([
    prisma.reconcileResult.findMany({
      where, skip, take: parseInt(limit),
      include: { document: { select: { fileName: true, period: true, branch: { select: { name: true, code: true } } } } },
      orderBy: { createdAt: 'desc' }
    }),
    prisma.reconcileResult.count({ where })
  ]);

  return res.json({ items, total, page: parseInt(page), limit: parseInt(limit) });
});

// GET /api/reconcile/summary — thống kê tổng hợp
router.get('/summary', async (req: AuthRequest, res) => {
  const isAdmin = req.user!.role === 'system_admin';
  const where: any = {};
  if (!isAdmin) where.branchId = req.user!.branchId ?? -1;

  const [matched, minorMismatch, majorMismatch, notFound] = await Promise.all([
    prisma.reconcileResult.count({ where: { ...where, status: 'matched' } }),
    prisma.reconcileResult.count({ where: { ...where, status: 'mismatch_minor' } }),
    prisma.reconcileResult.count({ where: { ...where, status: 'mismatch_major' } }),
    prisma.reconcileResult.count({ where: { ...where, status: 'not_found' } }),
  ]);

  return res.json({ matched, minorMismatch, majorMismatch, notFound, total: matched + minorMismatch + majorMismatch + notFound });
});

// PUT /api/reconcile/:id — update
router.put('/:id', async (req: AuthRequest, res) => {
  const id = parseInt(req.params.id);
  const { gasAmount, gasRef, status } = req.body;
  const item = await prisma.reconcileResult.findUnique({ where: { id } });
  if (!item) return res.status(404).json({ error: 'Not found' });

  const updated = await prisma.reconcileResult.update({
    where: { id },
    data: {
      gasAmount: gasAmount ?? item.gasAmount,
      gasRef: gasRef ?? item.gasRef,
      status: status ?? item.status,
      difference: (gasAmount ?? item.gasAmount ?? 0) - item.ocrAmount
    }
  });
  return res.json(updated);
});

// POST /api/reconcile/:id/flag
router.post('/:id/flag', async (req: AuthRequest, res) => {
  const id = parseInt(req.params.id);
  const { flagReason, flagNote } = req.body;
  const updated = await prisma.reconcileResult.update({
    where: { id },
    data: { flagReason, flagNote, status: 'flagged' }
  });
  await prisma.auditLog.create({
    data: {
      action: 'MISMATCH_FLAGGED',
      userId: req.user!.id,
      branchId: updated.branchId,
      detail: `Flag reconcile #${id}: ${flagReason}`,
      ipAddress: req.ip
    }
  });
  return res.json(updated);
});

// POST /api/reconcile/:id/approve
router.post('/:id/approve', async (req: AuthRequest, res) => {
  const id = parseInt(req.params.id);
  const updated = await prisma.reconcileResult.update({
    where: { id },
    data: { approvedById: req.user!.id, approvedAt: new Date(), status: 'approved' }
  });
  await prisma.auditLog.create({
    data: {
      action: 'BATCH_APPROVED',
      userId: req.user!.id,
      branchId: updated.branchId,
      detail: `Approved reconcile #${id}`,
      ipAddress: req.ip
    }
  });
  return res.json(updated);
});

export default router;
