// Built by Anointed Coder.
//
// GET /api/winners/recent
//
// Public, read-only recent-winners feed for the live winners ticker.
// Returns the most recent real wins, newest first, with a MASKED player
// handle (no phone/email). EVERY individual winning event is its own row:
// a player who won ten times appears ten times, one row per win with that
// win's amount and time. There is no per-player grouping or dedup here.
// Two sources are merged:
//   - WON WingoBet rows (the payout credited to the player) with the
//     WinGo mode and settlement time.
//   - Paid TournamentPayout prizes (leaderboard cash prizes) with the
//     finishing rank.
// This path never moves money and performs only cheap indexed reads with
// a small bounded limit. It never seeds fake entries: an empty database
// returns an empty list. When the recent-winners section is turned off by
// an admin it returns a disabled marker with an empty list.

export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { db } from '@/lib/db/client';
import { jsonOk } from '@/lib/auth/errors';
import { maskHandle } from '@/lib/utils/mask';
import { loadSectionFlags } from '@/lib/content/section-flags';

const LIMIT = 20;

interface WinnerItem {
  id: string;
  handle: string;
  kind: 'wingo' | 'tournament';
  // WinGo round mode (e.g. wingo_30s) for wins, null for tournament prizes.
  mode: string | null;
  // Finishing rank for tournament prizes, null for WinGo wins.
  rank: number | null;
  amount: number;
  // ISO timestamp the win happened / was credited.
  at: string;
}

export async function GET() {
  const flags = await loadSectionFlags();
  if (!flags.recentWinners) {
    return jsonOk({ enabled: false, winners: [] });
  }

  // Pull a little extra from each source before merging so the newest
  // LIMIT rows across both are accurate.
  const [bets, prizes] = await Promise.all([
    db.wingoBet.findMany({
      where: { status: 'WON', payoutAmount: { gt: 0 } },
      orderBy: { settledAt: 'desc' },
      take: LIMIT,
      select: {
        id: true,
        mode: true,
        payoutAmount: true,
        settledAt: true,
        createdAt: true,
        user: { select: { username: true } },
      },
    }),
    db.tournamentPayout.findMany({
      where: { status: 'paid', amount: { gt: 0 } },
      orderBy: { createdAt: 'desc' },
      take: LIMIT,
      select: {
        id: true,
        rank: true,
        amount: true,
        createdAt: true,
        user: { select: { username: true } },
      },
    }),
  ]);

  const items: WinnerItem[] = [];

  for (const b of bets) {
    const at = b.settledAt ?? b.createdAt;
    items.push({
      id: `w_${b.id}`,
      handle: maskHandle(b.user?.username),
      kind: 'wingo',
      mode: b.mode,
      rank: null,
      amount: Number(b.payoutAmount),
      at: at.toISOString(),
    });
  }

  for (const p of prizes) {
    items.push({
      id: `t_${p.id}`,
      handle: maskHandle(p.user?.username),
      kind: 'tournament',
      mode: null,
      rank: p.rank,
      amount: Number(p.amount),
      at: p.createdAt.toISOString(),
    });
  }

  items.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));

  return jsonOk({ enabled: true, winners: items.slice(0, LIMIT) });
}
