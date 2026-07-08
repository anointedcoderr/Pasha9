// Built by Anointed Coder.
//
// POST /api/promotions/[id]/claim
//
// Player-facing typed claim endpoint. Delegates to runPromotionClaim
// which handles the type routing, idempotency and ledger writes.

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { withAuth, recordActivity } from '@/lib/auth/guard';
import { requireActiveUser } from '@/lib/auth/rbac';
import { jsonError, jsonOk } from '@/lib/auth/errors';
import { rateLimit } from '@/lib/auth/rate-limit';
import { runPromotionClaim } from '@/lib/promotions/claim';
import { notifyPromotionClaim, notifyAdminsPromotionClaimed } from '@/lib/notifications/notify';

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  return withAuth(async () => {
    const session = await requireActiveUser();

    // 10 claim attempts per 10 minutes per user. Generous to honest
    // retries, hostile to scripted spam against the unique index.
    const limit = rateLimit(`promotion-claim:${session.sub}`, 10, 10 * 60_000);
    if (!limit.ok) return jsonError(429, 'RATE_LIMITED');

    const result = await runPromotionClaim({ ruleId: params.id, userId: session.sub, actorRole: session.role });

    if (!result.ok) {
      await recordActivity({
        actorId: session.sub,
        actorRole: session.role,
        action: 'PROMOTION_CLAIM_REJECT',
        target: params.id,
        meta: { code: result.code, message: result.message, ...(result.meta ?? {}) },
      });
      return jsonError(result.httpStatus, result.code, result.message, { action: result.action, ...(result.meta ?? {}) });
    }

    if (result.action === 'redirect') {
      await recordActivity({
        actorId: session.sub,
        actorRole: session.role,
        action: 'PROMOTION_CLAIM_REDIRECT',
        target: params.id,
        detail: result.ruleName,
        meta: { url: result.url },
      });
      return jsonOk(result);
    }

    // Fire-and-forget player notification. Logged on failure but
    // never blocks the claim response. Only fires for the credit
    // branch (the redirect branch is handled above and the rejection
    // branch already short-circuited).
    try {
      await notifyPromotionClaim({
        userId: session.sub,
        promotionName: result.ruleName,
        amount: typeof result.amount === 'number' ? result.amount : null,
      });
      await notifyAdminsPromotionClaimed({
        userId: session.sub,
        promotionName: result.ruleName,
        amount: typeof result.amount === 'number' ? result.amount : null,
      });
    } catch (err) {
      console.error('[promotion-claim] notify failed', err);
    }

    return jsonOk({
      action: result.action,
      ruleName: result.ruleName,
      bonusGrantId: result.bonusGrantId,
      amount: result.amount,
      claimId: result.claimId,
    });
  });
}
