// Built by Anointed Coder.
//
// GET /api/me/transactions?type=&take=&cursor=
//
// User-facing wallet ledger. Reads the canonical Transaction table
// for the signed-in user. Every wallet-moving event in the platform
// (deposit approval, bonus grant, provider bet, provider win,
// withdrawal credit, lotto credit, adjust) already writes to this
// table, so a single Prisma query is all that's needed.
//
// Pending withdrawal requests are surfaced as synthetic rows on top
// of the ledger so the player sees them in-flight even before the
// admin moves money. They carry status='pending' and never duplicate
// the eventual completed Transaction row written when the
// withdrawal is approved.
//
// Returns max 200 rows per call. The dashboard page renders them
// newest first with a type filter.

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { db } from '@/lib/db/client';
import { withAuth } from '@/lib/auth/guard';
import { requireActiveUser } from '@/lib/auth/rbac';
import { jsonOk } from '@/lib/auth/errors';

const ALLOWED_TYPES = new Set(['deposit', 'withdraw', 'bonus', 'referral', 'bet', 'win', 'adjust']);

export async function GET(req: NextRequest) {
  return withAuth(async () => {
    const session = await requireActiveUser();
    const url = new URL(req.url);
    const typeParam = url.searchParams.get('type');
    const take = Math.min(200, Math.max(1, Number(url.searchParams.get('take') ?? 100) || 100));

    const type = typeParam && ALLOWED_TYPES.has(typeParam) ? typeParam : null;

    const ledger = await db.transaction.findMany({
      where: {
        userId: session.sub,
        ...(type ? { type: type as 'deposit' | 'withdraw' | 'bonus' | 'referral' | 'bet' | 'win' | 'adjust' } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take,
    });

    const transactions = ledger.map((t) => ({
      id: t.id,
      type: t.type,
      amount: Number(t.amount),
      status: t.status,
      reference: t.reference,
      description: t.description,
      createdAt: t.createdAt,
      meta: t.meta,
      source: 'transaction' as const,
    }));

    // Surface pending withdrawal requests as synthetic ledger rows
    // (since money has not moved yet) unless filtering by another type.
    let pendingWithdrawals: typeof transactions = [];
    if (!type || type === 'withdraw') {
      const wd = await db.withdrawal.findMany({
        where: { userId: session.sub, status: 'pending' },
        orderBy: { createdAt: 'desc' },
        take: 20,
      });
      pendingWithdrawals = wd.map((w) => ({
        id: `pending-wd-${w.id}`,
        type: 'withdraw' as const,
        amount: -Number(w.amount),
        status: 'pending' as const,
        reference: w.id,
        description: `Withdrawal request ${w.method}`,
        createdAt: w.createdAt,
        meta: null,
        source: 'transaction' as const,
      }));
    }

    // Surface rejected withdrawals so the player sees the closure
    // event with the rejection reason (no money moved, so no real
    // Transaction row exists yet).
    let rejectedWithdrawals: typeof transactions = [];
    if (!type || type === 'withdraw') {
      const wdRej = await db.withdrawal.findMany({
        where: { userId: session.sub, status: 'rejected' },
        orderBy: { createdAt: 'desc' },
        take: 20,
      });
      rejectedWithdrawals = wdRej.map((w) => ({
        id: `rejected-wd-${w.id}`,
        type: 'withdraw' as const,
        amount: -Number(w.amount),
        status: 'failed' as const,
        reference: w.id,
        description: `Withdrawal rejected ${w.adminNote ? `. Reason: ${w.adminNote}` : ''}`.trim(),
        createdAt: w.reviewedAt ?? w.createdAt,
        meta: null,
        source: 'transaction' as const,
      }));
    }

    // Surface rejected deposits the same way so the player sees the
    // reason on their history.
    let rejectedDeposits: typeof transactions = [];
    if (!type || type === 'deposit') {
      const depRej = await db.deposit.findMany({
        where: { userId: session.sub, status: 'rejected' },
        orderBy: { createdAt: 'desc' },
        take: 20,
      });
      rejectedDeposits = depRej.map((d) => ({
        id: `rejected-dep-${d.id}`,
        type: 'deposit' as const,
        amount: 0,
        status: 'failed' as const,
        reference: d.transactionId,
        description: `Deposit rejected ${d.rejectionReason ? `. Reason: ${d.rejectionReason}` : ''}`.trim(),
        createdAt: d.reviewedAt ?? d.createdAt,
        meta: null,
        source: 'transaction' as const,
      }));
    }

    const merged = [...transactions, ...pendingWithdrawals, ...rejectedWithdrawals, ...rejectedDeposits]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, take);

    return jsonOk({
      transactions: merged,
      total: merged.length,
    });
  });
}
