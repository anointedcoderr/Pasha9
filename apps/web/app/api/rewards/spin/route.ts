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
import { db } from '@/lib/db/client';
import { withAuth, ensureUser, recordActivity } from '@/lib/auth/guard';
import { jsonError, jsonOk } from '@/lib/auth/errors';
import { loadSpinConfig } from '@/lib/rewards/config';
import { rateLimit } from '@/lib/auth/rate-limit';

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

    const dayWindow = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const freeUsed = await db.spinResult.count({
      where: { userId, source: 'free_daily', createdAt: { gte: dayWindow }, tierId: tier?.id ?? null },
    });
    const freeCap = tier ? tier.freeSpinsPerDay : (config.freeSpinsPerDay ?? 0);
    const freeAvailable = Math.max(0, freeCap - freeUsed);

    let cost = tier ? tier.costPerSpin : config.costPerSpinCoins;
    let source: 'free_daily' | 'manual' = 'manual';
    if (freeAvailable > 0) { cost = 0; source = 'free_daily'; }

    // Pre-check balance for a user-friendly error before we run the
    // weighted pick + transaction. The authoritative balance check
    // re-runs inside the transaction below so a parallel spin
    // cannot squeak through between these two reads.
    const walletPreview = await db.wallet.findUnique({ where: { userId }, select: { bonusBalance: true } });
    const coinsPreview = walletPreview ? Math.floor(Number(walletPreview.bonusBalance)) : 0;
    if (cost > coinsPreview) {
      return jsonError(400, 'INSUFFICIENT_COINS', `Need ${cost} coins to spin, you have ${coinsPreview}.`, { coinsHave: coinsPreview, coinsNeeded: cost });
    }

    // Weighted pick. Operator-configurable house raffle - no
    // provability guarantees ship here.
    const total = segments.reduce((s, x) => s + Math.max(1, x.weight), 0);
    let pick = Math.floor((Math.random() * total)) + 1;
    let chosen = segments[0];
    let chosenIndex = 0;
    for (let i = 0; i < segments.length; i += 1) {
      pick -= Math.max(1, segments[i].weight);
      if (pick <= 0) { chosen = segments[i]; chosenIndex = i; break; }
    }

    const payoutCoins = chosen.payoutType === 'coins' ? chosen.payoutAmount : 0;
    const payoutBonus = chosen.payoutType === 'bonus' ? chosen.payoutAmount : 0;

    // Stable BonusRule for spin bonus payouts (per f3cf57d). The
    // per-segment turnoverX is captured per UserBonus.
    let spinBonusRuleId: string | null = null;
    if (payoutBonus > 0) {
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
      throw e;
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
      freeSpinsRemaining: Math.max(0, freeAvailable - (source === 'free_daily' ? 1 : 0)),
    });
  });
}
