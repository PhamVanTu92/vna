import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authMiddleware } from '../auth/authMiddleware';

const router = Router();
router.use(authMiddleware as any);

router.get('/:branchId', async (req, res) => {
  const branchId = parseInt(req.params.branchId);
  const config = await prisma.reconConfig.findUnique({ where: { branchId } });
  return res.json(config ?? { branchId, matchKeys: '["invoice_number","vendor","period"]', tolerancePct: 0.5, toleranceAmt: 1000, onNotFound: 'mark_new', autoApproveConf: 99.0, autoAfterOcr: true, scheduleBatch: true, scheduleType: 'daily_0200', maxTimeoutSec: 30 });
});

router.put('/:branchId', async (req, res) => {
  const branchId = parseInt(req.params.branchId);
  const data = req.body;
  if (data.matchKeys && Array.isArray(data.matchKeys)) data.matchKeys = JSON.stringify(data.matchKeys);
  const config = await prisma.reconConfig.upsert({
    where: { branchId },
    create: { branchId, ...data },
    update: data
  });
  return res.json(config);
});

export default router;
