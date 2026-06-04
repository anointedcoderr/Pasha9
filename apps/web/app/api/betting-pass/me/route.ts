// Built by Anointed Coder.
//
// GET /api/betting-pass/me
//
// Returns the signed-in user's Betting Pass state plus the operator's
// configured rules so the public page can render the ladder. The next
// tier and points-to-next-tier are derived server-side so the UI
// stays presentational.

export const dynamic = 'force-dynamic';

import { withAuth } from '@/lib/auth/guard';
import { requireActiveUser } from '@/lib/auth/rbac';
import { jsonOk } from '@/lib/auth/errors';
import { db } from '@/lib/db/client';
import { loadBettingPassConfig } from '@/lib/betting-pass/config';

export async function GET() {
  return withAuth(async () => {
    const session = await requireActiveUser();

    const [config, rules, progress, claims] = await Promise.all([
      loadBettingPassConfig(),
      db.bettingPassRule.findMany({
        where: { isActive: true },
        orderBy: { pointsRequired: 'asc' },
      }),
      db.userBettingPassProgress.findUnique({ where: { userId: session.sub } }),
      db.bettingPassClaim.findMany({
        where: { userId: session.sub },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const pointsTotal = Number(progress?.pointsTotal ?? 0);
    const claimedRuleIds = new Set(claims.map((c) => c.ruleId));

    const ladder = rules.map((r) => {
      const unlocked = pointsTotal >= r.pointsRequired;
      const claimed = claimedRuleIds.has(r.id);
      return {
        id: r.id,
        tier: r.tier,
        nameEn: r.nameEn,
        nameBn: r.nameBn,
        descriptionEn: r.descriptionEn,
        descriptionBn: r.descriptionBn,
        iconUrl: r.iconUrl,
        pointsRequired: r.pointsRequired,
        rewardKind: r.rewardKind,
        rewardAmount: Number(r.rewardAmount),
        unlocked,
        claimed,
        claimable: unlocked && !claimed,
      };
    });

    const nextRule = rules.find((r) => r.pointsRequired > pointsTotal);
    const currentRule = [...rules].reverse().find((r) => r.pointsRequired <= pointsTotal);

    return jsonOk({
      enabled: config.enabled,
      seasonKey: config.seasonKey,
      pointsPerBdtDeposit: config.pointsPerBdtDeposit,
      pointsPerBdtBet: config.pointsPerBdtBet,
      progress: {
        pointsTotal,
        pointsFromDeposit: Number(progress?.pointsFromDeposit ?? 0),
        pointsFromBet: Number(progress?.pointsFromBet ?? 0),
        currentTier: progress?.currentTier ?? 0,
        currentTierName: currentRule ? currentRule.nameEn : null,
        nextTierName: nextRule ? nextRule.nameEn : null,
        pointsToNextTier: nextRule ? Math.max(0, nextRule.pointsRequired - pointsTotal) : 0,
        nextTierRequirement: nextRule ? nextRule.pointsRequired : null,
      },
      ladder,
      claims: claims.map((c) => ({
        id: c.id,
        ruleId: c.ruleId,
        tier: c.tier,
        rewardKind: c.rewardKind,
        rewardAmount: Number(c.rewardAmount),
        status: c.status,
        createdAt: c.createdAt,
      })),
    });
  });
}
