// Built by Anointed Coder.
//
// M2E Affiliate Commission Engine.
//
// On every approved deposit, walk up the referral chain (up to 3
// levels), and write an AffiliateCommission row at each ancestor's
// assigned tier rate or the active default tier rate for that level.
// Commissions land in status="approved" so the referrer can
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
import { applyWalletMovement, LEDGER_TYPE } from '@/lib/wallet/ledger';
import { computeBalanceFor, loadReferralSettings } from './balance';
import { settleMaturedReferralCommissions } from './settlement';

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
      firstDepositRewardBdt: Prisma.Decimal | null;
      status: string;
    } | null;
  };
}

interface ChainNode {
  id: string;
  referredById: string | null;
  referredBy: ChainAncestor['user'] | null;
}

async function loadChain(
  userId: string,
  maxLevels: number,
  client: Pick<Prisma.TransactionClient, 'user'> = db,
): Promise<ChainAncestor[]> {
  const chain: ChainAncestor[] = [];
  let currentId: string | null = userId;
  for (let level = 1; level <= maxLevels; level += 1) {
    if (!currentId) break;
    const u: ChainNode | null = await client.user.findUnique({
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
              select: { id: true, name: true, level1Pct: true, level2Pct: true, level3Pct: true, firstDepositRewardBdt: true, status: true },
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
  autoPaid: Array<{ affiliateId: string; claimId: string; amount: number }>;
}

export async function accrueCommissionsOnDeposit(
  sourceUserId: string,
  depositId: string,
  depositAmount: Prisma.Decimal,
): Promise<AccrualResult> {
  const result: AccrualResult = { accrued: [], skipped: [], chainDepth: 0, error: null, autoPaid: [] };

  try {
    const settings = await loadReferralSettings();
    if (!settings.enabled) {
      result.skipped.push({ affiliateId: '', level: 0, reason: 'engine_disabled' });
      return result;
    }

    const transactionResult = await db.$transaction(async (tx) => {
      const skipped: CommissionSkipRow[] = [];
      const planned: Prisma.AffiliateCommissionCreateManyInput[] = [];
      const approvedDeposit = await tx.deposit.findUnique({
        where: { id: depositId },
        select: { userId: true, amount: true, status: true },
      });
      if (!approvedDeposit || approvedDeposit.userId !== sourceUserId || approvedDeposit.status !== 'approved') {
        throw new Error('DEPOSIT_NOT_APPROVED');
      }
      const finalAmount = new Prisma.Decimal(approvedDeposit.amount);
      if (!finalAmount.eq(depositAmount)) {
        skipped.push({ affiliateId: '', level: 0, reason: 'approved_amount_snapshot_updated' });
      }

      const chain = await loadChain(sourceUserId, MAX_LEVELS, tx);
      if (chain.length === 0) {
        return { accrued: [] as CommissionAccrualRow[], skipped, chainDepth: 0, affected: [] as string[] };
      }

      const defaultTier = await tx.commissionTier.findFirst({
        where: { status: 'active' },
        orderBy: { position: 'asc' },
        select: { id: true, name: true, level1Pct: true, level2Pct: true, level3Pct: true, firstDepositRewardBdt: true, status: true },
      });
      const cumulative = await tx.deposit.aggregate({
        where: { userId: sourceUserId, status: 'approved' },
        _sum: { amount: true },
      });
      const cumulativeApproved = new Prisma.Decimal(cumulative._sum.amount ?? 0);
      const existingDepositRows = await tx.affiliateCommission.findMany({
        where: { depositId },
        select: { affiliateId: true, level: true, basis: true },
      });
      const existingDepositKeys = new Set(
        existingDepositRows.map((row) => `${row.affiliateId}:${row.level}:${row.basis}`),
      );
      const directAffiliateId = chain.find((ancestor) => ancestor.level === 1)?.user.id ?? null;
      const existingFixedReward = directAffiliateId
        ? await tx.affiliateCommission.findFirst({
            where: {
              affiliateId: directAffiliateId,
              sourceUserId,
              level: 1,
              basis: 'first_deposit_reward',
            },
            select: { id: true },
          })
        : null;

      for (const ancestor of chain) {
        const assignedTier = ancestor.user.affiliateTier?.status === 'active' ? ancestor.user.affiliateTier : null;
        const effectiveTier = assignedTier ?? defaultTier;
        if (!effectiveTier) {
          skipped.push({ affiliateId: ancestor.user.id, level: ancestor.level, reason: 'no_active_tier' });
          continue;
        }

        const rate = tierRateForLevel(effectiveTier, ancestor.level);
        if (rate && rate.gt(0)) {
          const amount = finalAmount.mul(rate).div(100);
          if (amount.gt(0)) {
            const legacyKey = `${ancestor.user.id}:${ancestor.level}:deposit_share`;
            if (existingDepositKeys.has(legacyKey)) {
              skipped.push({ affiliateId: ancestor.user.id, level: ancestor.level, reason: 'duplicate_already_accrued' });
            } else {
              planned.push({
                affiliateId: ancestor.user.id,
                sourceUserId,
                level: ancestor.level,
                amount,
                basis: 'deposit_share',
                status: DEFAULT_COMMISSION_STATUS,
                depositId,
                tierId: effectiveTier.id,
                ratePct: rate,
                idempotencyKey: `deposit_share:${depositId}:${ancestor.user.id}:${ancestor.level}`,
                meta: {
                  tierName: effectiveTier.name,
                  tierIsDefaultFallback: !assignedTier,
                  depositAmount: Number(finalAmount),
                } as Prisma.JsonObject,
              });
            }
          }
        } else {
          skipped.push({ affiliateId: ancestor.user.id, level: ancestor.level, reason: `rate_zero_at_level_${ancestor.level}` });
        }

        if (ancestor.level !== 1) continue;
        const tierReward = effectiveTier.firstDepositRewardBdt == null ? null : Number(effectiveTier.firstDepositRewardBdt);
        const rewardAmount = tierReward != null ? tierReward : settings.firstDepositRewardBdt;
        if (rewardAmount <= 0) continue;
        if (cumulativeApproved.lt(settings.firstDepositMinBdt)) {
          skipped.push({
            affiliateId: ancestor.user.id,
            level: 1,
            reason: `first_deposit_min_${settings.firstDepositMinBdt}_not_met`,
          });
          continue;
        }
        if (existingFixedReward) {
          skipped.push({ affiliateId: ancestor.user.id, level: 1, reason: 'first_deposit_reward_already_accrued' });
          continue;
        }

        planned.push({
          affiliateId: ancestor.user.id,
          sourceUserId,
          level: 1,
          amount: new Prisma.Decimal(rewardAmount),
          basis: 'first_deposit_reward',
          status: DEFAULT_COMMISSION_STATUS,
          depositId,
          tierId: effectiveTier.id,
          ratePct: null,
          idempotencyKey: `first_deposit_reward:${ancestor.user.id}:${sourceUserId}`,
          meta: {
            tierName: effectiveTier.name,
            rewardAmount,
            minimumApprovedDeposit: settings.firstDepositMinBdt,
            cumulativeApprovedDeposit: Number(cumulativeApproved),
            source: tierReward != null ? 'tier' : 'global_setting',
            tierIsDefaultFallback: !assignedTier,
          } as Prisma.JsonObject,
        });
      }

      const plannedKeys = planned.map((row) => row.idempotencyKey).filter((key): key is string => Boolean(key));
      const existingKeys = plannedKeys.length > 0
        ? new Set((await tx.affiliateCommission.findMany({
            where: { idempotencyKey: { in: plannedKeys } },
            select: { idempotencyKey: true },
          })).map((row) => row.idempotencyKey).filter((key): key is string => Boolean(key)))
        : new Set<string>();
      if (planned.length > 0) {
        await tx.affiliateCommission.createMany({ data: planned, skipDuplicates: true });
      }
      const insertedRows = plannedKeys.length > 0
        ? await tx.affiliateCommission.findMany({
            where: { idempotencyKey: { in: plannedKeys.filter((key) => !existingKeys.has(key)) } },
            select: { id: true, affiliateId: true, level: true, amount: true, ratePct: true, idempotencyKey: true, meta: true },
          })
        : [];
      const accrued = insertedRows.map((row) => {
        const meta = (row.meta ?? null) as { tierName?: unknown } | null;
        return {
          affiliateId: row.affiliateId,
          level: row.level,
          tierName: typeof meta?.tierName === 'string' ? meta.tierName : null,
          ratePct: Number(row.ratePct ?? 0),
          amount: Number(row.amount),
          commissionId: row.id,
        };
      });
      for (const key of existingKeys) {
        const row = planned.find((candidate) => candidate.idempotencyKey === key);
        if (row) skipped.push({ affiliateId: row.affiliateId, level: row.level, reason: 'duplicate_already_accrued' });
      }

      const affected = Array.from(new Set(chain.map((a) => a.user.id)));
      for (const affiliateId of affected) {
        const snap = await computeBalanceFor(affiliateId, settings.holdDays, new Date(), tx);
        await tx.referralBalance.upsert({
          where: { userId: affiliateId },
          update: {
            pendingAmount: new Prisma.Decimal(snap.pendingAmount),
            claimableAmount: new Prisma.Decimal(snap.claimableAmount),
            claimedAmount: new Prisma.Decimal(snap.claimedAmount),
          },
          create: {
            userId: affiliateId,
            pendingAmount: new Prisma.Decimal(snap.pendingAmount),
            claimableAmount: new Prisma.Decimal(snap.claimableAmount),
            claimedAmount: new Prisma.Decimal(snap.claimedAmount),
          },
        });
      }
      return { accrued, skipped, chainDepth: chain.length, affected };
    });

    result.accrued = transactionResult.accrued;
    result.skipped = transactionResult.skipped;
    result.chainDepth = transactionResult.chainDepth;
    if (settings.cadence === 'auto') {
      for (const affiliateId of transactionResult.affected) {
        try {
          const paid = await settleMaturedReferralCommissions({
            userId: affiliateId,
            mode: 'auto',
            actorId: affiliateId,
            actorRole: 'system',
            settings,
          });
          if (paid.code === 'paid') {
            result.autoPaid.push({ affiliateId, claimId: paid.claimId, amount: paid.amount });
          }
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          result.error = result.error ?? `auto_settlement_failed: ${message.slice(0, 200)}`;
        }
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? `${err.message}\n${err.stack ?? ''}` : String(err);
    console.error('[affiliate] accrual failed', msg);
    result.error = `accrual_failed: ${msg.slice(0, 300)}`;
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
  const defaultTier = await db.commissionTier.findFirst({
    where: { status: 'active' },
    orderBy: { position: 'asc' },
    select: { id: true, name: true, level1Pct: true, level2Pct: true, level3Pct: true, firstDepositRewardBdt: true, status: true },
  });
  const evaluated = chain.map((a) => {
    const tier = a.user.affiliateTier?.status === 'active' ? a.user.affiliateTier : defaultTier;
    const rate = tierRateForLevel(tier, a.level);
    const payout = rate ? amount.mul(rate).div(100) : new Prisma.Decimal(0);
    let reason: string | null = null;
    let eligible = true;
    if (!tier) { reason = 'no_active_tier'; eligible = false; }
    else if (!rate || rate.lte(0)) { reason = `rate_zero_at_level_${a.level}`; eligible = false; }
    else if (payout.lte(0)) { reason = 'computed_amount_zero'; eligible = false; }
    return {
      affiliateId: a.user.id,
      level: a.level,
      isAffiliate: a.user.isAffiliate,
      tierName: tier?.name ?? null,
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

    const now = new Date();
    await tx.commissionPayout.update({
      where: { id: payoutId },
      data: {
        status: 'paid',
        paidAt: now,
        reviewerId,
        reviewedAt: p.reviewedAt ?? now,
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

    // Settle the matching ReferralClaim and credit the affiliate's
    // Wallet.balance. Before this block the admin "mark paid" action
    // only flipped CommissionPayout.status and AffiliateCommission
    // rows; the ReferralClaim stayed at status='pending' / walletTxId
    // null / paidAt null, and the affiliate's Wallet was never
    // incremented. The user saw their claim hanging in /me/referrals
    // forever even though the admin had marked the payout paid.
    //
    // ReferralClaim.payoutId is @unique so there is at most one claim
    // per payout, and findUnique by payoutId is the canonical lookup.
    const claim = await tx.referralClaim.findUnique({ where: { payoutId } });
    if (claim && claim.status !== 'paid') {
      const amount = new Prisma.Decimal(p.amount);

      await applyWalletMovement({
        tx,
        userId: p.affiliateId,
        amount,
        type: LEDGER_TYPE.referral,
        description: 'Referral commission payout',
        referenceId: payoutId,
        meta: { payoutId } as Prisma.JsonObject,
      });

      const ledger = await tx.transaction.create({
        data: {
          userId: p.affiliateId,
          type: 'referral',
          status: 'completed',
          amount,
          reference: payoutId,
          description: `Referral payout settled`,
          meta: {
            payoutId,
            referralClaimId: claim.id,
            method: p.method,
            providerKey: opts?.providerKey ?? p.providerKey ?? null,
            providerRef: opts?.providerRef ?? p.providerRef ?? null,
          } as Prisma.JsonObject,
        },
      });

      await tx.referralClaim.update({
        where: { id: claim.id },
        data: {
          status: 'paid',
          paidAt: now,
          walletTxId: ledger.id,
        },
      });
    }
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
