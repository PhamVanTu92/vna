import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authMiddleware, AuthRequest } from '../auth/authMiddleware';

const router = Router();
router.use(authMiddleware as any);

router.get('/', async (req: AuthRequest, res) => {
  const { action, userId, branchId, date, search, page = '1', limit = '20' } = req.query as Record<string,string>;
  const isAdmin = req.user!.role === 'system_admin';
  const skip = (parseInt(page) - 1) * parseInt(limit);

  const where: any = {};
  if (!isAdmin) where.branchId = req.user!.branchId ?? -1;
  else if (branchId) where.branchId = parseInt(branchId);
  if (action) where.action = action;
  if (userId) where.userId = parseInt(userId);
  if (search) where.detail = { contains: search };
  if (date) {
    const d = new Date(date);
    const nextDay = new Date(d); nextDay.setDate(nextDay.getDate() + 1);
    where.createdAt = { gte: d, lt: nextDay };
  }

  const [items, total] = await Promise.all([
    prisma.auditLog.findMany({ where, skip, take: parseInt(limit), orderBy: { createdAt: 'desc' } }),
    prisma.auditLog.count({ where })
  ]);

  return res.json({ items, total, page: parseInt(page), limit: parseInt(limit) });
});

export default router;
