// Built by Anointed Coder.
//
// GET /api/withdrawals/eligibility
//
// Returns the signed-in user's combined turnover status. The /withdraw
// page polls this to render the "remaining turnover" warning, and the
// POST /api/withdrawals route enforces the same check server-side so a
// disabled-button bypass still 403s.
//
// Response includes both the combined totals and the per-source
// breakdown so the UI can render two rows when a Betting Pass BDT
// Balance turnover is active.

export const dynamic = 'force-dynamic';

import { withAuth } from '@/lib/auth/guard';
import { requireActiveUser } from '@/lib/auth/rbac';
import { jsonOk } from '@/lib/auth/errors';
import { computeDepositTurnover } from '@/lib/turnover/deposit-gate';

export async function GET() {
  return withAuth(async () => {
    const session = await requireActiveUser();
    const s = await computeDepositTurnover(session.sub);
    return jsonOk({
      multiplier: s.multiplier,
      approvedDepositTotal: s.approvedDepositTotal,

      // Per-source breakdown
      depositRequired: s.depositRequired,
      depositCompleted: s.depositCompleted,
      depositRemaining: s.depositRemaining,
      bettingPassRequired: s.bettingPassRequired,
      bettingPassCompleted: s.bettingPassCompleted,
      bettingPassRemaining: s.bettingPassRemaining,
      referralRequired: s.referralRequired,
      referralCompleted: s.referralCompleted,
      referralRemaining: s.referralRemaining,
      registrationRequired: s.registrationRequired,
      registrationCompleted: s.registrationCompleted,
      registrationRemaining: s.registrationRemaining,
      spinRequired: s.spinRequired,
      spinCompleted: s.spinCompleted,
      spinRemaining: s.spinRemaining,

      // Combined totals
      requiredTurnover: s.requiredTurnover,
      completedTurnover: s.completedTurnover,
      remainingTurnover: s.remainingTurnover,
      isMet: s.isMet,
      bdtBalanceLocked: s.bdtBalanceLocked,
      referralBalanceLocked: s.referralBalanceLocked,
      spinBalanceLocked: s.spinBalanceLocked,
    });
  });
}
