// Built by Anointed Coder.
//
// M4 Phase E referral balance projector. The ReferralBalance table
// is a cached projection of the canonical AffiliateCommission ledger:
//
//   pendingAmount   sum of:
//                     status='pending' commissions
//                     + status='approved' commissions whose
//                       createdAt + holdDays > now (still in hold).
//   claimableAmount sum of approved commissions, no payoutId, whose
//                     createdAt + holdDays <= now AND no in-flight
//                     CommissionPayout has reserved them.
//   claimedAmount   sum of status='paid' commissions.
//
// The cron at /api/cron/referral-mature recomputes this projection
// for every affiliate. The /api/me/referrals/claim endpoint
// recomputes it for the claiming user in the same db.$transaction
// that grants the wallet credit so a stale row never under- or
// over-pays.
//
// SystemSetting 'referral_hold_days' (default 7) controls how long a
// commission sits in pending before it matures. 'referral_turnover_x'
// (default 0 = no gate) is read by the claim endpoint to decide
// whether the user has met the wagering bar.

import { Prisma } from '@prisma/client';
import { db } from '@/lib/db/client';

const HOLD_DAYS_SETTING = 'referral_hold_days';
const CADENCE_SETTING = 'referral_claim_cadence';
const TURNOVER_SETTING = 'referral_turnover_x';
const ENABLED_SETTING = 'referral_enabled';
const HOLD_ENABLED_SETTING = 'referral_hold_enabled';

export interface ReferralSettings {
  enabled: boolean;
  holdEnabled: boolean;
  cadence: 'weekly' | 'monthly' | 'manual' | 'auto';
  holdDays: number;
  turnoverX: number;
}

export interface BalanceSnapshot {
  pendingAmount: number;
  claimableAmount: number;
  claimedAmount: number;
}

export async function loadReferralSettings(): Promise<ReferralSettings> {
  const rows = await db.systemSetting.findMany({
    where: { key: { in: [HOLD_DAYS_SETTING, CADENCE_SETTING, TURNOVER_SETTING, ENABLED_SETTING, HOLD_ENABLED_SETTING] } },
  });
  const get = (k: string) => rows.find((r) => r.key === k)?.value;
  const cadence = (get(CADENCE_SETTING) ?? 'weekly').toLowerCase();
  const holdDaysRaw = Math.max(0, Number(get(HOLD_DAYS_SETTING) ?? 7) || 0);
  const turnoverX = Math.max(0, Number(get(TURNOVER_SETTING) ?? 0) || 0);
  // Default ON when the row is missing so existing installations keep
  // the same behaviour they had before the toggle landed.
  const enabledRaw = (get(ENABLED_SETTING) ?? 'true').trim().toLowerCase();
  const holdEnabledRaw = (get(HOLD_ENABLED_SETTING) ?? 'true').trim().toLowerCase();
  const enabled = enabledRaw !== 'false' && enabledRaw !== '0' && enabledRaw !== 'off';
  const holdEnabled = holdEnabledRaw !== 'false' && holdEnabledRaw !== '0' && holdEnabledRaw !== 'off';
  return {
    enabled,
    holdEnabled,
    cadence: cadence === 'monthly' || cadence === 'manual' || cadence === 'auto' ? (cadence as ReferralSettings['cadence']) : 'weekly',
    // When the hold toggle is off, treat holdDays as 0 so the balance
    // projector marks commissions claimable immediately.
    holdDays: holdEnabled ? holdDaysRaw : 0,
    turnoverX,
  };
}

/** Compute the balance snapshot for a single user from
 *  AffiliateCommission rows. Pure read; safe to call inside a
 *  transaction or standalone. */
export async function computeBalanceFor(userId: string, holdDays: number, now: Date = new Date()): Promise<BalanceSnapshot> {
  const cutoff = new Date(now.getTime() - holdDays * 24 * 60 * 60 * 1000);

  const [pendingStatus, approvedWithinHold, approvedMatured, paid] = await Promise.all([
    db.affiliateCommission.aggregate({
      where: { affiliateId: userId, status: 'pending' },
      _sum: { amount: true },
    }),
    db.affiliateCommission.aggregate({
      where: { affiliateId: userId, status: 'approved', payoutId: null, createdAt: { gt: cutoff } },
      _sum: { amount: true },
    }),
    db.affiliateCommission.aggregate({
      where: { affiliateId: userId, status: 'approved', payoutId: null, createdAt: { lte: cutoff } },
      _sum: { amount: true },
    }),
    db.affiliateCommission.aggregate({
      where: { affiliateId: userId, status: 'paid' },
      _sum: { amount: true },
    }),
  ]);

  const pendingTotal = Number(pendingStatus._sum.amount ?? 0) + Number(approvedWithinHold._sum.amount ?? 0);
  const claimableTotal = Number(approvedMatured._sum.amount ?? 0);
  const claimedTotal = Number(paid._sum.amount ?? 0);

  return {
    pendingAmount: pendingTotal,
    claimableAmount: claimableTotal,
    claimedAmount: claimedTotal,
  };
}

/** Upsert ReferralBalance with the current snapshot for the user.
 *  No-op when the user has never had a commission row (cheap pre-check). */
export async function refreshReferralBalance(userId: string, holdDays: number): Promise<BalanceSnapshot> {
  const snap = await computeBalanceFor(userId, holdDays);

  await db.referralBalance.upsert({
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

  return snap;
}

/** Sweep every affiliate with at least one AffiliateCommission row and
 *  refresh their balance. Used by the maturity cron. Returns the count
 *  of users touched and the total amount that newly matured. */
export async function refreshAllBalances(holdDays: number): Promise<{ usersTouched: number; newlyMatured: number }> {
  const distinct = await db.affiliateCommission.groupBy({
    by: ['affiliateId'],
    _count: { affiliateId: true },
  });

  let usersTouched = 0;
  let newlyMatured = 0;

  for (const row of distinct) {
    const userId = row.affiliateId;
    const prior = await db.referralBalance.findUnique({ where: { userId } });
    const priorClaimable = prior ? Number(prior.claimableAmount) : 0;

    const snap = await refreshReferralBalance(userId, holdDays);
    usersTouched += 1;
    const delta = Math.max(0, snap.claimableAmount - priorClaimable);
    newlyMatured += delta;
  }

  return { usersTouched, newlyMatured };
}

/** ISO week label for cadence gating. */
export function isoWeek(d: Date): string {
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNum = date.getUTCDay() === 0 ? 7 : date.getUTCDay();
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNum = Math.ceil(((date.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}

export function monthBucket(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

/** Predicate for cadence-window check at claim time. */
export function isWithinCadenceWindow(cadence: ReferralSettings['cadence'], lastClaimedAt: Date | null, now: Date = new Date()): boolean {
  if (!lastClaimedAt) return true;
  if (cadence === 'auto' || cadence === 'manual') return true;
  if (cadence === 'weekly') return isoWeek(lastClaimedAt) !== isoWeek(now);
  if (cadence === 'monthly') return monthBucket(lastClaimedAt) !== monthBucket(now);
  return true;
}
