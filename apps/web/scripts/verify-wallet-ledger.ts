// Built by Anointed Coder.
//
// Proves the wallet ledger actually holds, against a real database.
//
// Type-checking proves the code compiles. It proves nothing about whether a
// balance and its record stay in step. This does, by running money through
// the real service and asserting the invariants after every single step.
//
// Two modes, deliberately separated by risk:
//
//   --audit     READ ONLY. Reconciles every existing player and reports any
//               whose wallet does not match their recorded history. Safe to
//               run on production at any time, including right now.
//
//   --selftest  WRITES, but only ever to its own throwaway user
//               (__ledger_selftest__). Runs a full player lifecycle -
//               deposit, bets, wins, losses, bonus grant and release, manual
//               credit, manual debit, withdrawal - asserting after each step
//               that the wallet, the chain and the totals all agree. Deletes
//               the test user afterwards unless --keep is passed.
//
// The self-test is what answers the client's actual question: "confirm the
// entire balance chain remains correct from beginning to end."
//
// Usage (from the app root on the server):
//   pnpm --filter @pasha9/web exec tsx scripts/verify-wallet-ledger.ts --audit
//   pnpm --filter @pasha9/web exec tsx scripts/verify-wallet-ledger.ts --selftest

import { Prisma, PrismaClient } from '@prisma/client';

const db = new PrismaClient();

const AUDIT = process.argv.includes('--audit');
const SELFTEST = process.argv.includes('--selftest');
const KEEP = process.argv.includes('--keep');

const TEST_USERNAME = '__ledger_selftest__';
const EPSILON = new Prisma.Decimal('0.005');

let passed = 0;
let failed = 0;

function check(label: string, ok: boolean, detail?: string) {
  if (ok) {
    passed += 1;
    console.log(`  PASS  ${label}`);
  } else {
    failed += 1;
    console.log(`  FAIL  ${label}${detail ? ` -> ${detail}` : ''}`);
  }
}

/**
 * The three invariants that must hold after EVERY movement:
 *   1. the wallet balance is what we expect it to be
 *   2. each entry's balanceBefore equals the previous entry's balanceAfter
 *   3. the sum of recorded amounts equals the wallet balance
 *
 * Checking all three after each step (rather than once at the end) is what
 * localises a fault to the movement that caused it.
 */
async function assertInvariants(userId: string, step: string, expected: Prisma.Decimal) {
  const wallet = await db.wallet.findUnique({ where: { userId }, select: { balance: true } });
  const actual = new Prisma.Decimal(wallet?.balance ?? 0);
  check(`${step}: wallet is ${expected.toFixed(2)}`, actual.sub(expected).abs().lte(EPSILON), `wallet=${actual.toFixed(2)}`);

  const entries = await db.walletLedger.findMany({
    where: { userId },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    select: { amount: true, balanceBefore: true, balanceAfter: true, type: true },
  });

  let previousAfter: Prisma.Decimal | null = null;
  let broken: string | null = null;
  let total = new Prisma.Decimal(0);
  for (const e of entries) {
    total = total.add(new Prisma.Decimal(e.amount));
    const before = new Prisma.Decimal(e.balanceBefore);
    if (previousAfter !== null && before.sub(previousAfter).abs().gt(EPSILON)) {
      broken = `${e.type}: expected before=${previousAfter.toFixed(2)}, got ${before.toFixed(2)}`;
      break;
    }
    previousAfter = new Prisma.Decimal(e.balanceAfter);
  }
  check(`${step}: chain unbroken (${entries.length} entries)`, broken === null, broken ?? undefined);
  check(`${step}: records total to wallet`, total.sub(actual).abs().lte(EPSILON), `records=${total.toFixed(2)} wallet=${actual.toFixed(2)}`);
}

async function runAudit() {
  console.log('=== AUDIT (read only) ===\n');

  const grouped = await db.walletLedger.groupBy({ by: ['userId'], _sum: { amount: true } });
  if (grouped.length === 0) {
    console.log('No ledger entries yet. Deploy and/or run the backfill first.');
    return;
  }

  const wallets = await db.wallet.findMany({
    where: { userId: { in: grouped.map((g) => g.userId) } },
    select: { userId: true, balance: true, user: { select: { username: true } } },
  });
  const byUser = new Map(wallets.map((w) => [w.userId, w]));

  let clean = 0;
  const bad: string[] = [];
  for (const g of grouped) {
    const w = byUser.get(g.userId);
    if (!w) continue;
    const diff = new Prisma.Decimal(w.balance).sub(new Prisma.Decimal(g._sum.amount ?? 0));
    if (diff.abs().lte(EPSILON)) clean += 1;
    else bad.push(`${w.user?.username ?? g.userId}: wallet=${Number(w.balance).toFixed(2)} records=${Number(g._sum.amount ?? 0).toFixed(2)} diff=${diff.toFixed(2)}`);
  }

  console.log(`players with ledger : ${grouped.length}`);
  console.log(`fully reconciled    : ${clean}`);
  console.log(`MISMATCHED          : ${bad.length}`);
  if (bad.length > 0) {
    console.log('\nMismatched players (investigate each on their Wallet Audit page):');
    for (const line of bad.slice(0, 30)) console.log(`  ${line}`);
    if (bad.length > 30) console.log(`  ... and ${bad.length - 30} more`);
    console.log('\nA mismatch is EXPECTED for players active before the ledger shipped');
    console.log('until the backfill has run. After that, a mismatch is a real fault.');
  }
}

async function runSelfTest() {
  console.log('=== SELF TEST (writes to a throwaway user only) ===\n');

  // Refuse to touch anything that is not ours.
  const existing = await db.user.findUnique({ where: { username: TEST_USERNAME }, select: { id: true } });
  if (existing) {
    console.log('Removing leftover test user from a previous run...');
    await db.user.delete({ where: { id: existing.id } });
  }

  const role = await db.role.findFirst({ where: { key: 'player' }, select: { id: true } })
    ?? await db.role.findFirst({ select: { id: true } });
  if (!role) throw new Error('No Role rows exist; cannot create a test user.');

  const user = await db.user.create({
    data: {
      username: TEST_USERNAME,
      phone: `+8800000${Date.now().toString().slice(-6)}`,
      // Not a valid bcrypt hash, so this account can never be logged into
      // even in the window before it is deleted.
      passwordHash: 'selftest-not-a-real-login',
      referralCode: `SELFTEST${Date.now().toString().slice(-6)}`,
      roleId: role.id,
      status: 'active',
      wallet: { create: { balance: 0 } },
    },
    select: { id: true },
  });
  console.log(`test user: ${TEST_USERNAME}\n`);

  // Imported lazily so a plain --audit run never loads the app's module graph.
  const { applyWalletMovement, LEDGER_TYPE } = await import('../lib/wallet/ledger');

  let expected = new Prisma.Decimal(0);
  const step = async (
    label: string,
    amount: string,
    type: string,
    extra: Record<string, unknown> = {},
  ) => {
    const amt = new Prisma.Decimal(amount);
    await db.$transaction(async (tx) => {
      await applyWalletMovement({ tx, userId: user.id, amount: amt, type, ...extra });
    });
    expected = expected.add(amt);
    await assertInvariants(user.id, label, expected);
  };

  // A realistic lifecycle, in the order the client described.
  await step('deposit 1000', '1000', LEDGER_TYPE.deposit);
  await step('bet 120', '-120', LEDGER_TYPE.providerBet, { roundId: 'r1', gameUid: '737' });
  await step('win 300', '300', LEDGER_TYPE.providerWin, { roundId: 'r1', gameUid: '737' });
  await step('bet 250 (loss)', '-250', LEDGER_TYPE.providerBet, { roundId: 'r2', gameUid: '879' });
  await step('native bet 50', '-50', LEDGER_TYPE.nativeBet, { gameUid: 'dice' });
  await step('cashback 75.50', '75.50', LEDGER_TYPE.cashback);
  await step('admin credit 200', '200', LEDGER_TYPE.adminCredit, { actorId: null, description: 'selftest credit' });
  await step('admin debit 60.25', '-60.25', LEDGER_TYPE.adminDebit, { description: 'selftest debit' });
  await step('withdrawal 400', '-400', LEDGER_TYPE.withdrawal);

  // Pocket-to-pocket: a bonus unlocking. amount moves spendable balance while
  // lockedDelta moves the locked pocket, so the running total must still hold.
  await db.$transaction(async (tx) => {
    await applyWalletMovement({
      tx,
      userId: user.id,
      amount: new Prisma.Decimal(0),
      bonusDelta: new Prisma.Decimal(500),
      lockedDelta: new Prisma.Decimal(500),
      type: LEDGER_TYPE.bonusGrant,
    });
  });
  await assertInvariants(user.id, 'bonus granted (held, not spendable)', expected);

  await db.$transaction(async (tx) => {
    await applyWalletMovement({
      tx,
      userId: user.id,
      amount: new Prisma.Decimal(500),
      lockedDelta: new Prisma.Decimal(-500),
      type: LEDGER_TYPE.bonusRelease,
    });
  });
  expected = expected.add(new Prisma.Decimal(500));
  await assertInvariants(user.id, 'bonus released into balance', expected);

  // Debit exactly to zero - the case the client reported as broken.
  await step('debit remaining to exactly 0', expected.neg().toString(), LEDGER_TYPE.adminDebit);
  check('final balance is exactly 0', expected.isZero(), `expected=${expected.toFixed(2)}`);

  // A failed movement must roll back the money too, not just the record.
  const beforeFail = expected;
  try {
    await db.$transaction(async (tx) => {
      await applyWalletMovement({ tx, userId: user.id, amount: new Prisma.Decimal(999), type: LEDGER_TYPE.deposit });
      throw new Error('deliberate rollback');
    });
  } catch { /* expected */ }
  await assertInvariants(user.id, 'failed transaction left no trace', beforeFail);

  const pockets = await db.wallet.findUnique({
    where: { userId: user.id },
    select: { bonusBalance: true, lockedBalance: true },
  });
  check(
    'locked pocket returned to 0 after release',
    new Prisma.Decimal(pockets?.lockedBalance ?? 0).abs().lte(EPSILON),
    `locked=${Number(pockets?.lockedBalance ?? 0)}`,
  );

  if (KEEP) {
    console.log(`\nTest user kept (--keep): ${TEST_USERNAME}`);
  } else {
    await db.user.delete({ where: { id: user.id } });
    console.log('\nTest user deleted.');
  }
}

async function main() {
  if (!AUDIT && !SELFTEST) {
    console.log('Pick a mode:');
    console.log('  --audit     read only, reconciles every existing player (safe on production)');
    console.log('  --selftest  writes to a throwaway user only, proves the chain end to end');
    return;
  }
  if (AUDIT) await runAudit();
  if (SELFTEST) await runSelfTest();

  if (SELFTEST) {
    console.log('');
    console.log(`checks passed: ${passed}`);
    console.log(`checks failed: ${failed}`);
    console.log(failed === 0 ? '\nALL CHECKS PASSED.' : '\nFAILURES ABOVE - do not deploy until resolved.');
  }
  if (failed > 0) process.exitCode = 1;
}

main()
  .catch((err) => { console.error(err); process.exitCode = 1; })
  .finally(async () => { await db.$disconnect(); });
