// Built by Anointed Coder.
//
// POST /api/rewards/check-in
//
// Claims today's Daily Check-in. Validates:
//   - check-in is enabled in admin config
//   - user has not already claimed today
//   - user meets the minimum deposit OR minimum bet requirement
//
// On success credits Wallet.bonusBalance (= reward coins) with the
// configured daily amount + streak-day-7 bonus when applicable, then
// writes a DailyCheckInLog row. The auto-check-in toggle on the admin
// surface means a successful login can fire this endpoint silently.

export const dynamic = 'force-dynamic';

import { db } from '@/lib/db/client';
import { withAuth, ensureUser, recordActivity } from '@/lib/auth/guard';
import { jsonError, jsonOk } from '@/lib/auth/errors';
import { loadCheckInConfig } from '@/lib/rewards/config';
import { notifyCheckInRewardClaimed } from '@/lib/notifications/notify';

function todayKey(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

function yesterdayKey(): string {
  const d = new Date(Date.now() - 24 * 60 * 60 * 1000);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

export async function POST() {
  return withAuth(async () => {
    const session = await ensureUser();
    const userId = session.sub;
    const config = await loadCheckInConfig();
    if (!config.enabled) return jsonError(503, 'CHECKIN_DISABLED', 'Daily check-in is currently disabled.');

    const today = todayKey();
    const existing = await db.dailyCheckInLog.findUnique({ where: { userId_day: { userId, day: today } } });
    if (existing) return jsonError(409, 'ALREADY_CLAIMED', 'Already checked in today.');

    // Activity gate: at least one approved deposit OR one wagered bet
    // meeting the configured thresholds. We look at the user's
    // lifetime to keep the rule simple - the admin can raise the
    // threshold any time.
    const [depositTotal, betTotal] = await Promise.all([
      db.deposit.aggregate({ _sum: { amount: true }, where: { userId, status: 'approved' } }),
      db.providerTransaction.aggregate({
        _sum: { betAmount: true },
        where: { userId, type: 'bet' },
      }),
    ]);
    const depositSum = Number(depositTotal._sum.amount ?? 0);
    const betSum = Math.abs(Number(betTotal._sum?.betAmount ?? 0));
    const meetsActivity = depositSum >= config.minDepositRequirement || betSum >= config.minBetRequirement;
    if (!meetsActivity) {
      return jsonError(403, 'ACTIVITY_REQUIRED', `You need at least BDT ${config.minDepositRequirement} deposited or BDT ${config.minBetRequirement} wagered to claim daily check-in.`);
    }

    const yesterday = yesterdayKey();
    const yest = await db.dailyCheckInLog.findUnique({ where: { userId_day: { userId, day: yesterday } } });
    const streakDay = yest ? yest.streakDay + 1 : 1;
    const isDay7 = streakDay > 0 && streakDay % 7 === 0;
    const coinsAwarded = config.dailyCoins + (isDay7 ? config.streakBonusDay7 : 0);

    const claim = await db.$transaction(async (tx) => {
      const log = await tx.dailyCheckInLog.create({
        data: { userId, day: today, coinsAwarded, streakDay },
      });
      await tx.wallet.upsert({
        where: { userId },
        update: { bonusBalance: { increment: coinsAwarded } },
        create: { userId, balance: 0, bonusBalance: coinsAwarded, lockedBalance: 0, currency: 'BDT' },
      });
      return log;
    });

    await recordActivity({
      actorId: userId,
      actorRole: session.role,
      action: 'CHECKIN_CLAIM',
      target: claim.id,
      meta: { day: today, streakDay, coinsAwarded },
    });

    notifyCheckInRewardClaimed({
      userId,
      coins: coinsAwarded,
      streakDay,
    }).catch((err) => console.error('[check-in] notify failed', err));

    return jsonOk({ coinsAwarded, streakDay, isDay7 });
  });
}
