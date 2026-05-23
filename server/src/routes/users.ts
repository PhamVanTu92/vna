import { Router } from 'express';
import bcrypt from 'bcrypt';
import { prisma } from '../lib/prisma';
import { authMiddleware, requireRole, AuthRequest } from '../auth/authMiddleware';
import { checkUserLimit } from '../license/licenseService';

const router = Router();
router.use(authMiddleware as any);

// ── GET /api/admin/users ──────────────────────────────────────────────────────
router.get('/', requireRole('system_admin', 'branch_admin'), async (req: AuthRequest, res) => {
  const where =
    req.user!.role === 'system_admin'
      ? {}
      : { branchId: req.user!.branchId ?? -1 };

  const users = await prisma.user.findMany({
    where,
    select: {
      id: true, email: true, fullName: true,
      role: true, branchId: true, isActive: true, createdAt: true,
      branch: { select: { id: true, name: true, code: true } }
    },
    orderBy: { createdAt: 'desc' }
  });
  return res.json({ users });
});

// ── POST /api/admin/users ─────────────────────────────────────────────────────
router.post('/', requireRole('system_admin', 'branch_admin'), async (req: AuthRequest, res) => {
  const { email, password, fullName, role, branchId } = req.body;

  if (!email || !password || !fullName) {
    return res.status(400).json({ error: 'email, password và fullName là bắt buộc.' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Mật khẩu tối thiểu 8 ký tự.' });
  }

  // branch_admin chỉ tạo được user trong branch của mình
  const targetBranchId =
    req.user!.role === 'branch_admin' ? req.user!.branchId : (branchId ?? null);

  // Kiểm tra giới hạn user theo license
  const limit = await checkUserLimit();
  if (!limit.allowed) {
    return res.status(400).json({
      error: `Đã đạt giới hạn ${limit.max} người dùng theo license. Liên hệ vendor để nâng cấp.`
    });
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return res.status(409).json({ error: 'Email đã tồn tại.' });

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({
    data: {
      email, passwordHash, fullName,
      role: role ?? 'user',
      branchId: targetBranchId ?? null
    },
    select: { id: true, email: true, fullName: true, role: true, branchId: true, isActive: true }
  });
  return res.status(201).json({ user });
});

// ── PUT /api/admin/users/:id ──────────────────────────────────────────────────
router.put('/:id', requireRole('system_admin', 'branch_admin'), async (req: AuthRequest, res) => {
  const id = parseInt(req.params.id);
  const { fullName, role, branchId, isActive, password } = req.body;

  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) return res.status(404).json({ error: 'Người dùng không tồn tại.' });

  // branch_admin chỉ được sửa user trong branch của mình
  if (req.user!.role === 'branch_admin' && target.branchId !== req.user!.branchId) {
    return res.status(403).json({ error: 'Không có quyền sửa người dùng này.' });
  }

  const data: any = {};
  if (fullName !== undefined) data.fullName = fullName;
  if (isActive !== undefined) data.isActive = isActive;
  if (req.user!.role === 'system_admin') {
    if (role     !== undefined) data.role     = role;
    if (branchId !== undefined) data.branchId = branchId ?? null;
  }
  if (password) {
    if (password.length < 8) return res.status(400).json({ error: 'Mật khẩu tối thiểu 8 ký tự.' });
    data.passwordHash = await bcrypt.hash(password, 12);
  }

  const updated = await prisma.user.update({
    where: { id },
    data,
    select: { id: true, email: true, fullName: true, role: true, branchId: true, isActive: true }
  });
  return res.json({ user: updated });
});

// ── DELETE /api/admin/users/:id (soft delete) ─────────────────────────────────
router.delete('/:id', requireRole('system_admin'), async (req: AuthRequest, res) => {
  const id = parseInt(req.params.id);
  if (id === req.user!.id) {
    return res.status(400).json({ error: 'Không thể xóa chính mình.' });
  }
  await prisma.user.update({ where: { id }, data: { isActive: false } });
  return res.json({ message: 'Đã vô hiệu hóa người dùng.' });
});

export default router;
