// Built by Anointed Coder.
//
// GET /api/withdrawals/eligibility
//
// Returns the signed-in user's deposit turnover status. The /withdraw
// page polls this to render the "remaining turnover" warning and to
// disable the submit button until the requirement is met. The POST
// /api/withdrawals endpoint enforces the same check server-side so a
// disabled-button bypass still 403s.

export const dynamic = 'force-dynamic';

import { withAuth } from '@/lib/auth/guard';
import { requireActiveUser } from '@/lib/auth/rbac';
import { jsonOk } from '@/lib/auth/errors';
import { computeDepositTurnover } from '@/lib/turnover/deposit-gate';

export async function GET() {
  return withAuth(async () => {
    const session = await requireActiveUser();
    const status = await computeDepositTurnover(session.sub);
    return jsonOk({
      multiplier: status.multiplier,
      approvedDepositTotal: status.approvedDepositTotal,
      requiredTurnover: status.requiredTurnover,
      completedTurnover: status.completedTurnover,
      remainingTurnover: status.remainingTurnover,
      isMet: status.isMet,
      bdtBalanceLocked: status.bdtBalanceLocked,
    });
  });
}
