import { Router } from 'express';
import {
  getLicenseStatus,
  activateLicense,
  checkUserLimit
} from '../license/licenseService';
import { authMiddleware, requireRole, AuthRequest } from '../auth/authMiddleware';

const router = Router();

// ── GET /api/license/status ──────────────────────────────────────────────────
// Public — frontend cần để hiển thị màn hình activation khi chưa kích hoạt
router.get('/status', async (_req, res) => {
  const status = await getLicenseStatus();
  return res.json(status);
});

// ── POST /api/license/activate ───────────────────────────────────────────────
// Kích hoạt hoặc gia hạn license. Lần đầu không cần auth (chưa có user).
// Sau khi có user thì chỉ system_admin mới được dùng.
router.post('/activate', async (req: any, res) => {
  const { licenseKey } = req.body;
  if (!licenseKey || typeof licenseKey !== 'string') {
    return res.status(400).json({ error: 'licenseKey là bắt buộc.' });
  }

  try {
    const status = await activateLicense(licenseKey.trim(), req.user?.id);
    return res.json({
      message: 'Kích hoạt license thành công.',
      status
    });
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

// ── GET /api/license/user-limit ──────────────────────────────────────────────
// Dùng khi tạo user mới để check có vượt giới hạn không
router.get(
  '/user-limit',
  authMiddleware as any,
  requireRole('system_admin', 'branch_admin'),
  async (_req, res) => {
    const info = await checkUserLimit();
    return res.json(info);
  }
);

export default router;
