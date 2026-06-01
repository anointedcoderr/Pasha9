// Built by Anointed Coder.
//
// GET /api/admin/providers/[id]/reports?from=&to=&gameUid=&userId=&category=&format=
//
// Provider analytics. Aggregates ProviderTransaction rows into:
//   - summary totals (rounds + bet + win + net + ggr + counts by status)
//   - daily series
//   - top games (joined with ExternalGame for name + category)
//   - top users (joined with User for username)
//   - per-category totals
//
// Default response is JSON. Pass ?format=csv to download the
// daily series as CSV (the format operators paste into a sheet).

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { Prisma } from '@prisma/client';
import { withAuth, ensurePermission } from '@/lib/auth/guard';
import { jsonError, jsonOk } from '@/lib/auth/errors';
import { db } from '@/lib/db/client';

function parseDate(input: string | null): Date | undefined {
  if (!input) return undefined;
  const d = new Date(input);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

function csvField(v: unknown): string {
  if (v == null) return '';
  const s = typeof v === 'string' ? v : String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  return withAuth(async () => {
    await ensurePermission('users.read');

    const provider = await db.gameProvider.findUnique({ where: { id: params.id }, select: { id: true, name: true, providerKey: true } });
    if (!provider) return jsonError(404, 'PROVIDER_NOT_FOUND');

    const url = new URL(req.url);
    const from = parseDate(url.searchParams.get('from'));
    const to = parseDate(url.searchParams.get('to'));
    const gameUid = url.searchParams.get('gameUid') || undefined;
    const userId = url.searchParams.get('userId') || undefined;
    const status = url.searchParams.get('status') || undefined;
    const category = url.searchParams.get('category') || undefined;
    const format = url.searchParams.get('format') || 'json';

    // gameUid resolution by category: pull the matching set of
    // gameUids for this provider once, then filter ProviderTransaction
    // by them.
    let gameUidWhere: Prisma.StringFilter | undefined;
    if (category) {
      const games = await db.externalGame.findMany({
        where: { providerId: provider.id, category },
        select: { gameUid: true },
      });
      const ids = games.map((g) => g.gameUid);
      if (ids.length === 0) {
        // nothing in this category; short-circuit empty report
        return jsonOk({
          provider: { id: provider.id, name: provider.name, providerKey: provider.providerKey },
          range: { from: from?.toISOString() ?? null, to: to?.toISOString() ?? null },
          totals: { rounds: 0, totalBet: 0, totalWin: 0, netResult: 0, ggr: 0 },
          byStatus: {}, daily: [], topGames: [], topUsers: [], byCategory: {},
        });
      }
      gameUidWhere = { in: ids };
    } else if (gameUid) {
      gameUidWhere = { equals: gameUid };
    }

    const where: Prisma.ProviderTransactionWhereInput = {
      providerId: provider.id,
      ...(from || to ? { createdAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {}),
      ...(gameUidWhere ? { gameUid: gameUidWhere } : {}),
      ...(userId ? { userId } : {}),
      ...(status ? { status } : {}),
    };

    // Accepted-only filter for revenue totals; status counts use the
    // unfiltered (only date+game/user filtered) where set.
    const acceptedWhere: Prisma.ProviderTransactionWhereInput = { ...where, status: 'accepted' };

    const [agg, byStatusRaw, gameRowsRaw, userRowsRaw, dailyRowsRaw] = await Promise.all([
      db.providerTransaction.aggregate({
        where: acceptedWhere,
        _sum: { betAmount: true, winAmount: true, netResult: true },
        _count: { _all: true },
      }),
      db.providerTransaction.groupBy({
        by: ['status'],
        where,
        _count: { _all: true },
      }),
      db.providerTransaction.groupBy({
        by: ['gameUid'],
        where: acceptedWhere,
        _sum: { betAmount: true, winAmount: true, netResult: true },
        _count: { _all: true },
        orderBy: { _sum: { betAmount: 'desc' } },
        take: 25,
      }),
      db.providerTransaction.groupBy({
        by: ['userId'],
        where: { ...acceptedWhere, userId: { not: null } },
        _sum: { betAmount: true, winAmount: true, netResult: true },
        _count: { _all: true },
        orderBy: { _sum: { betAmount: 'desc' } },
        take: 25,
      }),
      // Daily series. We aggregate in SQL using date_trunc for
      // server-side speed; Prisma raw lets us go straight to the index.
      db.$queryRaw<Array<{ day: Date; rounds: bigint; bet: Prisma.Decimal; win: Prisma.Decimal; net: Prisma.Decimal }>>`
        SELECT date_trunc('day', "createdAt") AS day,
               COUNT(*) AS rounds,
               COALESCE(SUM("betAmount"), 0) AS bet,
               COALESCE(SUM("winAmount"), 0) AS win,
               COALESCE(SUM("netResult"), 0) AS net
        FROM "ProviderTransaction"
        WHERE "providerId" = ${provider.id}
          AND "status" = 'accepted'
          ${from ? Prisma.sql`AND "createdAt" >= ${from}` : Prisma.empty}
          ${to ? Prisma.sql`AND "createdAt" <= ${to}` : Prisma.empty}
          ${userId ? Prisma.sql`AND "userId" = ${userId}` : Prisma.empty}
          ${gameUid && !category ? Prisma.sql`AND "gameUid" = ${gameUid}` : Prisma.empty}
        GROUP BY day
        ORDER BY day ASC
        LIMIT 366
      `,
    ]);

    // Resolve game + user labels for the top tables.
    const gameUids = gameRowsRaw.map((r) => r.gameUid).filter((u): u is string => !!u);
    const userIds = userRowsRaw.map((r) => r.userId).filter((u): u is string => !!u);
    const [gameLookup, userLookup] = await Promise.all([
      gameUids.length > 0
        ? db.externalGame.findMany({
          where: { providerId: provider.id, gameUid: { in: gameUids } },
          select: { gameUid: true, displayName: true, category: true },
        })
        : Promise.resolve([] as Array<{ gameUid: string; displayName: string; category: string | null }>),
      userIds.length > 0
        ? db.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, username: true },
        })
        : Promise.resolve([] as Array<{ id: string; username: string }>),
    ]);
    const gameMap = new Map(gameLookup.map((g) => [g.gameUid, g]));
    const userMap = new Map(userLookup.map((u) => [u.id, u]));

    const topGames = gameRowsRaw.map((r) => {
      const meta = r.gameUid ? gameMap.get(r.gameUid) : undefined;
      const bet = Number(r._sum.betAmount ?? 0);
      const win = Number(r._sum.winAmount ?? 0);
      return {
        gameUid: r.gameUid ?? '-',
        displayName: meta?.displayName ?? '(unknown)',
        category: meta?.category ?? null,
        rounds: r._count._all,
        totalBet: bet,
        totalWin: win,
        netResult: Number(r._sum.netResult ?? 0),
        ggr: bet - win,
      };
    });

    const topUsers = userRowsRaw.map((r) => {
      const u = r.userId ? userMap.get(r.userId) : undefined;
      const bet = Number(r._sum.betAmount ?? 0);
      const win = Number(r._sum.winAmount ?? 0);
      return {
        userId: r.userId ?? '-',
        username: u?.username ?? '(unknown)',
        rounds: r._count._all,
        totalBet: bet,
        totalWin: win,
        netResult: Number(r._sum.netResult ?? 0),
        ggr: bet - win,
      };
    });

    const byStatus: Record<string, number> = {};
    for (const r of byStatusRaw) byStatus[r.status] = r._count._all;

    const byCategory: Record<string, { rounds: number; totalBet: number; totalWin: number; ggr: number }> = {};
    for (const g of topGames) {
      const key = g.category ?? 'uncategorized';
      const cur = byCategory[key] ?? { rounds: 0, totalBet: 0, totalWin: 0, ggr: 0 };
      cur.rounds += g.rounds;
      cur.totalBet += g.totalBet;
      cur.totalWin += g.totalWin;
      cur.ggr += g.ggr;
      byCategory[key] = cur;
    }

    const daily = dailyRowsRaw.map((d) => ({
      day: d.day.toISOString().slice(0, 10),
      rounds: Number(d.rounds),
      totalBet: Number(d.bet),
      totalWin: Number(d.win),
      netResult: Number(d.net),
      ggr: Number(d.bet) - Number(d.win),
    }));

    const totals = {
      rounds: agg._count._all,
      totalBet: Number(agg._sum.betAmount ?? 0),
      totalWin: Number(agg._sum.winAmount ?? 0),
      netResult: Number(agg._sum.netResult ?? 0),
      ggr: Number(agg._sum.betAmount ?? 0) - Number(agg._sum.winAmount ?? 0),
    };

    if (format === 'csv') {
      // Concatenated CSV: a small summary header, then the daily
      // series, then the top games, then the top users. Operators
      // can split if they want; one file makes pasting into a
      // spreadsheet trivial.
      const lines: string[] = [];
      lines.push(`# Provider report,${csvField(provider.name)}`);
      lines.push(`# Generated,${new Date().toISOString()}`);
      if (from) lines.push(`# From,${from.toISOString()}`);
      if (to) lines.push(`# To,${to.toISOString()}`);
      lines.push('');
      lines.push('# Totals (accepted only)');
      lines.push('rounds,totalBet,totalWin,netResult,ggr');
      lines.push([totals.rounds, totals.totalBet, totals.totalWin, totals.netResult, totals.ggr].map(csvField).join(','));
      lines.push('');
      lines.push('# Daily');
      lines.push('day,rounds,totalBet,totalWin,netResult,ggr');
      for (const d of daily) lines.push([d.day, d.rounds, d.totalBet, d.totalWin, d.netResult, d.ggr].map(csvField).join(','));
      lines.push('');
      lines.push('# Top games (top 25 by bet)');
      lines.push('gameUid,displayName,category,rounds,totalBet,totalWin,netResult,ggr');
      for (const g of topGames) lines.push([g.gameUid, g.displayName, g.category ?? '', g.rounds, g.totalBet, g.totalWin, g.netResult, g.ggr].map(csvField).join(','));
      lines.push('');
      lines.push('# Top users (top 25 by bet)');
      lines.push('userId,username,rounds,totalBet,totalWin,netResult,ggr');
      for (const u of topUsers) lines.push([u.userId, u.username, u.rounds, u.totalBet, u.totalWin, u.netResult, u.ggr].map(csvField).join(','));

      const csv = lines.join('\n');
      return new Response(csv, {
        status: 200,
        headers: {
          'content-type': 'text/csv; charset=utf-8',
          'content-disposition': `attachment; filename="provider-${provider.providerKey ?? provider.id}-report.csv"`,
        },
      });
    }

    return jsonOk({
      provider: { id: provider.id, name: provider.name, providerKey: provider.providerKey },
      range: { from: from?.toISOString() ?? null, to: to?.toISOString() ?? null },
      totals,
      byStatus,
      daily,
      topGames,
      topUsers,
      byCategory,
    });
  });
}
