import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authMiddleware, requireRole, AuthRequest } from '../auth/authMiddleware';

const router = Router();
router.use(authMiddleware as any);

// 4 loại mặc định — tự seed nếu bảng trống
const DEFAULTS = [
  { code: 'ground_handling', name: 'Ground Handling', icon: '✈️', color: '#5B21B6', bgColor: '#EDE9FE', sortOrder: 0 },
  { code: 'airport_charges', name: 'Airport Charges',  icon: '🏢', color: '#1E40AF', bgColor: '#DBEAFE', sortOrder: 1 },
  { code: 'fuel',            name: 'Fuel',             icon: '⛽', color: '#92400E', bgColor: '#FEF3C7', sortOrder: 2 },
  { code: 'catering',        name: 'Catering',         icon: '🍱', color: '#166534', bgColor: '#DCFCE7', sortOrder: 3 },
];

async function seedDefaults() {
  const count = await prisma.docType.count();
  if (count === 0) {
    for (const d of DEFAULTS) {
      await prisma.docType.create({ data: d }).catch(() => {});
    }
  }
}

// GET /api/doc-types — active only (dùng trong các trang render)
router.get('/', async (_req, res) => {
  await seedDefaults();
  const types = await prisma.docType.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
  });
  return res.json(types);
});

// GET /api/doc-types/all — tất cả kể cả inactive (dùng trong trang quản lý)
router.get('/all', requireRole('system_admin', 'branch_admin') as any, async (_req, res) => {
  await seedDefaults();
  const types = await prisma.docType.findMany({
    orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
  });
  return res.json(types);
});

// POST /api/doc-types — tạo loại mới
router.post('/', requireRole('system_admin', 'branch_admin') as any, async (req: AuthRequest, res) => {
  const { code, name, icon, color, bgColor, sortOrder } = req.body;
  if (!code || !name) return res.status(400).json({ error: 'code và name là bắt buộc' });

  const cleanCode = String(code).toLowerCase().trim().replace(/\s+/g, '_');
  try {
    const dt = await prisma.docType.create({
      data: {
        code: cleanCode,
        name: String(name).trim(),
        icon:     icon     || '📄',
        color:    color    || '#5B21B6',
        bgColor:  bgColor  || '#EDE9FE',
        sortOrder: sortOrder ?? 99,
      },
    });
    return res.status(201).json(dt);
  } catch (e: any) {
    if (e.code === 'P2002') return res.status(409).json({ error: `Mã "${cleanCode}" đã tồn tại` });
    return res.status(500).json({ error: 'Lỗi server' });
  }
});

// PUT /api/doc-types/:id — cập nhật
router.put('/:id', requireRole('system_admin', 'branch_admin') as any, async (req, res) => {
  const id = parseInt(req.params.id);
  const { name, icon, color, bgColor, sortOrder, isActive } = req.body;
  const dt = await prisma.docType.update({
    where: { id },
    data: {
      ...(name      !== undefined && { name }),
      ...(icon      !== undefined && { icon }),
      ...(color     !== undefined && { color }),
      ...(bgColor   !== undefined && { bgColor }),
      ...(sortOrder !== undefined && { sortOrder }),
      ...(isActive  !== undefined && { isActive }),
    },
  });
  return res.json(dt);
});

// DELETE /api/doc-types/:id — soft delete (tắt isActive)
router.delete('/:id', requireRole('system_admin', 'branch_admin') as any, async (req, res) => {
  const id = parseInt(req.params.id);
  await prisma.docType.update({ where: { id }, data: { isActive: false } });
  return res.json({ success: true });
});

export default router;
