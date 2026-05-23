import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma';
import { VENDOR_PUBLIC_KEY } from './vendorPublicKey';
import { getLastSeenAt } from './clockService';

const CLOCK_TOLERANCE_MS = 5 * 60 * 1000; // 5 phút dung sai NTP drift
const CACHE_TTL_MS       = 60 * 1000;     // cache 1 phút

interface LicensePayload {
  iss: string;
  sub: string;
  customerName: string;
  maxUsers: number;
  product: string;
  exp: number;
  iat: number;
}

export interface LicenseInfo {
  customerName: string;
  expiresAt: Date;
  maxUsers: number;
  daysRemaining: number;
  isWarning: boolean; // true nếu còn <= 30 ngày
}

export interface LicenseStatus {
  valid: boolean;
  reason?: 'LICENSE_NOT_ACTIVATED' | 'LICENSE_EXPIRED' | 'CLOCK_TAMPERED';
  license?: LicenseInfo;
}

// ── Cache ────────────────────────────────────────────────────────────────────
let cache: { status: LicenseStatus; cachedAt: number } | null = null;

export function invalidateCache(): void {
  cache = null;
}

// ── Public API ───────────────────────────────────────────────────────────────

export async function getLicenseStatus(): Promise<LicenseStatus> {
  if (cache && Date.now() - cache.cachedAt < CACHE_TTL_MS) {
    return cache.status;
  }
  const status = await computeStatus();
  cache = { status, cachedAt: Date.now() };
  return status;
}

export async function activateLicense(
  licenseKey: string,
  activatedBy?: number
): Promise<LicenseStatus> {
  // 1. Verify chữ ký RSA — nếu sai sẽ throw
  let payload: LicensePayload;
  try {
    payload = jwt.verify(licenseKey, VENDOR_PUBLIC_KEY, {
      algorithms: ['RS256']
    }) as LicensePayload;
  } catch (err: any) {
    if (err.name === 'TokenExpiredError') {
      throw new Error('License key này đã hết hạn. Vui lòng yêu cầu key mới.');
    }
    throw new Error('License key không hợp lệ hoặc đã bị chỉnh sửa.');
  }

  // 2. Kiểm tra đúng sản phẩm
  if (payload.product !== 'vna-accountant-v1') {
    throw new Error('License key không phù hợp với sản phẩm này.');
  }

  // 3. Anti-rollback: expiry của key mới phải > lastSeenAt (thời gian thực tế đã qua)
  const lastSeenAt  = await getLastSeenAt();
  const newExpiresAt = new Date(payload.exp * 1000);

  if (newExpiresAt <= lastSeenAt) {
    throw new Error(
      'License key này đã hết hạn trong thực tế. Vui lòng yêu cầu key mới hơn.'
    );
  }

  // 4. Lưu vào DB (upsert — thay thế key cũ nếu có)
  await prisma.license.upsert({
    where:  { id: 1 },
    update: {
      licenseKey,
      customerId:   payload.sub,
      customerName: payload.customerName,
      issuedAt:     new Date(payload.iat * 1000),
      expiresAt:    newExpiresAt,
      maxUsers:     payload.maxUsers,
      product:      payload.product,
      activatedAt:  new Date(),
      activatedBy:  activatedBy ?? null
    },
    create: {
      id: 1,
      licenseKey,
      customerId:   payload.sub,
      customerName: payload.customerName,
      issuedAt:     new Date(payload.iat * 1000),
      expiresAt:    newExpiresAt,
      maxUsers:     payload.maxUsers,
      product:      payload.product,
      activatedAt:  new Date(),
      activatedBy:  activatedBy ?? null
    }
  });

  invalidateCache();
  return getLicenseStatus();
}

export async function checkUserLimit(): Promise<{
  allowed: boolean;
  current: number;
  max: number;
}> {
  const license = await prisma.license.findUnique({ where: { id: 1 } });
  if (!license) return { allowed: false, current: 0, max: 0 };

  const current = await prisma.user.count({ where: { isActive: true } });
  return { allowed: current < license.maxUsers, current, max: license.maxUsers };
}

// ── Internal ─────────────────────────────────────────────────────────────────

async function computeStatus(): Promise<LicenseStatus> {
  const license = await prisma.license.findUnique({ where: { id: 1 } });
  if (!license) {
    return { valid: false, reason: 'LICENSE_NOT_ACTIVATED' };
  }

  const lastSeenAt = await getLastSeenAt();
  const now        = new Date();

  // effectiveNow = MAX(now, lastSeenAt)
  // → Kể cả khi clock bị lùi, chúng ta vẫn dùng mốc thời gian cao nhất đã ghi nhận
  const effectiveNow = now > lastSeenAt ? now : lastSeenAt;

  // Phát hiện clock bị kéo lùi quá tolerance
  if (now.getTime() < lastSeenAt.getTime() - CLOCK_TOLERANCE_MS) {
    return { valid: false, reason: 'CLOCK_TAMPERED' };
  }

  // Kiểm tra hết hạn với effectiveNow
  if (effectiveNow > license.expiresAt) {
    return { valid: false, reason: 'LICENSE_EXPIRED' };
  }

  const daysRemaining = Math.floor(
    (license.expiresAt.getTime() - effectiveNow.getTime()) / 86400000
  );

  return {
    valid: true,
    license: {
      customerName: license.customerName,
      expiresAt:    license.expiresAt,
      maxUsers:     license.maxUsers,
      daysRemaining,
      isWarning:    daysRemaining <= 30
    }
  };
}
