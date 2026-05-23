// Built by Anointed Coder.

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { db } from '@/lib/db/client';
import { requireUser } from '@/lib/auth/rbac';
import { withAuth } from '@/lib/auth/guard';
import { jsonOk } from '@/lib/auth/errors';

export async function GET(req: NextRequest) {
  return withAuth(async () => {
    const session = await requireUser();
    const take = Math.min(50, Number(req.nextUrl.searchParams.get('take') ?? 20));
    const levelParam = req.nextUrl.searchParams.get('level');
    const level = levelParam === '2' ? 2 : levelParam === '3' ? 3 : 1;

    let parentIds: string[] = [session.sub];
    if (level >= 2) {
      const lvl1 = await db.user.findMany({ where: { referredById: session.sub }, select: { id: true } });
      parentIds = lvl1.map((u) => u.id);
    }
    if (level === 3) {
      if (parentIds.length === 0) return jsonOk({ rows: [], level });
      const lvl2 = await db.user.findMany({ where: { referredById: { in: parentIds } }, select: { id: true } });
      parentIds = lvl2.map((u) => u.id);
    }

    if (parentIds.length === 0) return jsonOk({ rows: [], level });

    const rows = await db.user.findMany({
      where: { referredById: { in: parentIds } },
      orderBy: { createdAt: 'desc' },
      take,
      select: {
        id: true,
        username: true,
        phone: true,
        createdAt: true,
        status: true,
        wallet: { select: { balance: true } },
        _count: { select: { transactions: true } },
      },
    });

    return jsonOk({
      rows: rows.map((r) => ({
        id: r.id,
        username: r.username,
        // mask phone for privacy in the downline view
        phone: r.phone.length > 4 ? `${r.phone.slice(0, 3)}*****${r.phone.slice(-2)}` : r.phone,
        joinedAt: r.createdAt,
        status: r.status,
        balance: Number(r.wallet?.balance ?? 0),
        txCount: r._count.transactions,
      })),
      level,
    });
  });
}
