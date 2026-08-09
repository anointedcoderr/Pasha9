// Built by Anointed Coder.
//
// GET /api/me/wallet-history?days=7|15|30
//
// The player's own audit view, read from the SAME permanent WalletLedger the
// admin audit reads. Not from the Transaction table and not from a second
// derived store, so a player and an operator looking at the same event always
// see identical figures. That was the client's explicit requirement.
//
// Every row carries the balance either side of the movement, which is what
// answers "why did my balance change" without anyone having to ask support.
//
// Scope is deliberately narrow: the signed-in user only, no actor names, no
// internal notes. Who among the staff performed an action is operator
// information and stays on the admin side. Players get the what, when and how
// much of their own money.

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { db } from '@/lib/db/client';
import { withAuth } from '@/lib/auth/guard';
import { requireActiveUser } from '@/lib/auth/rbac';
import { jsonOk } from '@/lib/auth/errors';

// The windows the client asked for. Anything else falls back to 30 rather
// than letting a querystring request the entire history in one response.
const ALLOWED_DAYS = new Set([7, 15, 30]);
const MAX_ROWS = 300;

export async function GET(req: NextRequest) {
  return withAuth(async () => {
    const session = await requireActiveUser();

    const raw = Number(req.nextUrl.searchParams.get('days'));
    const days = ALLOWED_DAYS.has(raw) ? raw : 30;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const rows = await db.walletLedger.findMany({
      where: { userId: session.sub, createdAt: { gte: since } },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: MAX_ROWS,
      select: {
        id: true,
        type: true,
        direction: true,
        amount: true,
        balanceBefore: true,
        balanceAfter: true,
        status: true,
        description: true,
        gameName: true,
        providerTransactionId: true,
        referenceId: true,
        createdAt: true,
      },
    });

    return jsonOk({
      days,
      rows: rows.map((r) => ({
        id: r.id,
        type: r.type,
        direction: r.direction,
        amount: r.amount.toString(),
        balanceBefore: r.balanceBefore.toString(),
        balanceAfter: r.balanceAfter.toString(),
        status: r.status,
        description: r.description,
        // One reference for the player to quote to support, whichever the
        // source happened to supply.
        reference: r.providerTransactionId ?? r.referenceId ?? null,
        game: r.gameName,
        createdAt: r.createdAt,
      })),
    });
  });
}
