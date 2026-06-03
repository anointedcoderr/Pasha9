// Built by Anointed Coder.
//
// PATCH /api/admin/referral-claims/[id]
// Body: { action: 'approve' | 'reject', adminNote? }
//
// Admin moves a pending ReferralClaim row (manual cadence) into the
// paid or rejected state. Approving credits the user's wallet and
// flips the linked CommissionPayout + AffiliateCommission rows to
// paid. Rejecting detaches the reservation so the player can claim
// again next cycle.

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { db } from '@/lib/db/client';
import { withAuth, ensurePermission, recordActivity } from '@/lib/auth/guard';
import { getCurrentSession } from '@/lib/auth/rbac';
import { jsonError, jsonOk } from '@/lib/auth/errors';
import { loadReferralSettings, computeBalanceFor } from '@/lib/affiliate/balance';

const schema = z.object({
  action: z.enum(['approve', 'reject']),
  adminNote: z.string().max(500).optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  return withAuth(async () => {
    await ensurePermission('users.read');
    const session = await getCurrentSession();
    if (!session) return jsonError(401, 'UNAUTHENTICATED');

    const body = await req.json().catch(() => ({}));
    const parsed = schema.safeParse(body);
    if (!parsed.success) return jsonError(400, 'VALIDATION', undefined, { issues: parsed.error.issues });

    const claim = await db.referralClaim.findUnique({ where: { id: params.id } });
    if (!claim) return jsonError(404, 'NOT_FOUND');
    if (claim.status !== 'pending') return jsonError(409, 'NOT_PENDING', 'This claim is no longer pending.');

    // The matching CommissionPayout reservation is keyed by the
    // affiliateId + amount + status='pending' so we look it up
    // freshly. (Phase E auto-creates a payout per claim so there
    // should be exactly one.)
    const payout = await db.commissionPayout.findFirst({
      where: {
        affiliateId: claim.userId,
        amount: claim.amount,
        method: 'wallet_transfer_pending',
        status: 'pending',
      },
      orderBy: { createdAt: 'desc' },
    });

    const settings = await loadReferralSettings();
    const now = new Date();

    if (parsed.data.action === 'reject') {
      await db.$transaction(async (tx) => {
        if (payout) {
          await tx.affiliateCommission.updateMany({
            where: { payoutId: payout.id },
            data: { payoutId: null, status: 'approved' },
          });
          await tx.commissionPayout.update({
            where: { id: payout.id },
            data: { status: 'rejected', reviewerId: session.sub, reviewedAt: now, adminNote: parsed.data.adminNote ?? null },
          });
        }
        await tx.referralClaim.update({
          where: { id: claim.id },
          data: { status: 'rejected', errorCode: parsed.data.adminNote ? null : 'ADMIN_REJECT' },
        });
        const snap = await computeBalanceFor(claim.userId, settings.holdDays, now);
        await tx.referralBalance.upsert({
          where: { userId: claim.userId },
          update: {
            pendingAmount: new Prisma.Decimal(snap.pendingAmount),
            claimableAmount: new Prisma.Decimal(snap.claimableAmount),
            claimedAmount: new Prisma.Decimal(snap.claimedAmount),
          },
          create: {
            userId: claim.userId,
            pendingAmount: new Prisma.Decimal(snap.pendingAmount),
            claimableAmount: new Prisma.Decimal(snap.claimableAmount),
            claimedAmount: new Prisma.Decimal(snap.claimedAmount),
          },
        });
      });

      await recordActivity({
        actorId: session.sub,
        actorRole: session.role,
        action: 'REFERRAL_CLAIM_REJECT',
        target: claim.id,
        meta: { adminNote: parsed.data.adminNote, amount: Number(claim.amount) },
      });

      return jsonOk({ ok: true });
    }

    // approve path
    if (!payout) {
      return jsonError(409, 'PAYOUT_MISSING', 'Could not find the reserved commission payout for this claim.');
    }

    await db.$transaction(async (tx) => {
      await tx.affiliateCommission.updateMany({
        where: { payoutId: payout.id },
        data: { status: 'paid' },
      });
      await tx.commissionPayout.update({
        where: { id: payout.id },
        data: { status: 'paid', paidAt: now, reviewerId: session.sub, reviewedAt: now, method: 'wallet_transfer' },
      });
      await tx.wallet.upsert({
        where: { userId: claim.userId },
        update: { balance: { increment: claim.amount } },
        create: { userId: claim.userId, balance: claim.amount },
      });
      const walletTx = await tx.transaction.create({
        data: {
          userId: claim.userId,
          type: 'referral',
          status: 'completed',
          amount: claim.amount,
          reference: payout.id,
          description: `Referral claim approved ${Number(claim.amount).toLocaleString()} BDT`,
          meta: { payoutId: payout.id, claimId: claim.id, approvedBy: session.sub } as Prisma.JsonObject,
        },
      });
      await tx.referralClaim.update({
        where: { id: claim.id },
        data: { status: 'paid', walletTxId: walletTx.id, paidAt: now },
      });
      const snap = await computeBalanceFor(claim.userId, settings.holdDays, now);
      await tx.referralBalance.upsert({
        where: { userId: claim.userId },
        update: {
          pendingAmount: new Prisma.Decimal(snap.pendingAmount),
          claimableAmount: new Prisma.Decimal(snap.claimableAmount),
          claimedAmount: new Prisma.Decimal(snap.claimedAmount),
          lastClaimedAt: now,
        },
        create: {
          userId: claim.userId,
          pendingAmount: new Prisma.Decimal(snap.pendingAmount),
          claimableAmount: new Prisma.Decimal(snap.claimableAmount),
          claimedAmount: new Prisma.Decimal(snap.claimedAmount),
          lastClaimedAt: now,
        },
      });
    });

    await recordActivity({
      actorId: session.sub,
      actorRole: session.role,
      action: 'REFERRAL_CLAIM_APPROVE',
      target: claim.id,
      meta: { amount: Number(claim.amount), adminNote: parsed.data.adminNote },
    });

    return jsonOk({ ok: true });
  });
}
