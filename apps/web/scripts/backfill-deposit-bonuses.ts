// Built by Anointed Coder.
//
// One-shot backfill that credits the missing bonus on approved
// deposits whose Deposit.bonusAmount was promised at submit time
// but never granted at approve time. Symptom: 1000 BDT deposit
// shows "+500 BDT bonus" on the deposit page, admin approved,
// wallet only gained 1000 BDT, and the diagnostic query at the
// /admin/deposits page shows 0 UserBonus rows tied to the
// deposit id.
//
// Idempotent. The selector matches only deposits that have NO
// matching UserBonus on (sourceId, sourceType in deposit-family).
// Re-running the script after a successful pass finds 0 rows.
//
// Per deposit, in a single db.$transaction:
//   1. Wallet.balance += deposit.bonusAmount
//   2. Transaction { type: 'bonus', amount: +bonusAmount, reference: deposit.id }
//   3. UserBonus { sourceType: 'promotion_deposit', sourceId: deposit.id,
//                  amount: bonusAmount, status: 'completed',
//                  turnoverRequired: 0, turnoverProgress: 0 }
//   4. ActivityLog { action: 'BACKFILL_DEPOSIT_BONUS', target: deposit.id }
//
// turnoverRequired is set to 0 to match the live syncTierToBonusRule
// default. If the operator later turns on per-tier turnover (a new
// DepositBonusTier.turnoverX field) and runs the backfill again, only
// the still-unbackfilled rows are touched; the ones credited here
// already have their UserBonus row and would be skipped by the
// NOT EXISTS guard.
//
// Invoke from the repo root after a deploy:
//
//   cd /var/www/pasha9/app
//   set -a; source .env; set +a
//   pnpm --filter @pasha9/web exec tsx scripts/backfill-deposit-bonuses.ts
//
// Pass --dry-run to list what would change without writing.

import { Prisma, PrismaClient } from '@prisma/client';

const DRY = process.argv.includes('--dry-run');

const db = new PrismaClient();

interface Candidate {
  id: string;
  userId: string;
  amount: Prisma.Decimal;
  bonusAmount: Prisma.Decimal;
  promotionRuleId: string | null;
  promotionCode: string | null;
}

async function loadCandidates(): Promise<Candidate[]> {
  const rows = await db.$queryRaw<Candidate[]>`
    SELECT d.id, d."userId", d.amount, d."bonusAmount", d."promotionRuleId", d."promotionCode"
      FROM "Deposit" d
     WHERE d.status = 'approved'
       AND d."bonusAmount" IS NOT NULL
       AND d."bonusAmount" > 0
       AND NOT EXISTS (
         SELECT 1 FROM "UserBonus" ub
          WHERE ub."sourceId" = d.id
            AND ub."sourceType" IN ('deposit', 'promotion_deposit', 'promotion_claim')
       )
     ORDER BY d."reviewedAt" ASC NULLS LAST
  `;
  return rows;
}

async function backfillOne(c: Candidate): Promise<void> {
  await db.$transaction(async (tx) => {
    const bonus = new Prisma.Decimal(c.bonusAmount);

    const wallet = await tx.wallet.findUnique({ where: { userId: c.userId } });
    if (wallet) {
      await tx.wallet.update({
        where: { userId: c.userId },
        data: { balance: { increment: bonus } },
      });
    } else {
      await tx.wallet.create({
        data: { userId: c.userId, balance: bonus, bonusBalance: 0, lockedBalance: 0 },
      });
    }

    const grant = await tx.userBonus.create({
      data: {
        userId: c.userId,
        bonusRuleId: c.promotionRuleId ?? null,
        amount: bonus,
        status: 'completed',
        turnoverRequired: new Prisma.Decimal(0),
        turnoverProgress: new Prisma.Decimal(0),
        sourceType: 'promotion_deposit',
        sourceId: c.id,
        note: 'Backfill: missed bonus on approved deposit',
        releasedAt: new Date(),
      },
    });

    await tx.transaction.create({
      data: {
        userId: c.userId,
        type: 'bonus',
        status: 'completed',
        amount: bonus,
        reference: grant.id,
        description: `Backfill bonus for deposit ${c.id}`,
        meta: {
          bonusGrantId: grant.id,
          depositId: c.id,
          promotionRuleId: c.promotionRuleId,
          promotionCode: c.promotionCode,
          backfilled: true,
        } as Prisma.JsonObject,
      },
    });

    await tx.activityLog.create({
      data: {
        actorId: 'system',
        actorRole: 'system',
        action: 'BACKFILL_DEPOSIT_BONUS',
        target: c.id,
        detail: `Credited ${bonus.toString()} BDT bonus`,
        meta: {
          userId: c.userId,
          depositId: c.id,
          bonusGrantId: grant.id,
          bonusAmount: Number(bonus),
          promotionRuleId: c.promotionRuleId,
        } as Prisma.JsonObject,
      },
    });
  });
}

async function main(): Promise<void> {
  const candidates = await loadCandidates();
  let totalBdt = new Prisma.Decimal(0);
  for (const c of candidates) {
    totalBdt = totalBdt.add(new Prisma.Decimal(c.bonusAmount));
  }
  console.log(`[backfill-deposit-bonuses] candidates=${candidates.length} totalOwed=${totalBdt.toString()} BDT dryRun=${DRY}`);

  if (candidates.length === 0) {
    console.log('[backfill-deposit-bonuses] nothing to backfill, exiting');
    return;
  }

  if (DRY) {
    for (const c of candidates) {
      console.log(`  would credit user=${c.userId} deposit=${c.id} bonus=${new Prisma.Decimal(c.bonusAmount).toString()}`);
    }
    return;
  }

  let ok = 0;
  let fail = 0;
  for (const c of candidates) {
    try {
      await backfillOne(c);
      ok += 1;
      console.log(`  credited user=${c.userId} deposit=${c.id} bonus=${new Prisma.Decimal(c.bonusAmount).toString()}`);
    } catch (err) {
      fail += 1;
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`  FAILED user=${c.userId} deposit=${c.id} reason=${msg}`);
    }
  }

  console.log(`[backfill-deposit-bonuses] done ok=${ok} fail=${fail}`);
  if (fail > 0) process.exitCode = 1;
}

main()
  .catch((err: unknown) => {
    console.error('[backfill-deposit-bonuses] fatal', err);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
