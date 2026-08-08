// Built by Anointed Coder.
//
// Referral commission settlement. The AffiliateCommission ledger is
// canonical; every wallet credit, claim, payout reservation, turnover
// lock, transaction, balance projection, and audit row is written in
// one Prisma transaction.

import { Prisma } from '@prisma/client';
import { db } from '@/lib/db/client';
import { applyWalletMovement, LEDGER_TYPE } from '@/lib/wallet/ledger';
import {
  computeBalanceFor,
  isWithinCadenceWindow,
  loadReferralSettings,
  type ReferralSettings,
} from './balance';

type Tx = Prisma.TransactionClient;

type CommissionForSettlement = {
  id: string;
  amount: Prisma.Decimal;
  basis: string;
};

export type ReferralSettlementResult =
  | { code: 'paid'; claimId: string; payoutId: string; walletTxId: string; amount: number; turnoverGrantIds: string[] }
  | { code: 'pending'; claimId: string; payoutId: string; amount: number }
  | { code: 'cadence_blocked'; cadence: ReferralSettings['cadence']; lastClaimedAt: Date | null }
  | { code: 'nothing_to_claim' }
  | { code: 'auto_disabled' };

async function syncBalanceInTx(tx: Tx, userId: string, settings: ReferralSettings, now: Date, lastClaimedAt?: Date) {
  const snap = await computeBalanceFor(userId, settings.holdDays, now, tx);
  await tx.referralBalance.upsert({
    where: { userId },
    update: {
      pendingAmount: new Prisma.Decimal(snap.pendingAmount),
      claimableAmount: new Prisma.Decimal(snap.claimableAmount),
      claimedAmount: new Prisma.Decimal(snap.claimedAmount),
      ...(lastClaimedAt ? { lastClaimedAt } : {}),
    },
    create: {
      userId,
      pendingAmount: new Prisma.Decimal(snap.pendingAmount),
      claimableAmount: new Prisma.Decimal(snap.claimableAmount),
      claimedAmount: new Prisma.Decimal(snap.claimedAmount),
      lastClaimedAt: lastClaimedAt ?? null,
    },
  });
}

async function createTurnoverGrantsInTx(
  tx: Tx,
  userId: string,
  claimId: string,
  commissions: CommissionForSettlement[],
  turnoverX: number,
): Promise<string[]> {
  if (turnoverX <= 0) return [];

  const fixedAmount = commissions
    .filter((c) => c.basis === 'first_deposit_reward')
    .reduce((sum, c) => sum.add(c.amount), new Prisma.Decimal(0));
  const commissionAmount = commissions
    .filter((c) => c.basis !== 'first_deposit_reward')
    .reduce((sum, c) => sum.add(c.amount), new Prisma.Decimal(0));

  const groups = [
    { sourceType: 'referral_first_deposit', amount: fixedAmount },
    { sourceType: 'referral_commission', amount: commissionAmount },
  ];
  const grantIds: string[] = [];

  for (const group of groups) {
    if (group.amount.lte(0)) continue;
    const grant = await tx.userBonus.create({
      data: {
        userId,
        bonusRuleId: null,
        amount: group.amount,
        status: 'active',
        turnoverRequired: group.amount.mul(turnoverX),
        turnoverProgress: 0,
        sourceType: group.sourceType,
        sourceId: claimId,
        note: `Referral reward turnover ${turnoverX}x`,
      },
    });
    grantIds.push(grant.id);
  }

  return grantIds;
}

async function payReservedClaimInTx(
  tx: Tx,
  opts: {
    claimId: string;
    payoutId: string;
    userId: string;
    commissions: CommissionForSettlement[];
    settings: ReferralSettings;
    actorId: string;
    actorRole: string;
    action: string;
    now: Date;
  },
): Promise<{ walletTxId: string; turnoverGrantIds: string[]; amount: number }> {
  const total = opts.commissions.reduce((sum, c) => sum.add(c.amount), new Prisma.Decimal(0));
  const ids = opts.commissions.map((c) => c.id);

  await tx.affiliateCommission.updateMany({
    where: { id: { in: ids }, payoutId: opts.payoutId },
    data: { status: 'paid' },
  });
  await tx.commissionPayout.update({
    where: { id: opts.payoutId },
    data: { status: 'paid', paidAt: opts.now },
  });
  await applyWalletMovement({
    tx,
    userId: opts.userId,
    amount: total,
    type: LEDGER_TYPE.affiliate,
    description: 'Affiliate commission settlement',
    referenceId: opts.payoutId,
    meta: { payoutId: opts.payoutId, claimId: opts.claimId } as Prisma.JsonObject,
  });

  const turnoverGrantIds = await createTurnoverGrantsInTx(
    tx,
    opts.userId,
    opts.claimId,
    opts.commissions,
    opts.settings.turnoverX,
  );
  const walletTx = await tx.transaction.create({
    data: {
      userId: opts.userId,
      type: 'referral',
      status: 'completed',
      amount: total,
      reference: opts.payoutId,
      description: `Referral reward ${Number(total).toLocaleString()} BDT`,
      meta: {
        claimId: opts.claimId,
        payoutId: opts.payoutId,
        cadence: opts.settings.cadence,
        commissionIds: ids,
        turnoverX: opts.settings.turnoverX,
        turnoverGrantIds,
      } as Prisma.JsonObject,
    },
  });
  await tx.referralClaim.update({
    where: { id: opts.claimId },
    data: { status: 'paid', walletTxId: walletTx.id, paidAt: opts.now },
  });
  await syncBalanceInTx(tx, opts.userId, opts.settings, opts.now, opts.now);
  await tx.activityLog.create({
    data: {
      actorId: opts.actorId,
      actorRole: opts.actorRole,
      action: opts.action,
      target: opts.claimId,
      detail: `amount=${Number(total)};turnoverX=${opts.settings.turnoverX}`,
      meta: {
        userId: opts.userId,
        payoutId: opts.payoutId,
        walletTxId: walletTx.id,
        commissionIds: ids,
        turnoverGrantIds,
      } as Prisma.JsonObject,
    },
  });

  return { walletTxId: walletTx.id, turnoverGrantIds, amount: Number(total) };
}

export async function settleMaturedReferralCommissions(opts: {
  userId: string;
  mode: 'claim' | 'auto';
  actorId: string;
  actorRole: string;
  settings?: ReferralSettings;
}): Promise<ReferralSettlementResult> {
  const settings = opts.settings ?? await loadReferralSettings();
  if (opts.mode === 'auto' && settings.cadence !== 'auto') return { code: 'auto_disabled' };

  const now = new Date();
  const cutoff = new Date(now.getTime() - settings.holdDays * 86_400_000);

  return db.$transaction(async (tx) => {
    const balance = await tx.referralBalance.findUnique({ where: { userId: opts.userId } });
    if (
      opts.mode === 'claim'
      && !isWithinCadenceWindow(settings.cadence, balance?.lastClaimedAt ?? null, now)
    ) {
      return {
        code: 'cadence_blocked' as const,
        cadence: settings.cadence,
        lastClaimedAt: balance?.lastClaimedAt ?? null,
      };
    }

    const matured = await tx.affiliateCommission.findMany({
      where: {
        affiliateId: opts.userId,
        status: 'approved',
        payoutId: null,
        createdAt: { lte: cutoff },
      },
      orderBy: { createdAt: 'asc' },
      select: { id: true, amount: true, basis: true },
    });
    const total = matured.reduce((sum, c) => sum.add(c.amount), new Prisma.Decimal(0));
    if (matured.length === 0 || total.lte(0)) {
      await syncBalanceInTx(tx, opts.userId, settings, now);
      return { code: 'nothing_to_claim' as const };
    }

    const user = await tx.user.findUniqueOrThrow({
      where: { id: opts.userId },
      select: { username: true },
    });
    const manual = settings.cadence === 'manual' && opts.mode === 'claim';
    const payout = await tx.commissionPayout.create({
      data: {
        affiliateId: opts.userId,
        amount: total,
        method: manual ? 'wallet_transfer_pending' : 'wallet_transfer',
        accountNumber: 'wallet',
        accountName: user.username,
        status: manual ? 'pending' : 'approved',
      },
    });
    const ids = matured.map((c) => c.id);
    const reserved = await tx.affiliateCommission.updateMany({
      where: { id: { in: ids }, payoutId: null, status: 'approved' },
      data: { payoutId: payout.id },
    });
    if (reserved.count !== matured.length) throw new Error('REFERRAL_RESERVATION_RACE');

    const claim = await tx.referralClaim.create({
      data: {
        userId: opts.userId,
        amount: total,
        status: manual ? 'pending' : 'processing',
        payoutId: payout.id,
      },
    });

    if (manual) {
      await syncBalanceInTx(tx, opts.userId, settings, now);
      await tx.activityLog.create({
        data: {
          actorId: opts.actorId,
          actorRole: opts.actorRole,
          action: 'REFERRAL_CLAIM_PENDING',
          target: claim.id,
          detail: `amount=${Number(total)}`,
          meta: { payoutId: payout.id, commissionIds: ids } as Prisma.JsonObject,
        },
      });
      return { code: 'pending' as const, claimId: claim.id, payoutId: payout.id, amount: Number(total) };
    }

    const paid = await payReservedClaimInTx(tx, {
      claimId: claim.id,
      payoutId: payout.id,
      userId: opts.userId,
      commissions: matured,
      settings,
      actorId: opts.actorId,
      actorRole: opts.actorRole,
      action: opts.mode === 'auto' ? 'REFERRAL_AUTO_PAID' : 'REFERRAL_CLAIM_PAID',
      now,
    });
    return {
      code: 'paid' as const,
      claimId: claim.id,
      payoutId: payout.id,
      walletTxId: paid.walletTxId,
      amount: paid.amount,
      turnoverGrantIds: paid.turnoverGrantIds,
    };
  });
}

export async function reviewManualReferralClaim(opts: {
  claimId: string;
  action: 'approve' | 'reject';
  actorId: string;
  actorRole: string;
  adminNote?: string;
}): Promise<{ status: 'paid' | 'rejected'; amount: number; walletTxId?: string; turnoverGrantIds?: string[] }> {
  const settings = await loadReferralSettings();
  const now = new Date();

  return db.$transaction(async (tx) => {
    const claim = await tx.referralClaim.findUnique({ where: { id: opts.claimId } });
    if (!claim) throw new Error('REFERRAL_CLAIM_NOT_FOUND');
    if (claim.status !== 'pending') throw new Error('REFERRAL_CLAIM_NOT_PENDING');
    let payoutId = claim.payoutId;
    if (!payoutId) {
      const legacyPayout = await tx.commissionPayout.findFirst({
        where: {
          affiliateId: claim.userId,
          amount: claim.amount,
          method: 'wallet_transfer_pending',
          status: 'pending',
        },
        orderBy: { createdAt: 'desc' },
      });
      payoutId = legacyPayout?.id ?? null;
      if (payoutId) {
        await tx.referralClaim.update({ where: { id: claim.id }, data: { payoutId } });
      }
    }
    if (!payoutId) throw new Error('REFERRAL_PAYOUT_MISSING');
    const reservedReview = await tx.referralClaim.updateMany({
      where: { id: claim.id, status: 'pending' },
      data: { status: 'reviewing' },
    });
    if (reservedReview.count !== 1) throw new Error('REFERRAL_CLAIM_NOT_PENDING');

    const commissions = await tx.affiliateCommission.findMany({
      where: { payoutId },
      select: { id: true, amount: true, basis: true },
    });
    if (commissions.length === 0) throw new Error('REFERRAL_RESERVED_COMMISSIONS_MISSING');

    if (opts.action === 'reject') {
      await tx.affiliateCommission.updateMany({
        where: { payoutId },
        data: { payoutId: null, status: 'approved' },
      });
      await tx.commissionPayout.update({
        where: { id: payoutId },
        data: {
          status: 'rejected',
          reviewerId: opts.actorId,
          reviewedAt: now,
          adminNote: opts.adminNote ?? null,
        },
      });
      await tx.referralClaim.update({
        where: { id: claim.id },
        data: { status: 'rejected', errorCode: opts.adminNote ? null : 'ADMIN_REJECT' },
      });
      await syncBalanceInTx(tx, claim.userId, settings, now);
      await tx.activityLog.create({
        data: {
          actorId: opts.actorId,
          actorRole: opts.actorRole,
          action: 'REFERRAL_CLAIM_REJECT',
          target: claim.id,
          detail: opts.adminNote ?? 'Rejected by admin',
          meta: { amount: Number(claim.amount), payoutId } as Prisma.JsonObject,
        },
      });
      return { status: 'rejected' as const, amount: Number(claim.amount) };
    }

    await tx.commissionPayout.update({
      where: { id: payoutId },
      data: { reviewerId: opts.actorId, reviewedAt: now, adminNote: opts.adminNote ?? null },
    });
    const paid = await payReservedClaimInTx(tx, {
      claimId: claim.id,
      payoutId,
      userId: claim.userId,
      commissions,
      settings,
      actorId: opts.actorId,
      actorRole: opts.actorRole,
      action: 'REFERRAL_CLAIM_APPROVE',
      now,
    });
    return {
      status: 'paid' as const,
      amount: paid.amount,
      walletTxId: paid.walletTxId,
      turnoverGrantIds: paid.turnoverGrantIds,
    };
  });
}

export async function autoSettleMaturedReferralUsers(settings: ReferralSettings): Promise<{
  usersChecked: number;
  claimsPaid: number;
  amountPaid: number;
  failures: number;
}> {
  if (settings.cadence !== 'auto') return { usersChecked: 0, claimsPaid: 0, amountPaid: 0, failures: 0 };

  const distinct = await db.affiliateCommission.groupBy({
    by: ['affiliateId'],
    where: { status: 'approved', payoutId: null },
  });
  let claimsPaid = 0;
  let amountPaid = 0;
  let failures = 0;
  for (const row of distinct) {
    try {
      const result = await settleMaturedReferralCommissions({
        userId: row.affiliateId,
        mode: 'auto',
        actorId: row.affiliateId,
        actorRole: 'system',
        settings,
      });
      if (result.code === 'paid') {
        claimsPaid += 1;
        amountPaid += result.amount;
      }
    } catch (err) {
      failures += 1;
      console.error('[referral-auto-settle] failed', { affiliateId: row.affiliateId, err });
    }
  }
  return { usersChecked: distinct.length, claimsPaid, amountPaid, failures };
}
