import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthRequest extends Request {
  user?: { id: number; email: string; role: string; branchId?: number | null };
}

const getSecret = () => process.env.JWT_SECRET || 'change-this-in-production';

export function authMiddleware(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void {
  const token = req.headers.authorization?.split(' ')[1]; // Bearer <token>

  if (!token) {
    res.status(401).json({ error: 'UNAUTHORIZED', message: 'Vui lòng đăng nhập.' });
    return;
  }

  try {
    const payload = jwt.verify(token, getSecret()) as AuthRequest['user'];
    req.user = payload;
    next();
  } catch {
    res.status(401).json({
      error:   'UNAUTHORIZED',
      message: 'Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.'
    });
  }
}

/** Dùng sau authMiddleware để giới hạn theo role */
export function requireRole(...roles: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'UNAUTHORIZED' });
      return;
    }
    if (!roles.includes(req.user.role)) {
      res.status(403).json({
        error:   'FORBIDDEN',
        message: 'Bạn không có quyền thực hiện thao tác này.'
      });
      return;
    }
    next();
  };
}
