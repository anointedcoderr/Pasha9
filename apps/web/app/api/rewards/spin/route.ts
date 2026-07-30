// Built by Anointed Coder.
//
// POST /api/rewards/spin   body: { tierKey?: string }
//
// Tier-aware spin engine. When tierKey is supplied the engine loads
// only that tier's segments, uses the tier-specific costPerSpin and
// freeSpinsPerDay (overriding the global SpinConfig), scopes the
// free-spin counter to that tier, and stores tierId on the SpinResult
// row so analytics can split history per wheel. When no tierKey is
// supplied the engine falls back to the legacy flat behaviour (loads
// segments where tierId IS NULL, uses global SpinConfig values).

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { db } from '@/lib/db/client';
import { withAuth, ensureUser, recordActivity } from '@/lib/auth/guard';
import { jsonError, jsonOk } from '@/lib/auth/errors';
import { loadSpinConfig } from '@/lib/rewards/config';
import { isUnlimitedFreeSpins, UNLIMITED_FREE_SPINS } from '@/lib/rewards/free-spins';
import { rewardDayKey, LEGACY_SPIN_TIER_KEY } from '@/lib/rewards/day';
import { rateLimit } from '@/lib/auth/rate-limit';
import { pickSpinSegment } from '@/lib/spin/engine';

const bodySchema = z.object({
  tierKey: z.string().trim().min(1).max(40).optional(),
});

export async function POST(req: NextRequest) {
  return withAuth(async () => {
    const session = await ensureUser();
    const userId = session.sub;

    const body = await req.json().catch(() => ({}));
    const parsed = bodySchema.safeParse(body);
    const tierKey = parsed.success ? parsed.data.tierKey : undefined;

    // Per-tier cooldown so a quick double-click on one wheel cannot
    // double-credit, but a player can still spin a different tier
    // immediately. Legacy untiered spins keep the global key.
    const cooldownKey = tierKey ? `spin:${userId}:${tierKey}` : `spin:${userId}`;
    const limit = rateLimit(cooldownKey, 1, 3_000);
    if (!limit.ok) return jsonError(429, 'SPIN_COOLDOWN', 'Please wait a moment before spinning again.');

    const config = await loadSpinConfig();
    if (!config.enabled) return jsonError(503, 'SPIN_DISABLED', 'Spin wheel is currently disabled.');

    // Resolve the tier (if any) and the per-spin cost / free allowance.
    let tier: { id: string; key: string; costPerSpin: number; freeSpinsPerDay: number; nameEn: string } | null = null;
    if (tierKey) {
      const row = await db.spinWheelTier.findUnique({
        where: { key: tierKey },
        select: { id: true, key: true, costPerSpin: true, freeSpinsPerDay: true, nameEn: true, isActive: true },
      });
      if (!row || !row.isActive) return jsonError(404, 'TIER_NOT_FOUND', 'This wheel is not available.');
      tier = row;
    }

    const segments = await db.spinSegment.findMany({
      where: { isActive: true, tierId: tier?.id ?? null },
      orderBy: { position: 'asc' },
    });
    if (segments.length === 0) return jsonError(503, 'NO_SEGMENTS', 'Spin wheel is not configured. Ask an admin to add segments.');

    // Daily free-spin allowance is tracked in DailyFreeSpinLog, a
    // day-scoped counter (not a rolling 24h count of SpinResult rows),
    // so it resets on the same UTC calendar boundary as daily check-in
    // and is claimed atomically inside the transaction below.
    const spinDay = rewardDayKey();
    const spinTierKey = tier?.key ?? LEGACY_SPIN_TIER_KEY;
    const freeLog = await db.dailyFreeSpinLog.findUnique({
      where: { userId_tierKey_day: { userId, tierKey: spinTierKey, day: spinDay } },
      select: { used: true },
    });
    const freeUsed = freeLog?.used ?? 0;
    const freeCap = tier ? tier.freeSpinsPerDay : (config.freeSpinsPerDay ?? 0);
    // A negative cap is the "unlimited" sentinel: the player always has a
    // daily free spin available and the exhaustion check below is skipped.
    const freeUnlimited = isUnlimitedFreeSpins(freeCap);
    const dailyFreeAvailable = freeUnlimited ? 1 : Math.max(0, freeCap - freeUsed);

    // Granted free spins from the unified bonus engine (deposit-bonus
    // rules etc) are stored as FreeSpinGrant rows keyed to a wheel
    // tier. A grant is available while spinsUsed < spinsGranted and it
    // has not expired. They only apply to a named tier - the legacy
    // untiered wheel (tier === null) has no key to match, so granted
    // spins never leak into it.
    const now = new Date();
    const availableGrants = tier
      ? await db.freeSpinGrant.findMany({
          where: {
            userId,
            tierKey: tier.key,
            spinsUsed: { lt: db.freeSpinGrant.fields.spinsGranted },
            OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
          },
          orderBy: { createdAt: 'asc' },
          select: { id: true, spinsGranted: true, spinsUsed: true },
        })
      : [];
    const grantedAvailable = availableGrants.reduce(
      (sum, g) => sum + Math.max(0, g.spinsGranted - g.spinsUsed),
      0,
    );

    let cost = tier ? tier.costPerSpin : config.costPerSpinCoins;
    let source: 'free_daily' | 'free_grant' | 'manual' = 'manual';
    // Spend the daily allowance first, then fall back to granted spins,
    // then to paid coins. The grant to debit is resolved inside the
    // transaction so a concurrent spin cannot over-draw it.
    if (dailyFreeAvailable > 0) {
      cost = 0;
      source = 'free_daily';
    } else if (grantedAvailable > 0) {
      cost = 0;
      source = 'free_grant';
    }

    // Close the "unlimited free wheel" hole: once the daily allowance
    // and any granted spins are used up, a spin must be PAID for. If the
    // wheel has no per-spin price configured (cost = 0) we stop here
    // instead of handing out endless free manual spins - that is exactly
    // the abuse the operator reported (players kept spinning after their
    // free spins ran out).
    if (source === 'manual' && cost <= 0) {
      return jsonError(429, 'NO_FREE_SPINS', 'You have used all your free spins for today. Please come back tomorrow.');
    }

    // Pre-check balance for a user-friendly error before we run the
    // weighted pick + transaction. The authoritative balance check
    // re-runs inside the transaction below so a parallel spin
    // cannot squeak through between these two reads.
    const walletPreview = await db.wallet.findUnique({ where: { userId }, select: { bonusBalance: true } });
    const coinsPreview = walletPreview ? Math.floor(Number(walletPreview.bonusBalance)) : 0;
    if (cost > coinsPreview) {
      return jsonError(400, 'INSUFFICIENT_COINS', `Need ${cost} coins to spin, you have ${coinsPreview}.`, { coinsHave: coinsPreview, coinsNeeded: cost });
    }

    // Server-authoritative pick. crypto.randomBytes-derived weighted
    // selection over the EXCLUDE-FILTERED pool. The eligible pool is
    // the subset of active segments where excludeFromWins=false; the
    // flag is server-only and is never returned by the public spin-
    // wheel endpoint, so the visual wheel still renders every wedge.
    //
    // When the eligible pool is empty the engine returns a fallback
    // outcome and we trigger HARD_FALLBACK_REFUND: refund the cost,
    // write a WheelSpin row with fallbackUsed=true, and tell the
    // player the spin did not run. We never invent a winner.
    const tierConfigVersion = tier
      ? (await db.spinWheelTier.findUnique({ where: { id: tier.id }, select: { configVersion: true } }))?.configVersion ?? null
      : null;

    const pick = pickSpinSegment(segments.map((s) => ({
      id: s.id,
      label: s.label,
      weight: s.weight,
      excludeFromWins: s.excludeFromWins,
    })));

    if (pick.kind === 'fallback') {
      // Hard fallback refund. No wallet movement, no SpinResult row,
      // just a WheelSpin audit entry so compliance can see the
      // operator configured the wheel into a degenerate state.
      await db.wheelSpin.create({
        data: {
          userId,
          tierId: tier?.id ?? null,
          configVersion: tierConfigVersion,
          serverNonceHex: pick.serverNonceHex,
          eligiblePool: pick.eligiblePool as Prisma.InputJsonValue,
          totalWeight: 0,
          pickValue: 0,
          chosenSegmentId: null,
          chosenLabel: null,
          payoutType: null,
          payoutAmount: null,
          cost: 0,
          source: 'manual',
          fallbackUsed: true,
          fallbackReason: pick.reason,
          resultId: null,
        },
      });
      await recordActivity({
        actorId: userId,
        actorRole: session.role,
        action: 'SPIN_FALLBACK_REFUND',
        target: tier?.id ?? undefined,
        detail: pick.reason,
        meta: { tierKey: tier?.key ?? null, configVersion: tierConfigVersion },
      });
      return jsonError(503, 'SPIN_FALLBACK_REFUND', 'No prize is available right now. Please try again later.');
    }

    const chosenIndex = pick.chosenIndex;
    // Resolve back to the full SpinSegment row from the original list
    // so downstream code can read turnoverX + payoutType + ...
    const chosen = segments[chosenIndex];

    const payoutCoins = chosen.payoutType === 'coins' ? chosen.payoutAmount : 0;
    const payoutBonus = chosen.payoutType === 'bonus' ? chosen.payoutAmount : 0;
    // BDT cash payout per client direction. Money lands in
    // Wallet.balance immediately so the homepage balance pill shows
    // the win, and a UserBonus row with sourceType='spin_result_cash'
    // keeps it locked behind the per-segment turnover. The withdrawal
    // gate at lib/turnover/deposit-gate.ts subtracts active UserBonus
    // rows of this source type from the withdrawable balance so the
    // win cannot leave the platform before its wager requirement
    // is met.
    const payoutCash = chosen.payoutType === 'cash' ? chosen.payoutAmount : 0;
    // Free Bet payout. Same locking strategy as cash; the spec says
    // the player should be able to wager but not cash it out before
    // turnover. We pin a 1x turnover on Free Bet wins regardless of
    // segment-level turnoverX, because the spec frames Free Bet as
    // "play once, then withdraw if it wins" rather than a multi-
    // round bonus.
    const payoutFreeBet = chosen.payoutType === 'free_bet' ? chosen.payoutAmount : 0;
    // payoutType='loss' / payoutType='nothing' / 0 amount land here
    // implicitly - we only write a SpinResult row, no wallet move,
    // no UserBonus.

    // Stable BonusRule for spin bonus + cash + free-bet payouts. The
    // per-segment turnoverX is captured on the UserBonus, so the
    // upsert just guarantees a stable rule row to reference.
    let spinBonusRuleId: string | null = null;
    if (payoutBonus > 0 || payoutCash > 0 || payoutFreeBet > 0) {
      const rule = await db.bonusRule.upsert({
        where: { code: 'spin_payout' },
        update: {},
        create: {
          code: 'spin_payout',
          name: 'Spin Reward',
          type: 'manual',
          status: 'active',
          amount: 0,
          turnoverX: 0,
          validityDays: 30,
          description: 'Bonus issued by the spin wheel. Locked balance until per-segment turnover is met.',
        },
        select: { id: true },
      });
      spinBonusRuleId = rule.id;
    }

    let result: { spinRow: { id: string }; bonusGrantId: string | null };
    try {
      result = await db.$transaction(async (tx) => {
      // Daily free-spin claim. Reserve exactly one slot from the
      // day-scoped counter: the upsert creates the row on the first
      // free spin of the day (used=1) or increments it, then we re-read
      // and abort if the value ever exceeds the cap. Throwing rolls the
      // transaction back, undoing the increment, so a free spin can
      // never be granted beyond the daily allowance even if two spins
      // race or the cap was lowered mid-day.
      if (source === 'free_daily') {
        await tx.dailyFreeSpinLog.upsert({
          where: { userId_tierKey_day: { userId, tierKey: spinTierKey, day: spinDay } },
          create: { userId, tierKey: spinTierKey, day: spinDay, used: 1 },
          update: { used: { increment: 1 } },
        });
        // Unlimited wheels still log usage (for stats) but never exhaust.
        if (!freeUnlimited) {
          const claimed = await tx.dailyFreeSpinLog.findUnique({
            where: { userId_tierKey_day: { userId, tierKey: spinTierKey, day: spinDay } },
            select: { used: true },
          });
          if (!claimed || claimed.used > freeCap) {
            throw new Error('FREE_DAILY_EXHAUSTED');
          }
        }
      }

      // Granted free-spin consumption. When this spin is paid by a
      // FreeSpinGrant we debit exactly one spin from the oldest
      // available grant for this tier. The decrement is guarded by a
      // where clause that pins the current spinsUsed value, so two
      // concurrent spins racing on the same grant cannot both succeed:
      // the second update matches zero rows and we re-resolve / fail
      // back to a paid spin or a clear error rather than over-drawing.
      if (source === 'free_grant') {
        let consumed = false;
        // availableGrants was read pre-transaction (oldest first). Walk
        // it in order and take the first grant we can still claim a
        // spin from under a conditional updateMany guard.
        for (const g of availableGrants) {
          const debited = await tx.freeSpinGrant.updateMany({
            where: {
              id: g.id,
              spinsUsed: g.spinsUsed,
              spinsGranted: { gt: g.spinsUsed },
              OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
            },
            data: { spinsUsed: { increment: 1 } },
          });
          if (debited.count === 1) { consumed = true; break; }
        }
        if (!consumed) {
          // Every candidate grant was drained or expired between the
          // pre-read and now (concurrent spin). Bail so the player
          // retries; we never silently charge coins they did not agree
          // to inside the same request.
          throw new Error('FREE_GRANT_RACE');
        }
      }

      // Authoritative balance re-check INSIDE the transaction.
      // Without this, two concurrent spins that both passed the
      // pre-check above could both pass the cost check and the
      // wallet could be driven negative. We use Prisma.Decimal-safe
      // arithmetic against the raw row.
      if (cost > 0) {
        const liveWallet = await tx.wallet.findUnique({ where: { userId }, select: { bonusBalance: true } });
        const liveCoins = liveWallet ? Math.floor(Number(liveWallet.bonusBalance)) : 0;
        if (liveCoins < cost) {
          throw new Error('INSUFFICIENT_COINS_RACE');
        }
      }
      if (cost > 0 || payoutCoins > 0) {
        await tx.wallet.upsert({
          where: { userId },
          update: { bonusBalance: { increment: payoutCoins - cost } },
          create: { userId, balance: 0, bonusBalance: Math.max(0, payoutCoins - cost), lockedBalance: 0, currency: 'BDT' },
        });
      }

      let bonusGrantId: string | null = null;
      if (payoutBonus > 0 && spinBonusRuleId) {
        await tx.wallet.upsert({
          where: { userId },
          update: { lockedBalance: { increment: payoutBonus } },
          create: { userId, balance: 0, bonusBalance: 0, lockedBalance: payoutBonus, currency: 'BDT' },
        });

        const turnoverX = Number(chosen.turnoverX ?? 0);
        const turnoverRequired = payoutBonus * turnoverX;
        const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

        const grant = await tx.userBonus.create({
          data: {
            userId,
            bonusRuleId: spinBonusRuleId,
            amount: payoutBonus,
            expiresAt,
            status: 'active',
            turnoverRequired,
            turnoverProgress: 0,
            sourceType: 'spin_result',
            sourceId: chosen.id,
            note: `Spin segment ${chosen.label}${tier ? ` (${tier.nameEn})` : ''}`,
          },
        });
        bonusGrantId = grant.id;

        await tx.transaction.create({
          data: {
            userId,
            type: 'bonus',
            amount: payoutBonus,
            status: 'completed',
            reference: `spin:${chosen.id}`,
            description: `Spin reward: ${chosen.label}${tier ? ` on ${tier.nameEn}` : ''}`,
            meta: { spinSegmentId: chosen.id, spinSegmentLabel: chosen.label, tierKey: tier?.key ?? null, turnoverRequired, bonusGrantId: grant.id },
          },
        });
      }

      // BDT cash payout branch. Credits Wallet.balance directly so
      // the homepage balance pill shows the win. The locked-until-
      // turnover semantics are tracked via a UserBonus row with
      // sourceType='spin_result_cash' that the withdrawal gate at
      // lib/turnover/deposit-gate.ts now recognises (we added that
      // source to BDT_BALANCE_LOCK_SOURCE_TYPES in the same batch).
      if (payoutCash > 0 && spinBonusRuleId) {
        await tx.wallet.upsert({
          where: { userId },
          update: { balance: { increment: payoutCash } },
          create: { userId, balance: payoutCash, bonusBalance: 0, lockedBalance: 0, currency: 'BDT' },
        });

        const turnoverX = Number(chosen.turnoverX ?? 0);
        const turnoverRequired = payoutCash * turnoverX;
        const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

        const grant = await tx.userBonus.create({
          data: {
            userId,
            bonusRuleId: spinBonusRuleId,
            amount: payoutCash,
            expiresAt,
            status: 'active',
            turnoverRequired,
            turnoverProgress: 0,
            sourceType: 'spin_result_cash',
            sourceId: chosen.id,
            note: `Spin BDT win: ${chosen.label}${tier ? ` (${tier.nameEn})` : ''}`,
          },
        });
        if (!bonusGrantId) bonusGrantId = grant.id;

        await tx.transaction.create({
          data: {
            userId,
            type: 'win',
            amount: payoutCash,
            status: 'completed',
            reference: `spin:${chosen.id}`,
            description: `Spin BDT reward: ${chosen.label}${tier ? ` on ${tier.nameEn}` : ''}`,
            meta: { spinSegmentId: chosen.id, spinSegmentLabel: chosen.label, tierKey: tier?.key ?? null, turnoverRequired, bonusGrantId: grant.id, payoutType: 'cash' },
          },
        });
      }

      // Free Bet payout: credits balance with a 1x turnover lock so
      // the player can wager it but cannot withdraw it without
      // turning it over at least once.
      if (payoutFreeBet > 0 && spinBonusRuleId) {
        await tx.wallet.upsert({
          where: { userId },
          update: { balance: { increment: payoutFreeBet } },
          create: { userId, balance: payoutFreeBet, bonusBalance: 0, lockedBalance: 0, currency: 'BDT' },
        });

        const turnoverRequired = payoutFreeBet * 1; // 1x for free bet
        const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

        const grant = await tx.userBonus.create({
          data: {
            userId,
            bonusRuleId: spinBonusRuleId,
            amount: payoutFreeBet,
            expiresAt,
            status: 'active',
            turnoverRequired,
            turnoverProgress: 0,
            sourceType: 'spin_result_freebet',
            sourceId: chosen.id,
            note: `Spin Free Bet: ${chosen.label}${tier ? ` (${tier.nameEn})` : ''}`,
          },
        });
        if (!bonusGrantId) bonusGrantId = grant.id;

        await tx.transaction.create({
          data: {
            userId,
            type: 'win',
            amount: payoutFreeBet,
            status: 'completed',
            reference: `spin:${chosen.id}`,
            description: `Spin Free Bet: ${chosen.label}${tier ? ` on ${tier.nameEn}` : ''}`,
            meta: { spinSegmentId: chosen.id, spinSegmentLabel: chosen.label, tierKey: tier?.key ?? null, turnoverRequired, bonusGrantId: grant.id, payoutType: 'free_bet' },
          },
        });
      }

      const spinRow = await tx.spinResult.create({
        data: {
          userId,
          segmentId: chosen.id,
          segmentLabel: chosen.label,
          payoutType: chosen.payoutType,
          payoutAmount: chosen.payoutAmount,
          cost,
          source,
          tierId: tier?.id ?? null,
        },
      });
      return { spinRow, bonusGrantId };
      });
    } catch (e) {
      if (e instanceof Error && e.message === 'INSUFFICIENT_COINS_RACE') {
        return jsonError(409, 'INSUFFICIENT_COINS', 'Another spin used the same coins. Try again.');
      }
      if (e instanceof Error && e.message === 'FREE_GRANT_RACE') {
        return jsonError(409, 'FREE_GRANT_RACE', 'Another spin used your free spin. Try again.');
      }
      if (e instanceof Error && e.message === 'FREE_DAILY_EXHAUSTED') {
        return jsonError(429, 'NO_FREE_SPINS', 'You have used all your free spins for today. Please come back tomorrow.');
      }
      throw e;
    }

    // Audit-grade WheelSpin row. Captures the EXACT eligible pool
    // + total weight + pick value + nonce so compliance can replay
    // any spin and confirm the engine picked from the visible-and-
    // winnable subset of wedges. The write is best-effort - the
    // wallet has already settled, so an audit failure must not 500
    // the player. We log loudly so support can investigate later.
    try {
      await db.wheelSpin.create({
        data: {
          userId,
          tierId: tier?.id ?? null,
          configVersion: tierConfigVersion,
          serverNonceHex: pick.serverNonceHex,
          eligiblePool: pick.eligiblePool as Prisma.InputJsonValue,
          totalWeight: pick.totalWeight,
          pickValue: pick.pickValue,
          chosenSegmentId: chosen.id,
          chosenLabel: chosen.label,
          payoutType: chosen.payoutType,
          payoutAmount: chosen.payoutAmount,
          cost,
          source,
          fallbackUsed: false,
          fallbackReason: null,
          resultId: result.spinRow.id,
        },
      });
    } catch (auditErr) {
      console.error('[spin] WheelSpin audit write failed', auditErr);
    }

    await recordActivity({
      actorId: userId,
      actorRole: session.role,
      action: 'SPIN_RESULT',
      target: result.spinRow.id,
      meta: {
        tierKey: tier?.key ?? null,
        segmentLabel: chosen.label,
        payoutAmount: chosen.payoutAmount,
        payoutType: chosen.payoutType,
        cost,
        source,
        bonusGrantId: result.bonusGrantId ?? null,
        configVersion: tierConfigVersion,
        serverNonceHex: pick.serverNonceHex,
      },
    });

    return jsonOk({
      tierKey: tier?.key ?? null,
      segmentId: chosen.id,
      segmentIndex: chosenIndex,
      segmentLabel: chosen.label,
      payoutType: chosen.payoutType,
      payoutAmount: chosen.payoutAmount,
      cost,
      source,
      bonusGrantId: result.bonusGrantId ?? null,
      // Total free spins still available on this tier after this spin:
      // the remaining daily allowance plus any granted spins left. We
      // subtract whichever bucket paid for this spin. Unlimited wheels
      // report the sentinel so the client renders "Unlimited".
      freeSpinsRemaining: freeUnlimited
        ? UNLIMITED_FREE_SPINS
        : Math.max(
            0,
            (dailyFreeAvailable - (source === 'free_daily' ? 1 : 0)) +
              (grantedAvailable - (source === 'free_grant' ? 1 : 0)),
          ),
    });
  });
}
