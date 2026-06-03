// Built by Anointed Coder.
//
// POST /api/me/referrals/claim
//
// Player-initiated referral claim. Behaviour by cadence:
//   weekly / monthly / auto. Recompute the balance from the
//     AffiliateCommission ledger, reserve the matured rows under a
//     synthetic CommissionPayout (method='wallet_transfer'), credit
//     the main wallet, write a Transaction(type='referral'), update
//     ReferralBalance, write a ReferralClaim(status='paid'). The
//     CommissionPayout doubles as the audit trail and prevents the
//     same commissions from being claimed twice.
//   manual. The same matured rows get reserved under a
//     CommissionPayout(status='pending'). Wallet does NOT move yet.
//     ReferralClaim row goes in with status='pending' awaiting admin
//     review. Admin approval flips the payout to paid via the
//     existing /admin/affiliate/payouts/[id]/approve flow.
//
// Idempotency:
//   - Cadence window blocks repeat claims inside the same ISO week
//     or calendar month.
//   - The reservation step uses an in-transaction findFirst +
//     updateMany so concurrent requests cannot double-stamp the same
//     AffiliateCommission row.
//   - Rate-limited to 6 claims per 5 minutes per user.
//
// Returns:
//   - status: 'paid' | 'pending'
//   - amount, claimId, walletTxId (when paid)

export const dynamic = 'force-dynamic';

import { Prisma } from '@prisma/client';
import { db } from '@/lib/db/client';
import { withAuth, recordActivity } from '@/lib/auth/guard';
import { requireActiveUser } from '@/lib/auth/rbac';
import { jsonError, jsonOk } from '@/lib/auth/errors';
import { rateLimit } from '@/lib/auth/rate-limit';
import {
  loadReferralSettings,
  computeBalanceFor,
  isWithinCadenceWindow,
} from '@/lib/affiliate/balance';

export async function POST() {
  return withAuth(async () => {
    const session = await requireActiveUser();
    const userId = session.sub;

    const limit = rateLimit(`referral-claim:${userId}`, 6, 5 * 60_000);
    if (!limit.ok) return jsonError(429, 'RATE_LIMITED');

    const settings = await loadReferralSettings();

    const balanceRow = await db.referralBalance.findUnique({ where: { userId } });
    const lastClaimedAt = balanceRow?.lastClaimedAt ?? null;
    if (!isWithinCadenceWindow(settings.cadence, lastClaimedAt)) {
      return jsonError(409, 'CADENCE_BLOCKED', `Claim already used for this ${settings.cadence} period.`, {
        lastClaimedAt,
        cadence: settings.cadence,
      });
    }

    if (settings.turnoverX > 0) {
      // Phase E places the turnover gate behind an honest stub: until
      // a turnover-tracking feed is wired we refuse the claim instead
      // of pretending it passed. Operators can set turnover_x=0 to
      // disable the gate.
      return jsonError(409, 'REFERRAL_TURNOVER_NOT_READY', `Turnover gate (${settings.turnoverX}x) is enabled but tracking is not configured yet.`);
    }

    const now = new Date();
    const cutoff = new Date(now.getTime() - settings.holdDays * 24 * 60 * 60 * 1000);

    // Wallet must exist before we can credit.
    const wallet = await db.wallet.findUnique({ where: { userId } });
    if (!wallet) return jsonError(409, 'WALLET_NOT_FOUND', 'Wallet not found. Make a deposit first.');

    // Resolve the user once for the synthetic payout descriptor.
    const user = await db.user.findUniqueOrThrow({
      where: { id: userId },
      select: { username: true, phone: true },
    });

    try {
      const out = await db.$transaction(async (tx) => {
        // Reserve every matured + un-reserved commission row.
        const matured = await tx.affiliateCommission.findMany({
          where: {
            affiliateId: userId,
            status: 'approved',
            payoutId: null,
            createdAt: { lte: cutoff },
          },
          orderBy: { createdAt: 'asc' },
          select: { id: true, amount: true },
        });

        const total = matured.reduce((acc, c) => acc.add(new Prisma.Decimal(c.amount)), new Prisma.Decimal(0));

        if (matured.length === 0 || total.lte(0)) {
          return { code: 'NOTHING_TO_CLAIM' as const };
        }

        const payoutMethod = settings.cadence === 'manual' ? 'wallet_transfer_pending' : 'wallet_transfer';
        const payoutStatus = settings.cadence === 'manual' ? 'pending' : 'approved';

        const payout = await tx.commissionPayout.create({
          data: {
            affiliateId: userId,
            amount: total,
            method: payoutMethod,
            accountNumber: 'wallet',
            accountName: user.username,
            status: payoutStatus,
          },
        });

        const ids = matured.map((c) => c.id);
        const reserved = await tx.affiliateCommission.updateMany({
          where: { id: { in: ids }, payoutId: null, status: 'approved' },
          data: { payoutId: payout.id },
        });
        if (reserved.count !== matured.length) {
          throw new Error('reservation_race');
        }

        if (settings.cadence === 'manual') {
          // No wallet movement yet. Pending claim row only.
          const claim = await tx.referralClaim.create({
            data: {
              userId,
              amount: total,
              status: 'pending',
              walletTxId: null,
            },
          });
          // Refresh ReferralBalance from the canonical ledger.
          const snap = await computeBalanceFor(userId, settings.holdDays, now);
          await tx.referralBalance.upsert({
            where: { userId },
            update: {
              pendingAmount: new Prisma.Decimal(snap.pendingAmount),
              claimableAmount: new Prisma.Decimal(snap.claimableAmount),
              claimedAmount: new Prisma.Decimal(snap.claimedAmount),
            },
            create: {
              userId,
              pendingAmount: new Prisma.Decimal(snap.pendingAmount),
              claimableAmount: new Prisma.Decimal(snap.claimableAmount),
              claimedAmount: new Prisma.Decimal(snap.claimedAmount),
            },
          });
          return { code: 'PENDING' as const, claimId: claim.id, amount: Number(total) };
        }

        // Auto / weekly / monthly cadence: credit the wallet now.
        await tx.affiliateCommission.updateMany({
          where: { id: { in: ids } },
          data: { status: 'paid' },
        });
        await tx.commissionPayout.update({
          where: { id: payout.id },
          data: { status: 'paid', paidAt: now },
        });
        await tx.wallet.update({
          where: { userId },
          data: { balance: { increment: total } },
        });

        const walletTx = await tx.transaction.create({
          data: {
            userId,
            type: 'referral',
            status: 'completed',
            amount: total,
            reference: payout.id,
            description: `Referral claim ${Number(total).toLocaleString()} BDT`,
            meta: {
              payoutId: payout.id,
              cadence: settings.cadence,
              commissionIds: ids,
            } as Prisma.JsonObject,
          },
        });

        const claim = await tx.referralClaim.create({
          data: {
            userId,
            amount: total,
            status: 'paid',
            walletTxId: walletTx.id,
            paidAt: now,
          },
        });

        // Refresh the cached projection from the canonical ledger.
        const snap = await computeBalanceFor(userId, settings.holdDays, now);
        await tx.referralBalance.upsert({
          where: { userId },
          update: {
            pendingAmount: new Prisma.Decimal(snap.pendingAmount),
            claimableAmount: new Prisma.Decimal(snap.claimableAmount),
            claimedAmount: new Prisma.Decimal(snap.claimedAmount),
            lastClaimedAt: now,
          },
          create: {
            userId,
            pendingAmount: new Prisma.Decimal(snap.pendingAmount),
            claimableAmount: new Prisma.Decimal(snap.claimableAmount),
            claimedAmount: new Prisma.Decimal(snap.claimedAmount),
            lastClaimedAt: now,
          },
        });

        return {
          code: 'PAID' as const,
          claimId: claim.id,
          amount: Number(total),
          walletTxId: walletTx.id,
        };
      });

      if (out.code === 'NOTHING_TO_CLAIM') {
        return jsonError(409, 'NOTHING_TO_CLAIM', 'No matured referral commissions to claim right now.');
      }

      await recordActivity({
        actorId: userId,
        actorRole: session.role,
        action: out.code === 'PAID' ? 'REFERRAL_CLAIM_PAID' : 'REFERRAL_CLAIM_PENDING',
        target: out.claimId,
        meta: { amount: out.amount, cadence: settings.cadence, walletTxId: out.code === 'PAID' ? out.walletTxId : null },
      });

      return jsonOk({
        status: out.code === 'PAID' ? 'paid' : 'pending',
        amount: out.amount,
        claimId: out.claimId,
        walletTxId: out.code === 'PAID' ? out.walletTxId : null,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[me/referrals/claim] failed', err);
      return jsonError(500, 'CLAIM_FAILED', msg);
    }
  });
}
