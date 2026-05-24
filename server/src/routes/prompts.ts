import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authMiddleware, AuthRequest } from '../auth/authMiddleware';

const router = Router();
router.use(authMiddleware as any);

router.get('/', async (req: AuthRequest, res) => {
  const isAdmin = req.user!.role === 'system_admin';
  const where: any = {};
  if (!isAdmin) where.branchId = req.user!.branchId ?? -1;
  const items = await prisma.promptConfig.findMany({
    where,
    orderBy: { updatedAt: 'desc' }
  });
  return res.json(items);
});

router.post('/', async (req: AuthRequest, res) => {
  const { branchId, docType, name, promptText } = req.body;
  const item = await prisma.promptConfig.upsert({
    where: { branchId_docType: { branchId: parseInt(branchId), docType } },
    create: { branchId: parseInt(branchId), docType, name, promptText, updatedById: req.user!.id },
    update: { name, promptText, updatedById: req.user!.id }
  });
  await prisma.auditLog.create({
    data: { action: 'PROMPT_UPDATED', userId: req.user!.id, branchId: item.branchId, detail: `Prompt ${name} updated`, ipAddress: req.ip }
  });
  return res.json(item);
});

router.put('/:id', async (req: AuthRequest, res) => {
  const id = parseInt(req.params.id);
  const { name, promptText, isActive, testScore, testTotal, testCorrect } = req.body;
  const updated = await prisma.promptConfig.update({
    where: { id },
    data: { name, promptText, isActive, testScore, testTotal, testCorrect, updatedById: req.user!.id }
  });
  return res.json(updated);
});

router.delete('/:id', async (req: AuthRequest, res) => {
  await prisma.promptConfig.delete({ where: { id: parseInt(req.params.id) } });
  return res.json({ success: true });
});

export default router;
