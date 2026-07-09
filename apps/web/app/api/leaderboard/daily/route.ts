// Built by Anointed Coder.
//
// GET /api/leaderboard/daily
//
// Public, read-only 24-hour winnings leaderboard. Aggregates WON WingoBet
// rows settled (or, when unsettled, created) within the last 24 hours,
// GROUP BY userId, SUM(payoutAmount) as total winnings, so each player
// appears EXACTLY ONCE with all of their wins in the window summed.
//
// Ranking is deterministic: total winnings desc, then earliest last-win
// first (so a steady early winner outranks a late spike on a tie), then
// userId. Handles are masked; no phone/email leaks. The board is bounded
// to the top LIMIT rows.
//
// This path never moves money. It performs only cheap indexed reads and
// respects the leaderboard_enabled admin flag: when the section is turned
// off it returns a disabled marker with an empty board.

export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { db } from '@/lib/db/client';
import { jsonOk } from '@/lib/auth/errors';
import { maskHandle } from '@/lib/utils/mask';
import { loadSectionFlags } from '@/lib/content/section-flags';

const LIMIT = 50;
const WINDOW_MS = 24 * 60 * 60 * 1000;

interface LeaderRow {
  rank: number;
  handle: string;
  winnings: number;
  wins: number;
}

export async function GET() {
  const flags = await loadSectionFlags();
  if (!flags.leaderboard) {
    return jsonOk({ enabled: false, rows: [], windowHours: 24 });
  }

  const cutoff = new Date(Date.now() - WINDOW_MS);

  // WON bets in the last 24h. Settlement stamps settledAt, so window on it
  // primarily; fall back to createdAt for any WON row missing settledAt so
  // no genuine recent win is dropped. Grouped by user with the summed
  // payout, the win count, and the latest win time for the tiebreak. The
  // read is best-effort: a transient DB fault yields an empty board.
  async function loadGrouped() {
    try {
      return await db.wingoBet.groupBy({
        by: ['userId'],
        where: {
          status: 'WON',
          payoutAmount: { gt: 0 },
          OR: [{ settledAt: { gte: cutoff } }, { settledAt: null, createdAt: { gte: cutoff } }],
        },
        _sum: { payoutAmount: true },
        _count: { _all: true },
        _max: { settledAt: true, createdAt: true },
      });
    } catch {
      return [];
    }
  }
  const grouped = await loadGrouped();

  const prelim = grouped
    .map((g) => {
      const winnings = Number(g._sum.payoutAmount ?? 0);
      const lastWin = g._max.settledAt ?? g._max.createdAt;
      return { userId: g.userId, winnings, wins: g._count._all, lastWinMs: lastWin ? lastWin.getTime() : 0 };
    })
    .filter((r) => r.winnings > 0);

  // Deterministic ranking: winnings desc, earliest last-win first, userId.
  prelim.sort((a, b) => {
    if (b.winnings !== a.winnings) return b.winnings - a.winnings;
    if (a.lastWinMs !== b.lastWinMs) return a.lastWinMs - b.lastWinMs;
    return a.userId < b.userId ? -1 : a.userId > b.userId ? 1 : 0;
  });

  const top = prelim.slice(0, LIMIT);

  // Resolve display handles for the visible rows in a single query.
  const ids = top.map((r) => r.userId);
  const users = ids.length
    ? await db.user.findMany({ where: { id: { in: ids } }, select: { id: true, username: true } })
    : [];
  const nameById = new Map(users.map((u) => [u.id, u.username]));

  const rows: LeaderRow[] = top.map((r, i) => ({
    rank: i + 1,
    handle: maskHandle(nameById.get(r.userId), `Player ${i + 1}`),
    winnings: r.winnings,
    wins: r.wins,
  }));

  return jsonOk({ enabled: true, rows, windowHours: 24 });
}
