import { Router } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma';
import { authMiddleware, AuthRequest } from '../auth/authMiddleware';

const router = Router();
const getSecret = () => process.env.JWT_SECRET || 'change-this-in-production';

// ── POST /api/auth/setup ─────────────────────────────────────────────────────
// Tạo system_admin đầu tiên — chỉ hoạt động khi chưa có user nào trong DB
router.post('/setup', async (req, res) => {
  const count = await prisma.user.count();
  if (count > 0) {
    return res.status(403).json({
      error:   'SETUP_ALREADY_DONE',
      message: 'Hệ thống đã có người dùng. Không thể dùng endpoint này nữa.'
    });
  }

  const { email, password, fullName } = req.body;
  if (!email || !password || !fullName) {
    return res.status(400).json({ error: 'email, password và fullName là bắt buộc.' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Mật khẩu tối thiểu 8 ký tự.' });
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({
    data: { email, passwordHash, fullName, role: 'system_admin' }
  });

  const token = jwt.sign(
    { id: user.id, email: user.email, role: user.role, branchId: null },
    getSecret(),
    { expiresIn: '8h' }
  );

  return res.status(201).json({
    token,
    user: { id: user.id, email: user.email, fullName: user.fullName, role: user.role }
  });
});

// ── POST /api/auth/login ─────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email và password là bắt buộc.' });
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.isActive) {
    // Trả thông báo chung để tránh user enumeration
    return res.status(401).json({ error: 'Email hoặc mật khẩu không đúng.' });
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    return res.status(401).json({ error: 'Email hoặc mật khẩu không đúng.' });
  }

  const token = jwt.sign(
    { id: user.id, email: user.email, role: user.role, branchId: user.branchId },
    getSecret(),
    { expiresIn: '8h' }
  );

  return res.json({
    token,
    user: { id: user.id, email: user.email, fullName: user.fullName, role: user.role }
  });
});

// ── GET /api/auth/me ─────────────────────────────────────────────────────────
router.get('/me', authMiddleware as any, async (req: AuthRequest, res) => {
  const user = await prisma.user.findUnique({
    where:  { id: req.user!.id },
    select: { id: true, email: true, fullName: true, role: true, branchId: true }
  });
  if (!user) return res.status(404).json({ error: 'User không tồn tại.' });
  return res.json({ user });
});

// ── POST /api/auth/logout ────────────────────────────────────────────────────
// JWT là stateless — logout chỉ thực hiện phía client (xóa token)
router.post('/logout', (_req, res) => {
  res.json({ message: 'Đã đăng xuất. Xóa token ở phía client.' });
});

export default router;
