// Built by Anointed Coder.
//
// GET /api/admin/providers/[id]/transactions?status=&type=&limit=
// Filtered list of provider transaction rows + aggregates ready
// for the future reporting pass (total bet, win, loss, GGR).

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { withAuth, ensurePermission } from '@/lib/auth/guard';
import { jsonOk } from '@/lib/auth/errors';
import { db } from '@/lib/db/client';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  return withAuth(async () => {
    await ensurePermission('users.read');
    const url = new URL(req.url);
    const status = url.searchParams.get('status') || undefined;
    const type = url.searchParams.get('type') || undefined;
    const limit = Math.min(Math.max(Number(url.searchParams.get('limit') ?? 100) || 100, 1), 500);

    const where = {
      providerId: params.id,
      ...(status ? { status } : {}),
      ...(type ? { type } : {}),
    };

    const [rows, agg] = await Promise.all([
      db.providerTransaction.findMany({ where, orderBy: { createdAt: 'desc' }, take: limit }),
      db.providerTransaction.aggregate({
        where: { providerId: params.id, status: 'accepted' },
        _sum: { betAmount: true, winAmount: true, netResult: true },
        _count: { _all: true },
      }),
    ]);

    return jsonOk({
      rows: rows.map((r) => ({
        ...r,
        betAmount: Number(r.betAmount),
        winAmount: Number(r.winAmount),
        netResult: Number(r.netResult),
        walletBefore: r.walletBefore == null ? null : Number(r.walletBefore),
        walletAfter: r.walletAfter == null ? null : Number(r.walletAfter),
        repairAmount: r.repairAmount == null ? null : Number(r.repairAmount),
      })),
      totals: {
        rounds: agg._count._all,
        totalBet: Number(agg._sum.betAmount ?? 0),
        totalWin: Number(agg._sum.winAmount ?? 0),
        netResult: Number(agg._sum.netResult ?? 0),
        ggr: Number(agg._sum.betAmount ?? 0) - Number(agg._sum.winAmount ?? 0),
      },
    });
  });
}
