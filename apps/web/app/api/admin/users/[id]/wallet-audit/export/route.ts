// Built by Anointed Coder.
//
// GET /api/admin/users/[id]/wallet-audit/export  ->  text/csv
//
// Downloads a player's wallet history as evidence. The client's stated use
// is a dispute with a player or with the aggregator, so this exports the
// FULL history by default rather than the 7-day view the screen shows -
// exporting a truncated window and calling it the record would be worse
// than not exporting at all.
//
// Accepts the same date filters as the audit endpoint so a specific window
// can still be pulled deliberately (from / to).
//
// Streams straight from the database in ascending date order, so the file
// reads as a running statement top to bottom and reconciles by eye.

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { Prisma } from '@prisma/client';
import { db } from '@/lib/db/client';
import { withAuth, ensurePermission, recordActivity } from '@/lib/auth/guard';
import { jsonError } from '@/lib/auth/errors';

// Hard ceiling so one export cannot exhaust memory on the server. Well above
// any realistic single-player history; if it is ever hit the operator gets a
// visible warning row rather than a silently truncated file.
const MAX_ROWS = 100_000;

function csvCell(v: unknown): string {
  if (v === null || v === undefined) return '';
  const s = String(v);
  // Quote when the value could break the column layout. Doubling the quote
  // is the CSV escape; a bare quote would corrupt every later column.
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function parseDate(v: string | null): Date | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  return withAuth(async () => {
    const session = await ensurePermission('users.read');

    const user = await db.user.findUnique({
      where: { id: params.id },
      select: { id: true, username: true },
    });
    if (!user) return jsonError(404, 'NOT_FOUND', 'User not found.');

    const q = req.nextUrl.searchParams;
    const from = parseDate(q.get('from'));
    const to = parseDate(q.get('to'));

    const where: Prisma.WalletLedgerWhereInput = {
      userId: user.id,
      ...(from || to
        ? { createdAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } }
        : {}),
    };

    const rows = await db.walletLedger.findMany({
      where,
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: MAX_ROWS,
      include: { actor: { select: { username: true } } },
    });

    const header = [
      'Date/Time', 'Type', 'Direction', 'Amount', 'Balance Before', 'Balance After',
      'Status', 'Provider', 'Game', 'Game UID', 'Round ID', 'Bet ID',
      'Reference', 'Transaction ID', 'Bonus Source', 'Description',
      'Performed By', 'Role', 'Reverses',
    ];

    const lines = [header.join(',')];
    for (const r of rows) {
      lines.push([
        r.createdAt.toISOString(),
        r.type,
        r.direction,
        Number(r.amount).toFixed(2),
        Number(r.balanceBefore).toFixed(2),
        Number(r.balanceAfter).toFixed(2),
        r.status,
        r.providerName,
        r.gameName,
        r.gameUid,
        r.roundId,
        r.betId,
        r.referenceId,
        r.transactionId,
        r.bonusSource,
        r.description,
        r.actor?.username ?? '',
        r.actorRole,
        r.reversesId,
      ].map(csvCell).join(','));
    }

    if (rows.length >= MAX_ROWS) {
      lines.push('');
      lines.push(csvCell(`TRUNCATED: export capped at ${MAX_ROWS} rows. Narrow the date range to get the rest.`));
    }

    // Exporting a player's full financial record is itself worth recording.
    await recordActivity({
      actorId: session.sub,
      actorRole: session.role,
      action: 'WALLET_AUDIT_EXPORT',
      target: user.id,
      detail: `${user.username} (${rows.length} rows)`,
      meta: { rows: rows.length, from: from?.toISOString() ?? null, to: to?.toISOString() ?? null },
    });

    const stamp = new Date().toISOString().slice(0, 10);
    return new Response(lines.join('\r\n'), {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="wallet-audit-${user.username}-${stamp}.csv"`,
        'Cache-Control': 'no-store',
      },
    });
  });
}
