// Built by Anointed Coder.
//
// POST /api/rewards/spin
//
// Spends spin cost (or a free daily spin), picks a SpinSegment by
// weight, credits the payout to Wallet.bonusBalance, and writes a
// SpinResult row for history. Free spin allowance is tracked by
// counting SpinResult rows for source='free_daily' over the last 24h.

export const dynamic = 'force-dynamic';

import { db } from '@/lib/db/client';
import { withAuth, ensureUser, recordActivity } from '@/lib/auth/guard';
import { jsonError, jsonOk } from '@/lib/auth/errors';
import { loadSpinConfig } from '@/lib/rewards/config';
import { rateLimit } from '@/lib/auth/rate-limit';

export async function POST() {
  return withAuth(async () => {
    const session = await ensureUser();
    const userId = session.sub;

    // Double-click guard: cap at 1 spin per 3 seconds per user. The UI
    // already disables the button while a spin animates, but a quick
    // double-tap before the loading state flips could otherwise fire
    // two credits in flight at the same time.
    const limit = rateLimit(`spin:${userId}`, 1, 3_000);
    if (!limit.ok) return jsonError(429, 'SPIN_COOLDOWN', 'Please wait a moment before spinning again.');

    const config = await loadSpinConfig();
    if (!config.enabled) return jsonError(503, 'SPIN_DISABLED', 'Spin wheel is currently disabled.');

    const segments = await db.spinSegment.findMany({
      where: { isActive: true },
      orderBy: { position: 'asc' },
    });
    if (segments.length === 0) return jsonError(503, 'NO_SEGMENTS', 'Spin wheel is not configured. Ask an admin to add segments.');

    const dayWindow = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const freeUsed = await db.spinResult.count({ where: { userId, source: 'free_daily', createdAt: { gte: dayWindow } } });
    const freeAvailable = Math.max(0, (config.freeSpinsPerDay ?? 0) - freeUsed);

    let cost = config.costPerSpinCoins;
    let source: 'free_daily' | 'manual' = 'manual';
    if (freeAvailable > 0) { cost = 0; source = 'free_daily'; }

    const wallet = await db.wallet.findUnique({ where: { userId }, select: { bonusBalance: true } });
    const coins = wallet ? Math.floor(Number(wallet.bonusBalance)) : 0;
    if (cost > coins) {
      return jsonError(400, 'INSUFFICIENT_COINS', `Need ${cost} coins to spin, you have ${coins}.`, { coinsHave: coins, coinsNeeded: cost });
    }

    // Pick a segment by weight. Math.random replacement is not
    // necessary here since we don't ship any provability guarantees
    // for the spin (operator-configurable house-style raffle).
    const total = segments.reduce((s, x) => s + Math.max(1, x.weight), 0);
    let pick = Math.floor((Math.random() * total)) + 1;
    let chosen = segments[0];
    for (const s of segments) {
      pick -= Math.max(1, s.weight);
      if (pick <= 0) { chosen = s; break; }
    }

    const payoutCoins = chosen.payoutType === 'coins' ? chosen.payoutAmount : 0;
    const payoutBonus = chosen.payoutType === 'bonus' ? chosen.payoutAmount : 0;

    // Ensure a stable BonusRule for spin bonus payouts so each
    // UserBonus created from a spin can be traced and turnover-tracked
    // by the existing bonus engine. Upserted by `code='spin_payout'`.
    // turnoverX on the rule stays 0; the per-spin segment turnoverX is
    // captured per UserBonus via turnoverRequired below.
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

    const result = await db.$transaction(async (tx) => {
      if (cost > 0 || payoutCoins > 0) {
        await tx.wallet.upsert({
          where: { userId },
          update: { bonusBalance: { increment: payoutCoins - cost } },
          create: { userId, balance: 0, bonusBalance: Math.max(0, payoutCoins - cost), lockedBalance: 0, currency: 'BDT' },
        });
      }

      let bonusGrantId: string | null = null;
      if (payoutBonus > 0 && spinBonusRuleId) {
        // Wallet locked balance + traceable UserBonus row. The
        // turnover engine (addTurnover) updates turnoverProgress
        // automatically as the player wagers, and the standard
        // release path flips the grant to status='completed' once
        // turnoverRequired is met. No more orphaned lockedBalance.
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
            note: `Spin segment ${chosen.label}`,
          },
        });
        bonusGrantId = grant.id;

        // Ledger row for the bonus credit (parity with applyDepositBonuses).
        await tx.transaction.create({
          data: {
            userId,
            type: 'bonus',
            amount: payoutBonus,
            status: 'completed',
            reference: `spin:${chosen.id}`,
            description: `Spin reward: ${chosen.label}`,
            meta: { spinSegmentId: chosen.id, spinSegmentLabel: chosen.label, turnoverRequired, bonusGrantId: grant.id },
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
        },
      });
      return { spinRow, bonusGrantId };
    });

    await recordActivity({
      actorId: userId,
      actorRole: session.role,
      action: 'SPIN_RESULT',
      target: result.spinRow.id,
      meta: { segmentLabel: chosen.label, payoutAmount: chosen.payoutAmount, payoutType: chosen.payoutType, cost, source, bonusGrantId: result.bonusGrantId ?? null },
    });

    return jsonOk({
      segmentId: chosen.id,
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
