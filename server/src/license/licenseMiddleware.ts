import { Request, Response, NextFunction } from 'express';
import { getLicenseStatus } from './licenseService';

// Paths không cần license hợp lệ (activation screen, health check, auth)
const BYPASS_PREFIXES = [
  '/api/license',
  '/api/auth/login',
  '/api/auth/setup',
  '/health'
];

const ERROR_MESSAGES: Record<string, string> = {
  LICENSE_NOT_ACTIVATED: 'Hệ thống chưa được kích hoạt. Vui lòng nhập license key.',
  LICENSE_EXPIRED:       'License đã hết hạn. Vui lòng liên hệ vendor để gia hạn.',
  CLOCK_TAMPERED:        'Phát hiện đồng hồ hệ thống bị chỉnh lùi. Vui lòng liên hệ admin.'
};

export async function licenseMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  if (BYPASS_PREFIXES.some(p => req.path.startsWith(p))) {
    next();
    return;
  }

  const status = await getLicenseStatus();

  if (!status.valid) {
    res.status(403).json({
      error:   status.reason ?? 'LICENSE_INVALID',
      message: ERROR_MESSAGES[status.reason ?? ''] ?? 'License không hợp lệ.'
    });
    return;
  }

  next();
}
