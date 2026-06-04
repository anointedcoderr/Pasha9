// Built by Anointed Coder.
//
// POST /api/betting-pass/claim/[id]
//
// Claims the Betting Pass tier reward with the given rule id. The
// engine enforces:
//   - rule is active
//   - user has enough lifetime points
//   - claim has not been redeemed before (BettingPassClaim unique)
// Coins / freebet payouts are credited to the wallet inside the same
// transaction; bonus / physical rewards leave a row for the operator
// to fulfil offline.

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { withAuth, recordActivity } from '@/lib/auth/guard';
import { requireActiveUser } from '@/lib/auth/rbac';
import { jsonOk, jsonError } from '@/lib/auth/errors';
import { rateLimit } from '@/lib/auth/rate-limit';
import { claimBettingPassReward } from '@/lib/betting-pass/engine';

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  return withAuth(async () => {
    const session = await requireActiveUser();
    if (!params.id) return jsonError(400, 'VALIDATION');

    const limit = rateLimit(`bp-claim:${session.sub}`, 5, 60_000);
    if (!limit.ok) return jsonError(429, 'RATE_LIMITED');

    const result = await claimBettingPassReward(session.sub, params.id);
    if (!result.ok) {
      if (result.code === 'TIER_LOCKED') return jsonError(403, 'TIER_LOCKED', 'Earn more points to unlock this tier.');
      if (result.code === 'ALREADY_CLAIMED') return jsonError(409, 'ALREADY_CLAIMED', 'You have already claimed this reward.');
      if (result.code === 'RULE_INACTIVE') return jsonError(409, 'RULE_INACTIVE', 'This tier is not currently available.');
      return jsonError(404, 'RULE_NOT_FOUND');
    }

    await recordActivity({
      actorId: session.sub,
      actorRole: session.role,
      action: 'BETTING_PASS_CLAIM',
      target: result.claimId,
      meta: { ruleId: params.id, rewardKind: result.rewardKind, rewardAmount: result.rewardAmount },
    });

    return jsonOk({
      ok: true,
      claimId: result.claimId,
      rewardKind: result.rewardKind,
      rewardAmount: result.rewardAmount,
    });
  });
}
