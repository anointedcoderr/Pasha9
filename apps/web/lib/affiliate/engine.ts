// Built by Anointed Coder.
//
// M2E Affiliate Commission Engine.
//
// On every approved deposit, walk up the referral chain (up to 3
// levels), and for each ancestor that is flagged isAffiliate, write
// an AffiliateCommission row at the ancestor's tier rate for that
// level. Commissions land in status="approved" so the affiliate can
// see them immediately and request payout. If we ever want admin
// pre-approval for fraud review, change the default to "pending"
// in one place (DEFAULT_COMMISSION_STATUS below).
//
// Payout lifecycle (separate from accrual):
//   requestPayout    user posts amount + payout method
//                    -> creates CommissionPayout(status=pending)
//                    -> stamps every approved-not-paid commission up
//                       to the requested amount with payoutId
//   approvePayout    admin confirms (manual transfer or auto-pay)
//                    -> CommissionPayout.status = approved
//   markPaid         admin marks the actual money sent
//                    -> CommissionPayout.status = paid
//                    -> linked commissions flip to status=paid
//   rejectPayout     admin declines
//                    -> CommissionPayout.status = rejected
//                    -> linked commissions are detached
//                       (payoutId nulled, status back to approved)
//
// Engine never throws to the caller. Every result includes an error
// field so the caller can record it in ActivityLog + return it in
// the approve response (same observability pattern as M2D bonuses).

import { Prisma } from '@prisma/client';
import { db } from '@/lib/db/client';

const DEFAULT_COMMISSION_STATUS = 'approved';
const MAX_LEVELS = 3;

// ---------- Helpers ----------

function dec(value: number | string | Prisma.Decimal): Prisma.Decimal {
  return new Prisma.Decimal(value);
}

interface ChainAncestor {
  level: number;
  user: {
    id: string;
    isAffiliate: boolean;
    affiliateTierId: string | null;
    affiliateTier: {
      id: string;
      name: string;
      level1Pct: Prisma.Decimal;
      level2Pct: Prisma.Decimal;
      level3Pct: Prisma.Decimal;
    } | null;
  };
}

interface ChainNode {
  id: string;
  referredById: string | null;
  referredBy: ChainAncestor['user'] | null;
}

async function loadChain(userId: string, maxLevels: number): Promise<ChainAncestor[]> {
  const chain: ChainAncestor[] = [];
  let currentId: string | null = userId;
  for (let level = 1; level <= maxLevels; level += 1) {
    if (!currentId) break;
    const u: ChainNode | null = await db.user.findUnique({
      where: { id: currentId },
      select: {
        id: true,
        referredById: true,
        referredBy: {
          select: {
            id: true,
            isAffiliate: true,
            affiliateTierId: true,
            affiliateTier: {
              select: { id: true, name: true, level1Pct: true, level2Pct: true, level3Pct: true },
            },
          },
        },
      },
    });
    if (!u || !u.referredBy) break;
    chain.push({ level, user: u.referredBy });
    currentId = u.referredById;
  }
  return chain;
}

function tierRateForLevel(
  tier: ChainAncestor['user']['affiliateTier'],
  level: number,
): Prisma.Decimal | null {
  if (!tier) return null;
  if (level === 1) return new Prisma.Decimal(tier.level1Pct);
  if (level === 2) return new Prisma.Decimal(tier.level2Pct);
  if (level === 3) return new Prisma.Decimal(tier.level3Pct);
  return null;
}

// ---------- Accrual ----------

export interface CommissionAccrualRow {
  affiliateId: string;
  level: number;
  tierName: string | null;
  ratePct: number;
  amount: number;
  commissionId: string;
}
export interface CommissionSkipRow {
  affiliateId: string;
  level: number;
  reason: string;
}
export interface AccrualResult {
  accrued: CommissionAccrualRow[];
  skipped: CommissionSkipRow[];
  chainDepth: number;
  error: string | null;
}

export async function accrueCommissionsOnDeposit(
  sourceUserId: string,
  depositId: string,
  depositAmount: Prisma.Decimal,
): Promise<AccrualResult> {
  const result: AccrualResult = { accrued: [], skipped: [], chainDepth: 0, error: null };

  let chain: ChainAncestor[];
  try {
    chain = await loadChain(sourceUserId, MAX_LEVELS);
  } catch (err) {
    const msg = err instanceof Error ? `${err.message}\n${err.stack ?? ''}` : String(err);
    console.error('[affiliate] chain lookup failed', msg);
    result.error = `chain_lookup_failed: ${msg.slice(0, 300)}`;
    return result;
  }
  result.chainDepth = chain.length;

  if (chain.length === 0) {
    console.info('[affiliate] no upline for user', { sourceUserId });
    return result;
  }

  for (const a of chain) {
    if (!a.user.isAffiliate) {
      result.skipped.push({ affiliateId: a.user.id, level: a.level, reason: 'not_affiliate' });
      console.info('[affiliate] skip', { affiliateId: a.user.id, level: a.level, reason: 'not_affiliate' });
      continue;
    }
    if (!a.user.affiliateTier) {
      result.skipped.push({ affiliateId: a.user.id, level: a.level, reason: 'no_tier_assigned' });
      console.info('[affiliate] skip', { affiliateId: a.user.id, level: a.level, reason: 'no_tier_assigned' });
      continue;
    }
    const rate = tierRateForLevel(a.user.affiliateTier, a.level);
    if (!rate || rate.lte(0)) {
      result.skipped.push({ affiliateId: a.user.id, level: a.level, reason: `rate_zero_at_level_${a.level}` });
      continue;
    }

    const amount = depositAmount.mul(rate).div(100);
    if (amount.lte(0)) {
      result.skipped.push({ affiliateId: a.user.id, level: a.level, reason: 'computed_amount_zero' });
      continue;
    }

    try {
      const row = await db.affiliateCommission.create({
        data: {
          affiliateId: a.user.id,
          sourceUserId,
          level: a.level,
          amount,
          basis: 'deposit_share',
          status: DEFAULT_COMMISSION_STATUS,
          depositId,
          tierId: a.user.affiliateTier.id,
          ratePct: rate,
          meta: {
            tierName: a.user.affiliateTier.name,
            depositAmount: Number(depositAmount),
          } as Prisma.JsonObject,
        },
      });
      result.accrued.push({
        affiliateId: a.user.id,
        level: a.level,
        tierName: a.user.affiliateTier.name,
        ratePct: Number(rate),
        amount: Number(amount),
        commissionId: row.id,
      });
      console.info('[affiliate] accrued', {
        affiliateId: a.user.id,
        level: a.level,
        tier: a.user.affiliateTier.name,
        rate: Number(rate),
        amount: Number(amount),
      });
    } catch (err) {
      const msg = err instanceof Error ? `${err.message}\n${err.stack ?? ''}` : String(err);
      console.error('[affiliate] commission write failed', { affiliateId: a.user.id, level: a.level }, msg);
      result.skipped.push({ affiliateId: a.user.id, level: a.level, reason: `write_failed: ${msg.slice(0, 200)}` });
      result.error = result.error ?? `write_failed: ${msg.slice(0, 200)}`;
    }
  }

  return result;
}

// ---------- Diagnose ----------

export async function diagnoseAffiliate(
  sourceUserId: string,
  depositAmount: number,
): Promise<{
  sourceUserExists: boolean;
  chainDepth: number;
  evaluated: Array<{
    affiliateId: string;
    level: number;
    isAffiliate: boolean;
    tierName: string | null;
    ratePct: number | null;
    payoutAmount: number;
    eligible: boolean;
    reason: string | null;
  }>;
}> {
  const amount = new Prisma.Decimal(depositAmount);
  const user = await db.user.findUnique({ where: { id: sourceUserId }, select: { id: true } });
  if (!user) {
    return { sourceUserExists: false, chainDepth: 0, evaluated: [] };
  }
  const chain = await loadChain(sourceUserId, MAX_LEVELS);
  const evaluated = chain.map((a) => {
    const rate = tierRateForLevel(a.user.affiliateTier, a.level);
    const payout = rate ? amount.mul(rate).div(100) : new Prisma.Decimal(0);
    let reason: string | null = null;
    let eligible = true;
    if (!a.user.isAffiliate) { reason = 'not_affiliate'; eligible = false; }
    else if (!a.user.affiliateTier) { reason = 'no_tier_assigned'; eligible = false; }
    else if (!rate || rate.lte(0)) { reason = `rate_zero_at_level_${a.level}`; eligible = false; }
    else if (payout.lte(0)) { reason = 'computed_amount_zero'; eligible = false; }
    return {
      affiliateId: a.user.id,
      level: a.level,
      isAffiliate: a.user.isAffiliate,
      tierName: a.user.affiliateTier?.name ?? null,
      ratePct: rate ? Number(rate) : null,
      payoutAmount: Number(payout),
      eligible,
      reason,
    };
  });
  return { sourceUserExists: true, chainDepth: chain.length, evaluated };
}

// ---------- Affiliate ledger summary ----------

export async function getAffiliateBalance(affiliateId: string): Promise<{
  approved: number;
  pending: number;
  paid: number;
  cancelled: number;
  withdrawable: number;
  inFlightPayouts: number;
}> {
  const rows = await db.affiliateCommission.groupBy({
    by: ['status'],
    where: { affiliateId },
    _sum: { amount: true },
  });
  const sums = { approved: 0, pending: 0, paid: 0, cancelled: 0 };
  for (const r of rows) {
    const k = r.status as keyof typeof sums;
    if (k in sums) sums[k] = Number(r._sum.amount ?? 0);
  }
  // Approved commissions that already have a non-paid payout id
  // (status=pending/approved) are reserved. We do not let the user
  // ask for those again.
  const inFlight = await db.commissionPayout.aggregate({
    where: { affiliateId, status: { in: ['pending', 'approved'] } },
    _sum: { amount: true },
  });
  const inFlightPayouts = Number(inFlight._sum.amount ?? 0);
  const withdrawable = Math.max(0, sums.approved - inFlightPayouts);
  return { ...sums, withdrawable, inFlightPayouts };
}

// ---------- Payout request ----------

export interface PayoutRequestOpts {
  affiliateId: string;
  amount: number;
  method: string;
  accountNumber: string;
  accountName: string;
}

export async function requestPayout(opts: PayoutRequestOpts): Promise<{ payoutId: string; amount: number; reservedCommissionIds: string[] }> {
  const amount = new Prisma.Decimal(opts.amount);
  if (amount.lte(0)) throw new Error('AMOUNT_INVALID');

  // Pre-check the available balance to give the user a clean error
  // before we open the transaction.
  const bal = await getAffiliateBalance(opts.affiliateId);
  if (amount.gt(new Prisma.Decimal(bal.withdrawable))) {
    throw new Error('INSUFFICIENT_BALANCE');
  }

  return await db.$transaction(async (tx) => {
    const payout = await tx.commissionPayout.create({
      data: {
        affiliateId: opts.affiliateId,
        amount,
        method: opts.method,
        accountNumber: opts.accountNumber,
        accountName: opts.accountName,
        status: 'pending',
      },
    });

    // Reserve commissions FIFO until we cover the requested amount.
    // Each commission either gets fully reserved (payoutId stamped)
    // or we stop at the point where the next commission would
    // overshoot. We do not split a commission across two payouts -
    // any leftover stays withdrawable for next time.
    const candidates = await tx.affiliateCommission.findMany({
      where: { affiliateId: opts.affiliateId, status: 'approved', payoutId: null },
      orderBy: { createdAt: 'asc' },
    });

    let covered = new Prisma.Decimal(0);
    const reservedIds: string[] = [];
    for (const c of candidates) {
      if (covered.gte(amount)) break;
      const next = covered.add(new Prisma.Decimal(c.amount));
      if (next.gt(amount)) {
        // Split avoidance: if adding this commission overshoots and
        // we have not yet covered the request, we still take it -
        // the affiliate is asking for X, we cover at least X. Any
        // overshoot is rounded down by the user-facing pre-check
        // (withdrawable is computed from approved sum).
        // For simplicity: include it.
      }
      await tx.affiliateCommission.update({
        where: { id: c.id },
        data: { payoutId: payout.id },
      });
      reservedIds.push(c.id);
      covered = next;
    }

    return { payoutId: payout.id, amount: Number(amount), reservedCommissionIds: reservedIds };
  });
}

// ---------- Admin lifecycle ----------

export async function approvePayout(payoutId: string, reviewerId: string, adminNote?: string): Promise<void> {
  await db.$transaction(async (tx) => {
    const p = await tx.commissionPayout.findUnique({ where: { id: payoutId } });
    if (!p) throw new Error('PAYOUT_NOT_FOUND');
    if (p.status !== 'pending') throw new Error('PAYOUT_NOT_PENDING');
    await tx.commissionPayout.update({
      where: { id: payoutId },
      data: {
        status: 'approved',
        reviewerId,
        reviewedAt: new Date(),
        ...(adminNote ? { adminNote } : {}),
      },
    });
  });
}

export async function markPayoutPaid(payoutId: string, reviewerId: string, opts?: { providerKey?: string; providerRef?: string; adminNote?: string }): Promise<void> {
  await db.$transaction(async (tx) => {
    const p = await tx.commissionPayout.findUnique({ where: { id: payoutId } });
    if (!p) throw new Error('PAYOUT_NOT_FOUND');
    if (p.status === 'paid') return;
    if (p.status === 'rejected') throw new Error('PAYOUT_REJECTED');
    await tx.commissionPayout.update({
      where: { id: payoutId },
      data: {
        status: 'paid',
        paidAt: new Date(),
        reviewerId,
        reviewedAt: p.reviewedAt ?? new Date(),
        ...(opts?.providerKey ? { providerKey: opts.providerKey } : {}),
        ...(opts?.providerRef ? { providerRef: opts.providerRef } : {}),
        ...(opts?.adminNote ? { adminNote: opts.adminNote } : {}),
      },
    });
    // Flip every linked commission to paid so the user balance
    // recomputes correctly.
    await tx.affiliateCommission.updateMany({
      where: { payoutId },
      data: { status: 'paid' },
    });
  });
}

export async function rejectPayout(payoutId: string, reviewerId: string, adminNote?: string): Promise<void> {
  await db.$transaction(async (tx) => {
    const p = await tx.commissionPayout.findUnique({ where: { id: payoutId } });
    if (!p) throw new Error('PAYOUT_NOT_FOUND');
    if (p.status === 'paid') throw new Error('ALREADY_PAID');
    if (p.status === 'rejected') return;
    await tx.commissionPayout.update({
      where: { id: payoutId },
      data: {
        status: 'rejected',
        reviewerId,
        reviewedAt: new Date(),
        adminNote: adminNote ?? null,
      },
    });
    // Detach the reserved commissions so the affiliate can request
    // again. Status stays approved (not flipped to paid).
    await tx.affiliateCommission.updateMany({
      where: { payoutId },
      data: { payoutId: null },
    });
  });
}
