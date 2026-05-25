// Built by Anointed Coder.
//
// Retro-accrue commission for a deposit that was approved BEFORE the
// upline had a tier assigned. Required because the deposit-approve
// hook only fires once per row - if commission was skipped due to
// no_tier_assigned at the time, admin must trigger this endpoint
// after fixing the tier.
//
// Guards:
//   - deposit must exist and be status=approved
//   - no AffiliateCommission rows for this deposit can already exist
//     (would double-pay the upline if we ran twice)
//
// Returns the same shape as the deposit-approve commission block so
// the admin UI can reuse its handler.

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { Prisma } from '@prisma/client';
import { db } from '@/lib/db/client';
import { withAuth, ensurePermission, recordActivity } from '@/lib/auth/guard';
import { jsonError, jsonOk } from '@/lib/auth/errors';
import { accrueCommissionsOnDeposit } from '@/lib/affiliate/engine';

export async function POST(_req: NextRequest, { params }: { params: { depositId: string } }) {
  return withAuth(async () => {
    const session = await ensurePermission('affiliate.write');

    const deposit = await db.deposit.findUnique({
      where: { id: params.depositId },
      select: { id: true, userId: true, amount: true, status: true },
    });
    if (!deposit) return jsonError(404, 'DEPOSIT_NOT_FOUND');
    if (deposit.status !== 'approved') return jsonError(400, 'DEPOSIT_NOT_APPROVED', `Deposit status is ${deposit.status}.`);

    const existing = await db.affiliateCommission.count({
      where: { depositId: deposit.id },
    });
    if (existing > 0) {
      return jsonError(409, 'ALREADY_ACCRUED', `${existing} commission row(s) already exist for this deposit. Refusing to double-pay.`);
    }

    const result = await accrueCommissionsOnDeposit(deposit.userId, deposit.id, new Prisma.Decimal(deposit.amount));

    const summaryDetail = result.accrued.length > 0
      ? result.accrued.map((c) => `L${c.level}:${c.tierName ?? '?'}@${c.ratePct}%=${c.amount}`).join(' ; ')
      : result.error
        ? `ERROR ${result.error}`
        : result.skipped.length > 0
          ? result.skipped.map((s) => `L${s.level}:${s.reason}`).slice(0, 4).join(' ; ')
          : `no_upline (chainDepth=${result.chainDepth})`;

    await recordActivity({
      actorId: session.sub,
      actorRole: session.role,
      action: result.accrued.length > 0 ? 'COMMISSION_BACKFILL_ACCRUED' : 'COMMISSION_BACKFILL_NONE',
      target: deposit.id,
      detail: summaryDetail.slice(0, 480),
      meta: {
        userId: deposit.userId,
        depositAmount: Number(deposit.amount),
        chainDepth: result.chainDepth,
        accrued: result.accrued,
        skipped: result.skipped,
        error: result.error,
      },
    });

    return jsonOk({
      ok: true,
      depositId: deposit.id,
      commissions: {
        accrued: result.accrued,
        skipped: result.skipped,
        chainDepth: result.chainDepth,
        total: result.accrued.reduce((acc, c) => acc + c.amount, 0),
        count: result.accrued.length,
        error: result.error,
      },
    });
  });
}
