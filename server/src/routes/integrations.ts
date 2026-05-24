import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authMiddleware, AuthRequest } from '../auth/authMiddleware';

const router = Router();
router.use(authMiddleware as any);

// Seed defaults nếu chưa có
async function ensureDefaults() {
  const defaults = [
    { name: 'gas_oracle', displayName: 'GAS — General Accounting System' },
    { name: 'payment_system', displayName: 'Payment Request System' },
    { name: 'smtp', displayName: 'Email Notification (SMTP)' },
    { name: 'teams', displayName: 'Microsoft Teams Notification' },
  ];
  for (const d of defaults) {
    await prisma.integrationConfig.upsert({
      where: { name: d.name },
      create: { name: d.name, displayName: d.displayName, config: '{}' },
      update: {}
    });
  }
}

router.get('/', async (_req, res) => {
  await ensureDefaults();
  const items = await prisma.integrationConfig.findMany({ orderBy: { id: 'asc' } });
  return res.json(items);
});

router.put('/:name', async (req: AuthRequest, res) => {
  const { name } = req.params;
  const { isActive, config } = req.body;
  const updated = await prisma.integrationConfig.upsert({
    where: { name },
    create: { name, displayName: name, isActive, config: JSON.stringify(config ?? {}) },
    update: { isActive, config: JSON.stringify(config ?? {}) }
  });
  return res.json(updated);
});

router.post('/:name/test', async (_req, res) => {
  // Mock test — trong thực tế sẽ ping hệ thống
  return res.json({ success: true, message: 'Kết nối thành công (mock)' });
});

export default router;
