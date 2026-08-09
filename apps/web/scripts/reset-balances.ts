// Built by Anointed Coder.
//
// Zeroes player balances and records the reset in the wallet ledger, so the
// ledger can be tested from a clean, provable baseline.
//
// WHY THIS IS NOT JUST "SET BALANCE = 0"
//
// Setting the balance to zero and writing one debit row looks right and is
// wrong. Reconciliation asks whether the sum of a player's ledger equals their
// wallet. For the players the backfill SKIPPED (their pre-ledger history could
// not be proven) the ledger is empty, so zeroing them leaves a ledger summing
// to -500 against a wallet of 0. Still broken, just differently.
//
// So each account is squared off in two steps inside one transaction:
//
//   1. opening.balance - RECORDS the money that already existed, without
//      moving it. Closes the gap between what the ledger accounts for and what
//      the wallet actually holds. Skipped when there is no gap.
//   2. opening.reset - MOVES the money, taking balance and both pockets to
//      zero. This one goes through applyWalletMovement like every other
//      movement in the system, so the wallet and the record cannot disagree.
//
// Afterwards every touched account holds 0.00 and its ledger sums to 0.00, so
// --audit reports it as reconciled and every later movement is tracked from a
// known-good starting point.
//
// SAFETY
//
//   - Dry run by default. Nothing is written without --commit.
//   - The dry run lists every account and every figure it would change. Read
//     it before committing; that listing is the real safety gate.
//   - --except=name1,name2 protects specific accounts (an operator float, a
//     real player who should keep their money).
//   - Accounts already at zero across all three pockets are left alone.
//   - The summary prints LAST, so it is readable over a phone terminal where
//     the account list can run to several screens.
//
// Usage (from the app root on the server):
//   pnpm --filter @pasha9/web exec tsx scripts/reset-balances.ts
//   pnpm --filter @pasha9/web exec tsx scripts/reset-balances.ts --except=superadmin
//   pnpm --filter @pasha9/web exec tsx scripts/reset-balances.ts --commit

// Side-effect import: puts DATABASE_URL in place before the client is built.
import './load-env';
import { Prisma, PrismaClient } from '@prisma/client';

const db = new PrismaClient();

const COMMIT = process.argv.includes('--commit');
const EXCEPT = new Set(
  (process.argv.find((a) => a.startsWith('--except='))?.slice('--except='.length) ?? '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean),
);

const ZERO = new Prisma.Decimal(0);

function money(d: Prisma.Decimal): string {
  return d.toFixed(2).padStart(12);
}

async function main() {
  console.log(COMMIT ? '=== RESET BALANCES (writing) ===' : '=== RESET BALANCES (dry run, nothing written) ===');
  if (EXCEPT.size > 0) console.log(`protected accounts: ${[...EXCEPT].join(', ')}`);
  console.log('');

  const { applyWalletMovement, LEDGER_TYPE } = await import('../lib/wallet/ledger');

  const wallets = await db.wallet.findMany({
    select: {
      userId: true,
      balance: true,
      bonusBalance: true,
      lockedBalance: true,
      user: { select: { username: true } },
    },
  });

  let reset = 0;
  let alreadyZero = 0;
  let protectedCount = 0;
  let openingRows = 0;
  const failures: string[] = [];
  let totalCleared = new Prisma.Decimal(0);

  for (const w of wallets) {
    const username = w.user?.username ?? w.userId;
    if (EXCEPT.has(username.toLowerCase())) { protectedCount += 1; continue; }

    const balance = new Prisma.Decimal(w.balance);
    const bonus = new Prisma.Decimal(w.bonusBalance);
    const locked = new Prisma.Decimal(w.lockedBalance);
    if (balance.isZero() && bonus.isZero() && locked.isZero()) { alreadyZero += 1; continue; }

    // What the ledger currently accounts for, and where its chain ended.
    const agg = await db.walletLedger.aggregate({ where: { userId: w.userId }, _sum: { amount: true } });
    const ledgerSum = new Prisma.Decimal(agg._sum.amount ?? 0);
    const last = await db.walletLedger.findFirst({
      where: { userId: w.userId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: { balanceAfter: true },
    });
    const chainEnd = new Prisma.Decimal(last?.balanceAfter ?? 0);
    const gap = balance.sub(chainEnd);

    console.log(
      `  ${username.padEnd(20)} balance=${money(balance)} bonus=${money(bonus)} locked=${money(locked)}` +
      (gap.isZero() ? '' : `  opening=${money(gap)}`),
    );
    totalCleared = totalCleared.add(balance);
    if (!gap.isZero()) openingRows += 1;

    if (!COMMIT) { reset += 1; continue; }

    try {
      await db.$transaction(async (tx) => {
        // 1. Record what was already there. No money moves: balanceAfter is
        //    the balance the wallet ALREADY holds, so the wallet is untouched.
        if (!gap.isZero()) {
          await tx.walletLedger.create({
            data: {
              userId: w.userId,
              type: LEDGER_TYPE.openingBalance,
              direction: gap.isNegative() ? 'debit' : 'credit',
              amount: gap,
              balanceBefore: chainEnd,
              balanceAfter: balance,
              bonusBefore: bonus,
              bonusAfter: bonus,
              lockedBefore: locked,
              lockedAfter: locked,
              status: 'completed',
              description: 'Opening balance recorded at ledger go-live',
              meta: { openingEntry: true, ledgerSumBefore: ledgerSum.toFixed(2) } as Prisma.InputJsonValue,
            },
          });
        }

        // 2. Move the money to zero, on the sanctioned path.
        await applyWalletMovement({
          tx,
          userId: w.userId,
          amount: balance.neg(),
          bonusDelta: bonus.neg(),
          lockedDelta: locked.neg(),
          type: LEDGER_TYPE.openingReset,
          description: 'Balance reset to zero by operator before ledger testing',
          actorRole: 'system',
          meta: {
            resetFrom: balance.toFixed(2),
            bonusCleared: bonus.toFixed(2),
            lockedCleared: locked.toFixed(2),
          } as Prisma.JsonObject,
        });
      });
      reset += 1;
    } catch (e) {
      failures.push(`${username}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  // Summary LAST so it survives a phone-sized scrollback.
  console.log('');
  console.log('--------------------------------------------');
  console.log(`wallets examined   : ${wallets.length}`);
  console.log(`reset to zero      : ${reset}${COMMIT ? '' : ' (would reset)'}`);
  console.log(`opening rows       : ${openingRows}${COMMIT ? '' : ' (would write)'}`);
  console.log(`already zero       : ${alreadyZero}`);
  console.log(`protected          : ${protectedCount}`);
  console.log(`total cleared      : ${totalCleared.toFixed(2)}`);
  console.log(`failures           : ${failures.length}`);
  if (failures.length > 0) {
    console.log('');
    for (const f of failures) console.log(`  FAILED ${f}`);
    process.exitCode = 1;
  }
  if (!COMMIT) {
    console.log('');
    console.log('Dry run only. Check the figures above, then re-run with --commit.');
  } else {
    console.log('');
    console.log('Done. Now run --audit; every reset account should reconcile at 0.00.');
  }
}

main()
  .catch((err) => { console.error(err); process.exitCode = 1; })
  .finally(async () => { await db.$disconnect(); });
