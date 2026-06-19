// Built by Anointed Coder.
//
// Player referral claim. Settlement, wallet credit, turnover locks,
// transaction rows, balance projection, and audit rows are handled by
// the shared transactional referral settlement service.

export const dynamic = 'force-dynamic';

import { withAuth } from '@/lib/auth/guard';
import { requireActiveUser } from '@/lib/auth/rbac';
import { jsonError, jsonOk } from '@/lib/auth/errors';
import { rateLimit } from '@/lib/auth/rate-limit';
import { settleMaturedReferralCommissions } from '@/lib/affiliate/settlement';
import { notifyReferralCommissionPaid } from '@/lib/notifications/notify';

export async function POST() {
  return withAuth(async () => {
    const session = await requireActiveUser();
    const limit = rateLimit(`referral-claim:${session.sub}`, 6, 5 * 60_000);
    if (!limit.ok) return jsonError(429, 'RATE_LIMITED');

    try {
      const result = await settleMaturedReferralCommissions({
        userId: session.sub,
        mode: 'claim',
        actorId: session.sub,
        actorRole: session.role,
      });

      if (result.code === 'cadence_blocked') {
        return jsonError(409, 'CADENCE_BLOCKED', `Claim is not ready for the current ${result.cadence} period.`, {
          cadence: result.cadence,
          lastClaimedAt: result.lastClaimedAt,
        });
      }
      if (result.code === 'nothing_to_claim') {
        return jsonError(409, 'NOTHING_TO_CLAIM', 'No matured referral rewards are available right now.');
      }
      if (result.code === 'auto_disabled') {
        return jsonError(409, 'CLAIM_MODE_DISABLED');
      }

      if (result.code === 'paid' && Number(result.amount ?? 0) > 0) {
        notifyReferralCommissionPaid({
          userId: session.sub,
          amount: Number(result.amount),
          claimReference: result.claimId ?? null,
        }).catch((err) => console.error('[referrals/claim] notify failed', err));
      }

      return jsonOk({
        status: result.code,
        amount: result.amount,
        claimId: result.claimId,
        payoutId: result.payoutId,
        walletTxId: result.code === 'paid' ? result.walletTxId : null,
        turnoverGrantIds: result.code === 'paid' ? result.turnoverGrantIds : [],
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[me/referrals/claim] failed', err);
      return jsonError(500, 'CLAIM_FAILED', message);
    }
  });
}
