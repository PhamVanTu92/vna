import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authMiddleware, AuthRequest } from '../auth/authMiddleware';

const router = Router();
router.use(authMiddleware as any);

router.get('/:branchId/:docType', async (req, res) => {
  const branchId = parseInt(req.params.branchId);
  const { docType } = req.params;
  const config = await prisma.inputConfig.findUnique({
    where: { branchId_docType: { branchId, docType } }
  });
  return res.json(config ?? { branchId, docType, fieldMappings: '[]', acceptedFormats: '["pdf","xlsx","jpg"]' });
});

router.put('/:branchId/:docType', async (req: AuthRequest, res) => {
  const branchId = parseInt(req.params.branchId);
  const { docType } = req.params;
  const { fieldMappings, acceptedFormats } = req.body;
  const config = await prisma.inputConfig.upsert({
    where: { branchId_docType: { branchId, docType } },
    create: { branchId, docType, fieldMappings: JSON.stringify(fieldMappings), acceptedFormats: JSON.stringify(acceptedFormats) },
    update: { fieldMappings: JSON.stringify(fieldMappings), acceptedFormats: JSON.stringify(acceptedFormats) }
  });
  return res.json(config);
});

export default router;
