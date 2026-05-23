import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authMiddleware, AuthRequest } from '../auth/authMiddleware';

const router = Router();
router.use(authMiddleware as any);

// ── GET /api/documents ────────────────────────────────────────────────────────
// system_admin xem tất cả; branch_admin + user chỉ xem chi nhánh mình
router.get('/', async (req: AuthRequest, res) => {
  const { period, page = '1', limit = '20' } = req.query as Record<string, string>;
  const skip = (parseInt(page) - 1) * parseInt(limit);

  const branchFilter =
    req.user!.role === 'system_admin' ? {} : { branchId: req.user!.branchId ?? -1 };

  const where: any = { ...branchFilter };
  if (period) where.period = period;

  const [documents, total] = await Promise.all([
    prisma.ocrDocument.findMany({
      where,
      select: {
        id: true, fileName: true, fileSize: true, period: true,
        status: true, geminiModel: true, tokensUsed: true, costUsd: true,
        createdAt: true, exportedAt: true,
        branch:     { select: { id: true, name: true, code: true } },
        uploadedBy: { select: { id: true, fullName: true } }
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: parseInt(limit)
    }),
    prisma.ocrDocument.count({ where })
  ]);

  return res.json({ documents, total, page: parseInt(page), limit: parseInt(limit) });
});

// ── GET /api/documents/:id ────────────────────────────────────────────────────
router.get('/:id', async (req: AuthRequest, res) => {
  const id = parseInt(req.params.id);
  const doc = await prisma.ocrDocument.findUnique({
    where: { id },
    include: {
      branch:     { select: { id: true, name: true, code: true } },
      uploadedBy: { select: { id: true, fullName: true } }
    }
  });

  if (!doc) return res.status(404).json({ error: 'Tài liệu không tìm thấy.' });

  // Kiểm tra quyền truy cập
  if (req.user!.role !== 'system_admin' && doc.branchId !== req.user!.branchId) {
    return res.status(403).json({ error: 'Không có quyền xem tài liệu này.' });
  }

  return res.json({ document: doc });
});

// ── PATCH /api/documents/:id/exported ────────────────────────────────────────
router.patch('/:id/exported', async (req: AuthRequest, res) => {
  const id  = parseInt(req.params.id);
  const doc = await prisma.ocrDocument.findUnique({ where: { id } });
  if (!doc) return res.status(404).json({ error: 'Tài liệu không tìm thấy.' });
  if (req.user!.role !== 'system_admin' && doc.branchId !== req.user!.branchId) {
    return res.status(403).json({ error: 'Không có quyền.' });
  }
  await prisma.ocrDocument.update({ where: { id }, data: { exportedAt: new Date() } });
  return res.json({ message: 'Đã đánh dấu đã xuất.' });
});

export default router;
