import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authMiddleware } from '../auth/authMiddleware';

const router = Router();
router.use(authMiddleware as any);

router.get('/:branchId', async (req, res) => {
  const branchId = parseInt(req.params.branchId);
  const config = await prisma.outputConfig.findUnique({ where: { branchId } });
  return res.json(config ?? { branchId, templateName: 'CV2006_Template_VNA_v3.xlsx', startRow: 5, currencyFormat: '¥ #,##0.00', dateFormat: 'YYYY-MM-DD', includeAIConfidence: true, includeAuditTrail: true, columnMapping: '[]' });
});

router.put('/:branchId', async (req, res) => {
  const branchId = parseInt(req.params.branchId);
  const { templateName, startRow, currencyFormat, dateFormat, includeAIConfidence, includeAuditTrail, columnMapping } = req.body;
  const config = await prisma.outputConfig.upsert({
    where: { branchId },
    create: { branchId, templateName, startRow, currencyFormat, dateFormat, includeAIConfidence, includeAuditTrail, columnMapping: JSON.stringify(columnMapping) },
    update: { templateName, startRow, currencyFormat, dateFormat, includeAIConfidence, includeAuditTrail, columnMapping: JSON.stringify(columnMapping) }
  });
  return res.json(config);
});

export default router;
