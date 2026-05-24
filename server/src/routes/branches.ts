import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authMiddleware, requireRole, AuthRequest } from '../auth/authMiddleware';

const router = Router();
router.use(authMiddleware as any);

// ── GET /api/admin/branches ───────────────────────────────────────────────────
router.get('/', async (_req, res) => {
  const branches = await prisma.branch.findMany({
    where: { isActive: true },
    include: {
      settings: { select: { geminiModel: true } },
      _count:   { select: { users: { where: { isActive: true } } } }
    },
    orderBy: [{ parentId: 'asc' }, { name: 'asc' }]
  });
  return res.json(branches);
});

// ── POST /api/admin/branches ──────────────────────────────────────────────────
router.post('/', requireRole('system_admin'), async (_req: AuthRequest, res) => {
  const { name, code, description, parentId } = _req.body;
  if (!name || !code) return res.status(400).json({ error: 'name và code là bắt buộc.' });

  const exists = await prisma.branch.findUnique({ where: { code } });
  if (exists) return res.status(409).json({ error: `Mã chi nhánh "${code}" đã tồn tại.` });

  const branch = await prisma.branch.create({
    data: { name, code: code.toUpperCase(), description, parentId: parentId ?? null }
  });
  return res.status(201).json({ branch });
});

// ── PUT /api/admin/branches/:id ───────────────────────────────────────────────
router.put('/:id', requireRole('system_admin'), async (req, res) => {
  const id = parseInt(req.params.id);
  const { name, description, isActive } = req.body;
  const branch = await prisma.branch.update({
    where: { id },
    data: { name, description, isActive }
  });
  return res.json({ branch });
});

// ── GET /api/admin/branches/:id/settings ─────────────────────────────────────
router.get('/:id/settings', requireRole('system_admin', 'branch_admin'), async (req: AuthRequest, res) => {
  const branchId = parseInt(req.params.id);

  // branch_admin chỉ xem settings chi nhánh của mình
  if (req.user!.role === 'branch_admin' && req.user!.branchId !== branchId) {
    return res.status(403).json({ error: 'Không có quyền xem settings chi nhánh này.' });
  }

  const settings = await prisma.branchSettings.findUnique({ where: { branchId } });
  return res.json({ settings });
});

// ── PUT /api/admin/branches/:id/settings ─────────────────────────────────────
router.put('/:id/settings', requireRole('system_admin', 'branch_admin'), async (req: AuthRequest, res) => {
  const branchId  = parseInt(req.params.id);
  const { systemPrompt, geminiModel } = req.body;

  if (req.user!.role === 'branch_admin' && req.user!.branchId !== branchId) {
    return res.status(403).json({ error: 'Không có quyền sửa settings chi nhánh này.' });
  }

  const settings = await prisma.branchSettings.upsert({
    where:  { branchId },
    update: { systemPrompt: systemPrompt ?? null, geminiModel: geminiModel ?? 'gemini-3-pro-preview', updatedById: req.user!.id },
    create: { branchId, systemPrompt: systemPrompt ?? null, geminiModel: geminiModel ?? 'gemini-3-pro-preview', updatedById: req.user!.id }
  });
  return res.json({ settings });
});

export default router;
