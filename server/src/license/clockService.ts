import { prisma } from '../lib/prisma';

const TICK_INTERVAL_MS = 5 * 60 * 1000; // 5 phút
let timer: ReturnType<typeof setInterval> | null = null;

/**
 * Cập nhật high-water mark: lastSeenAt chỉ được tăng, không bao giờ giảm.
 * Đây là cơ chế chống đổi ngày giờ hệ thống về quá khứ.
 */
async function tick(): Promise<void> {
  try {
    const now = new Date();
    const existing = await prisma.licenseClock.findUnique({ where: { id: 1 } });

    if (!existing) {
      await prisma.licenseClock.create({
        data: { id: 1, lastSeenAt: now, tickCount: 1 }
      });
    } else {
      // GREATEST: chỉ cập nhật nếu now > lastSeenAt
      const newLastSeen = now > existing.lastSeenAt ? now : existing.lastSeenAt;
      await prisma.licenseClock.update({
        where: { id: 1 },
        data: { lastSeenAt: newLastSeen, tickCount: { increment: 1 } }
      });
    }
  } catch (err) {
    console.error('[LicenseClock] Tick failed:', err);
  }
}

export function startClockTicker(): void {
  if (timer) return;
  tick(); // tick ngay khi khởi động
  timer = setInterval(tick, TICK_INTERVAL_MS);
  console.log('[LicenseClock] Started — tick every 5 minutes');
}

export function stopClockTicker(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

export async function getLastSeenAt(): Promise<Date> {
  const clock = await prisma.licenseClock.findUnique({ where: { id: 1 } });
  return clock?.lastSeenAt ?? new Date(0);
}
