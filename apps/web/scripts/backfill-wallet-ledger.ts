// Built by Anointed Coder.
//
// One-shot backfill of WalletLedger from existing Transaction history.
//
// Without this the wallet audit page starts empty and can only answer
// complaints about activity AFTER the ledger shipped - useless for the
// complaint a player raises tomorrow about last week. Every player's
// transactions already exist; what they lack is the running balance either
// side of each movement, which is precisely what makes a gap detectable.
//
// Method: replay each player's transactions in chronological order,
// accumulating a running balance, and write one ledger row per transaction
// with the before/after that replay produces.
//
// The replay is validated per player before anything is written. If the
// replayed total does not land on the player's actual wallet balance, the
// player is SKIPPED and reported rather than backfilled with figures we know
// to be wrong - a plausible-looking but incorrect audit trail is worse than
// an absent one, because it would be trusted in a dispute.
//
// Mismatches are expected for some players and are not necessarily a bug:
// bonus grants that moved the bonus/locked pockets rather than spendable
// balance do not sum into Wallet.balance. Those users are listed so an
// operator can decide, not silently "fixed".
//
// Idempotent: a player who already has ledger rows is skipped entirely, so
// re-running after a partial pass is safe.
//
// Usage (on the server, from the app root):
//   pnpm --filter @pasha9/web exec tsx scripts/backfill-wallet-ledger.ts
//   pnpm --filter @pasha9/web exec tsx scripts/backfill-wallet-ledger.ts --commit
//
// Defaults to a DRY RUN. Nothing is written without --commit.

// Side-effect import: puts DATABASE_URL in place before the client is built.
// Must stay above the PrismaClient import to keep that ordering obvious.
import './load-env';
import { Prisma, PrismaClient } from '@prisma/client';

const db = new PrismaClient();

const COMMIT = process.argv.includes('--commit');
// Money is stored to 2dp; anything smaller is representation noise.
const EPSILON = new Prisma.Decimal('0.005');

// Transaction.type -> ledger type. Deliberately explicit rather than a
// passthrough so a future TxType cannot silently land as an unlabelled row.
function ledgerTypeFor(txType: string, amount: Prisma.Decimal): string {
  switch (txType) {
    case 'deposit': return 'deposit';
    case 'withdraw': return 'withdrawal';
    case 'bet': return 'provider.bet';
    case 'win': return 'provider.win';
    case 'bonus': return 'bonus.grant';
    case 'referral': return 'referral.reward';
    case 'adjust': return amount.isNegative() ? 'admin.debit' : 'admin.credit';
    default: return 'adjust';
  }
}

async function main() {
  console.log(COMMIT ? '=== BACKFILL (writing) ===' : '=== BACKFILL (dry run, nothing written) ===');

  const users = await db.user.findMany({ select: { id: true, username: true } });
  console.log(`users: ${users.length}`);

  let backfilled = 0;
  let skippedExisting = 0;
  let skippedNoTx = 0;
  let rowsWritten = 0;
  const mismatched: Array<{ username: string; replayed: string; actual: string; diff: string }> = [];

  for (const user of users) {
    const existing = await db.walletLedger.count({ where: { userId: user.id } });
    if (existing > 0) { skippedExisting += 1; continue; }

    const txs = await db.transaction.findMany({
      where: { userId: user.id },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      select: { id: true, createdAt: true, type: true, amount: true, description: true, reference: true, meta: true },
    });
    if (txs.length === 0) { skippedNoTx += 1; continue; }

    const wallet = await db.wallet.findUnique({ where: { userId: user.id }, select: { balance: true } });
    const actual = new Prisma.Decimal(wallet?.balance ?? 0);

    // Replay first, validate, then write. Never the other way round.
    let running = new Prisma.Decimal(0);
    const rows: Prisma.WalletLedgerCreateManyInput[] = [];
    for (const t of txs) {
      const amount = new Prisma.Decimal(t.amount);
      const before = running;
      running = running.add(amount);
      rows.push({
        userId: user.id,
        type: ledgerTypeFor(t.type, amount),
        direction: amount.isNegative() ? 'debit' : 'credit',
        amount,
        balanceBefore: before,
        balanceAfter: running,
        status: 'completed',
        transactionId: t.id,
        referenceId: t.reference ?? null,
        description: t.description ?? null,
        createdAt: t.createdAt,
        meta: { backfilled: true, sourceTxType: t.type } as Prisma.InputJsonValue,
      });
    }

    const diff = actual.sub(running);
    if (diff.abs().gt(EPSILON)) {
      mismatched.push({
        username: user.username,
        replayed: running.toFixed(2),
        actual: actual.toFixed(2),
        diff: diff.toFixed(2),
      });
      continue;
    }

    if (COMMIT) {
      await db.walletLedger.createMany({ data: rows });
      rowsWritten += rows.length;
    } else {
      rowsWritten += rows.length;
    }
    backfilled += 1;
  }

  console.log('');
  console.log(`backfilled players : ${backfilled}`);
  console.log(`ledger rows        : ${rowsWritten}${COMMIT ? '' : ' (would write)'}`);
  console.log(`skipped, has ledger: ${skippedExisting}`);
  console.log(`skipped, no history: ${skippedNoTx}`);
  console.log(`skipped, MISMATCH  : ${mismatched.length}`);

  if (mismatched.length > 0) {
    console.log('');
    console.log('Players whose replayed history does not match their wallet.');
    console.log('NOT backfilled - their figures would be wrong. Usually caused by');
    console.log('bonus grants held in the bonus/locked pockets rather than spendable');
    console.log('balance, which never summed into Wallet.balance.');
    console.log('');
    for (const m of mismatched.slice(0, 40)) {
      console.log(`  ${m.username.padEnd(20)} replayed=${m.replayed.padStart(12)}  wallet=${m.actual.padStart(12)}  diff=${m.diff}`);
    }
    if (mismatched.length > 40) console.log(`  ... and ${mismatched.length - 40} more`);
  }

  if (!COMMIT) {
    console.log('');
    console.log('Dry run only. Re-run with --commit to write.');
  }
}

main()
  .catch((err) => { console.error(err); process.exitCode = 1; })
  .finally(async () => { await db.$disconnect(); });
