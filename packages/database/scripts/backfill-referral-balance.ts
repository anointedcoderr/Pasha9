// Built by Anointed Coder.
//
// M4 Phase E backfill. For every user who has at least one
// AffiliateCommission row, recompute the ReferralBalance projection
// from the canonical ledger and upsert by userId. Idempotent: running
// it twice produces the same numbers because the projection is a pure
// function of (commissions, holdDays, now).
//
// Run:
//   pnpm --filter @pasha9/database referral:backfill
//
// Env:
//   REFERRAL_HOLD_DAYS overrides the SystemSetting at backfill time.
//                      Default 7 (matches Phase A seed).
//
// Output:
//   per-user before/after totals + a summary line at the end.

import { PrismaClient, Prisma } from '@prisma/client';

const db = new PrismaClient();

function log(msg: string): void {
  // eslint-disable-next-line no-console
  console.log(`[backfill-referral-balance] ${msg}`);
}

interface Snapshot {
  pendingAmount: number;
  claimableAmount: number;
  claimedAmount: number;
}

async function loadHoldDays(): Promise<number> {
  const fromEnv = Number(process.env.REFERRAL_HOLD_DAYS ?? '');
  if (Number.isFinite(fromEnv) && fromEnv >= 0) return fromEnv;
  const row = await db.systemSetting.findUnique({ where: { key: 'referral_hold_days' } });
  const value = Number(row?.value ?? 7);
  return Number.isFinite(value) && value >= 0 ? value : 7;
}

async function compute(userId: string, holdDays: number, now: Date): Promise<Snapshot> {
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
  return {
    pendingAmount: Number(pendingStatus._sum.amount ?? 0) + Number(approvedWithinHold._sum.amount ?? 0),
    claimableAmount: Number(approvedMatured._sum.amount ?? 0),
    claimedAmount: Number(paid._sum.amount ?? 0),
  };
}

async function main(): Promise<void> {
  log('start');
  const holdDays = await loadHoldDays();
  log(`hold days = ${holdDays}`);

  const distinct = await db.affiliateCommission.groupBy({
    by: ['affiliateId'],
    _count: { affiliateId: true },
  });
  log(`affiliates with commissions: ${distinct.length}`);

  const now = new Date();
  let totalPending = 0;
  let totalClaimable = 0;
  let totalClaimed = 0;
  let usersTouched = 0;

  for (const row of distinct) {
    const userId = row.affiliateId;
    const snap = await compute(userId, holdDays, now);
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
    usersTouched += 1;
    totalPending += snap.pendingAmount;
    totalClaimable += snap.claimableAmount;
    totalClaimed += snap.claimedAmount;
    log(`upsert userId=${userId} pending=${snap.pendingAmount.toFixed(2)} claimable=${snap.claimableAmount.toFixed(2)} claimed=${snap.claimedAmount.toFixed(2)}`);
  }

  log('---');
  log(`users touched:   ${usersTouched}`);
  log(`total pending:   ${totalPending.toFixed(2)} BDT`);
  log(`total claimable: ${totalClaimable.toFixed(2)} BDT`);
  log(`total claimed:   ${totalClaimed.toFixed(2)} BDT`);
  log('done');
}

main()
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
