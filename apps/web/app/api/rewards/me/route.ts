// Built by Anointed Coder.
//
// Logged-in user reward snapshot: coin balance + active streak day +
// last claim timestamps. The reward coin balance is held on
// Wallet.bonusBalance for Phase 1; a dedicated coin ledger is out of
// scope for this milestone.

export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { db } from '@/lib/db/client';
import { withAuth, ensureUser } from '@/lib/auth/guard';
import { jsonOk } from '@/lib/auth/errors';
import { loadCheckInConfig, loadSpinConfig } from '@/lib/rewards/config';

export async function GET() {
  return withAuth(async () => {
    const session = await ensureUser();
    const userId = session.sub;

    const [wallet, lastClaim, lastSpin, todayCheckIns, recentSpins] = await Promise.all([
      db.wallet.findUnique({ where: { userId }, select: { bonusBalance: true } }),
      db.dailyCheckInLog.findFirst({ where: { userId }, orderBy: { createdAt: 'desc' } }),
      db.spinResult.findFirst({ where: { userId }, orderBy: { createdAt: 'desc' } }),
      db.dailyCheckInLog.count({ where: { userId, day: todayKey() } }),
      db.spinResult.count({
        where: {
          userId,
          createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
          source: { in: ['free_daily', 'login'] },
        },
      }),
    ]);

    const checkInConfig = await loadCheckInConfig();
    const spinConfig = await loadSpinConfig();
    const freeSpinsToday = Math.max(0, (spinConfig.freeSpinsPerDay ?? 0) - recentSpins);

    return jsonOk({
      coins: wallet ? Math.floor(Number(wallet.bonusBalance)) : 0,
      checkIn: {
        config: checkInConfig,
        claimedToday: todayCheckIns > 0,
        streakDay: lastClaim?.streakDay ?? 0,
      },
      spin: {
        config: spinConfig,
        freeSpinsRemaining: freeSpinsToday,
        lastSpinAt: lastSpin?.createdAt ?? null,
      },
    });
  });
}

function todayKey(): string {
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
