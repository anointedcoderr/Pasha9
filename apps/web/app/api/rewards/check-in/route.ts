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

    // Configurable cycle. dayInCycle is 1..cycleLength; the cycle ends on
    // the final day (where the old day-7 bonus used to land).
    const cycleLength = Math.max(1, Math.floor(config.cycleLength || 7));
    const dayInCycle = ((streakDay - 1) % cycleLength) + 1;
    const isCycleEnd = dayInCycle === cycleLength;

    // Deposit gate: when enabled, a player who completed a full cycle on
    // their last check-in must make a new approved deposit (at least
    // minDepositForNextCycle) before the next cycle's day 1 can be claimed.
    if (config.requireDepositPerCycle) {
      const lastLog = await db.dailyCheckInLog.findFirst({ where: { userId }, orderBy: { createdAt: 'desc' } });
      if (lastLog && lastLog.streakDay % cycleLength === 0) {
        const dep = await db.deposit.findFirst({
          where: {
            userId,
            status: 'approved',
            createdAt: { gt: lastLog.createdAt },
            amount: { gte: config.minDepositForNextCycle },
          },
          select: { id: true },
        });
        if (!dep) return jsonError(403, 'DEPOSIT_REQUIRED', config.depositGateTextEn);
      }
    }

    // Per-day reward when dayAmounts is configured for this cycle length,
    // else the flat dailyCoins plus the end-of-cycle bonus.
    const useDayAmounts = Array.isArray(config.dayAmounts) && config.dayAmounts.length === cycleLength;
    const isDay7 = isCycleEnd;
    const coinsAwarded = useDayAmounts
      ? Math.max(0, Math.floor(Number(config.dayAmounts[dayInCycle - 1] ?? config.dailyCoins)))
      : config.dailyCoins + (isCycleEnd ? config.streakBonusDay7 : 0);

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
