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
import { isUnlimitedFreeSpins, UNLIMITED_FREE_SPINS } from '@/lib/rewards/free-spins';
import { rewardDayKey, LEGACY_SPIN_TIER_KEY } from '@/lib/rewards/day';

export async function GET() {
  return withAuth(async () => {
    const session = await ensureUser();
    const userId = session.sub;

    const now = new Date();
    const today = rewardDayKey(now);
    const [wallet, lastClaim, lastSpin, todayCheckIns, legacyFreeLog, grants] = await Promise.all([
      db.wallet.findUnique({ where: { userId }, select: { bonusBalance: true } }),
      db.dailyCheckInLog.findFirst({ where: { userId }, orderBy: { createdAt: 'desc' } }),
      db.spinResult.findFirst({ where: { userId }, orderBy: { createdAt: 'desc' } }),
      db.dailyCheckInLog.count({ where: { userId, day: today } }),
      // Legacy (untiered) wheel free-spin usage today, read from the same
      // day-scoped ledger the spin engine enforces so the count shown to
      // the player can never disagree with what is actually allowed.
      db.dailyFreeSpinLog.findUnique({
        where: { userId_tierKey_day: { userId, tierKey: LEGACY_SPIN_TIER_KEY, day: today } },
        select: { used: true },
      }),
      // Available granted free spins (deposit-bonus etc), grouped per
      // wheel tier so the UI can fold them into each tier's counter.
      db.freeSpinGrant.findMany({
        where: {
          userId,
          spinsUsed: { lt: db.freeSpinGrant.fields.spinsGranted },
          OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
        },
        select: { tierKey: true, spinsGranted: true, spinsUsed: true },
      }),
    ]);

    const checkInConfig = await loadCheckInConfig();
    const spinConfig = await loadSpinConfig();
    const freeUnlimited = isUnlimitedFreeSpins(spinConfig.freeSpinsPerDay ?? 0);
    const freeSpinsToday = freeUnlimited
      ? UNLIMITED_FREE_SPINS
      : Math.max(0, (spinConfig.freeSpinsPerDay ?? 0) - (legacyFreeLog?.used ?? 0));

    // Whether the check-in deposit gate is blocking this player right now:
    // they finished a full cycle on their last check-in and have not made a
    // qualifying deposit since. Drives the disabled state + message on the UI.
    let depositRequiredForNextCycle = false;
    if (checkInConfig.requireDepositPerCycle && lastClaim) {
      const cyc = Math.max(1, Math.floor(checkInConfig.cycleLength || 7));
      if (lastClaim.streakDay % cyc === 0) {
        const dep = await db.deposit.findFirst({
          where: {
            userId,
            status: 'approved',
            createdAt: { gt: lastClaim.createdAt },
            amount: { gte: checkInConfig.minDepositForNextCycle },
          },
          select: { id: true },
        });
        depositRequiredForNextCycle = !dep;
      }
    }

    // Sum available granted spins per tier key.
    const grantedFreeSpinsByTier: Record<string, number> = {};
    let grantedFreeSpinsTotal = 0;
    for (const g of grants) {
      const left = Math.max(0, g.spinsGranted - g.spinsUsed);
      if (left <= 0) continue;
      grantedFreeSpinsByTier[g.tierKey] = (grantedFreeSpinsByTier[g.tierKey] ?? 0) + left;
      grantedFreeSpinsTotal += left;
    }

    return jsonOk({
      coins: wallet ? Math.floor(Number(wallet.bonusBalance)) : 0,
      checkIn: {
        config: checkInConfig,
        claimedToday: todayCheckIns > 0,
        streakDay: lastClaim?.streakDay ?? 0,
        depositRequiredForNextCycle,
      },
      spin: {
        config: spinConfig,
        // Daily allowance plus granted spins so the headline count the
        // player sees includes their deposit-bonus free spins. Unlimited
        // wheels report the sentinel unchanged so the UI shows "Unlimited".
        freeSpinsRemaining: freeUnlimited ? UNLIMITED_FREE_SPINS : freeSpinsToday + grantedFreeSpinsTotal,
        dailyFreeSpinsRemaining: freeSpinsToday,
        grantedFreeSpinsByTier,
        grantedFreeSpinsTotal,
        lastSpinAt: lastSpin?.createdAt ?? null,
      },
    });
  });
}
