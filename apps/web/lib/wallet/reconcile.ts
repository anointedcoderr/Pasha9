// Built by Anointed Coder.
//
// Wallet reconciliation. Answers one question with evidence: does this
// player's recorded history actually account for the money in their wallet?
//
// Two independent checks, because they fail for different reasons:
//
//   1. CHAIN - each entry stores the balance before and after. Entry N's
//      "after" must equal entry N+1's "before". A break means money moved
//      between two recorded movements, i.e. something changed the balance
//      without going through the wallet service.
//
//   2. TOTAL - the sum of every recorded amount must equal the current
//      wallet balance. This catches the same class of fault from the other
//      direction and also catches a movement recorded with the wrong sign.
//
// Both are cheap reads and never write, so they are safe to run on demand
// from the admin panel or on a schedule.
//
// This is the automated form of the investigation that took a full day by
// hand: for shoyaib1026 the answer was "sum of records == wallet, difference
// 0.00", which proved nothing was missing and settled the complaint.

import { Prisma } from '@prisma/client';
import { db } from '@/lib/db/client';

export interface ChainBreak {
  ledgerId: string;
  at: Date;
  type: string;
  /** What the previous entry said the balance ended at. */
  expectedBefore: string;
  /** What this entry recorded as the balance before it applied. */
  actualBefore: string;
  /** actualBefore - expectedBefore. Non-zero means unexplained movement. */
  gap: string;
}

export interface ReconcileResult {
  userId: string;
  entries: number;
  /** Current spendable balance on the wallet row. */
  walletBalance: string;
  /** Sum of every recorded ledger amount. */
  ledgerTotal: string;
  /** walletBalance - ledgerTotal. Zero means fully accounted for. */
  difference: string;
  /** True when the totals agree AND the chain has no breaks. */
  ok: boolean;
  chainBreaks: ChainBreak[];
  /**
   * Ledger entries only exist from the day the ledger shipped, so a player
   * who was active before that has real history the ledger never saw. Their
   * totals will not match and that is expected, not a fault. Set when the
   * player has transactions predating their first ledger entry.
   */
  predatesLedger: boolean;
}

const ZERO = new Prisma.Decimal(0);
// Money is stored to 2 decimal places, so anything under half a paisa is
// representation noise rather than a real discrepancy.
const EPSILON = new Prisma.Decimal('0.005');

/**
 * Reconcile one player's wallet against their ledger.
 *
 * Reads only. Returns the evidence rather than a bare boolean so the admin
 * UI can show an operator exactly where a chain broke.
 */
export async function reconcileUserWallet(userId: string): Promise<ReconcileResult> {
  const [wallet, entries, earliestTx] = await Promise.all([
    db.wallet.findUnique({ where: { userId }, select: { balance: true } }),
    db.walletLedger.findMany({
      where: { userId },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      select: {
        id: true,
        createdAt: true,
        type: true,
        amount: true,
        balanceBefore: true,
        balanceAfter: true,
      },
    }),
    db.transaction.findFirst({
      where: { userId },
      orderBy: { createdAt: 'asc' },
      select: { createdAt: true },
    }),
  ]);

  const walletBalance = new Prisma.Decimal(wallet?.balance ?? 0);

  let total = ZERO;
  const chainBreaks: ChainBreak[] = [];
  let previousAfter: Prisma.Decimal | null = null;

  for (const e of entries) {
    total = total.add(new Prisma.Decimal(e.amount));

    const before = new Prisma.Decimal(e.balanceBefore);
    if (previousAfter !== null) {
      const gap = before.sub(previousAfter);
      if (gap.abs().gt(EPSILON)) {
        chainBreaks.push({
          ledgerId: e.id,
          at: e.createdAt,
          type: e.type,
          expectedBefore: previousAfter.toFixed(2),
          actualBefore: before.toFixed(2),
          gap: gap.toFixed(2),
        });
      }
    }
    previousAfter = new Prisma.Decimal(e.balanceAfter);
  }

  const difference = walletBalance.sub(total);

  // Only meaningful once the player has ledger coverage for their whole
  // history; otherwise the totals legitimately disagree.
  const predatesLedger = Boolean(
    earliestTx && entries.length > 0 && earliestTx.createdAt < entries[0].createdAt,
  );

  return {
    userId,
    entries: entries.length,
    walletBalance: walletBalance.toFixed(2),
    ledgerTotal: total.toFixed(2),
    difference: difference.toFixed(2),
    ok: difference.abs().lte(EPSILON) && chainBreaks.length === 0,
    chainBreaks,
    predatesLedger,
  };
}

/**
 * Sweep for players whose wallet no longer matches their ledger.
 *
 * Deliberately compares totals only (not the full chain) so it stays a
 * single grouped query rather than one pass per player - this is meant to
 * run over every account. Anything it flags should then be examined with
 * reconcileUserWallet(), which shows where the chain actually broke.
 */
export async function findWalletAnomalies(limit = 50): Promise<Array<{
  userId: string;
  username: string;
  walletBalance: string;
  ledgerTotal: string;
  difference: string;
}>> {
  const grouped = await db.walletLedger.groupBy({
    by: ['userId'],
    _sum: { amount: true },
  });
  if (grouped.length === 0) return [];

  const wallets = await db.wallet.findMany({
    where: { userId: { in: grouped.map((g) => g.userId) } },
    select: { userId: true, balance: true, user: { select: { username: true } } },
  });
  const byUser = new Map(wallets.map((w) => [w.userId, w]));

  const out: Array<{ userId: string; username: string; walletBalance: string; ledgerTotal: string; difference: string }> = [];
  for (const g of grouped) {
    const w = byUser.get(g.userId);
    if (!w) continue;
    const balance = new Prisma.Decimal(w.balance);
    const ledgerTotal = new Prisma.Decimal(g._sum.amount ?? 0);
    const difference = balance.sub(ledgerTotal);
    if (difference.abs().lte(EPSILON)) continue;
    out.push({
      userId: g.userId,
      username: w.user?.username ?? '',
      walletBalance: balance.toFixed(2),
      ledgerTotal: ledgerTotal.toFixed(2),
      difference: difference.toFixed(2),
    });
  }

  out.sort((a, b) => Math.abs(Number(b.difference)) - Math.abs(Number(a.difference)));
  return out.slice(0, limit);
}
