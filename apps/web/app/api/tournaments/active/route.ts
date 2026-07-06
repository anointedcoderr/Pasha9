// Built by Anointed Coder.
//
// Public leaderboard feed for the live WinGo tournament.
//
// GET /api/tournaments/active
//   Returns the single active tournament (name, prize table, endsAt,
//   turnover/qualify rules) with its live top standings. When a player
//   is signed in, their own rank + score is resolved across the FULL
//   standings and returned separately so it can be highlighted even when
//   they sit outside the visible top slice. Returns { tournament: null }
//   when nothing is active.
//
// This public read performs ONLY money-free status flips (activate due
// drafts, end due tournaments) so the leaderboard is correct between cron
// ticks. It never settles or moves money: all prize settlement is owned by
// the cron driver (/api/cron/tournament-tick) and the admin settle action.
// Player identities are masked to a short handle; no phone/email leaks.

export const dynamic = 'force-dynamic';

import { withAuth } from '@/lib/auth/guard';
import { jsonOk } from '@/lib/auth/errors';
import { getCurrentSession } from '@/lib/auth/rbac';
import { db } from '@/lib/db/client';
import { getActiveTournamentPublic, type StandingRow } from '@/lib/tournaments/engine';

const TOP_LIMIT = 100;

// Mask a username to a short public handle: keep the first two and last
// character, star the middle. Short names are partly starred too.
function maskHandle(username: string | null | undefined, fallback: string): string {
  const name = (username ?? '').trim();
  if (!name) return fallback;
  if (name.length <= 3) return `${name.slice(0, 1)}**`;
  return `${name.slice(0, 2)}${'*'.repeat(Math.min(4, name.length - 3))}${name.slice(-1)}`;
}

export async function GET() {
  return withAuth(async () => {
    const session = await getCurrentSession();
    const viewerId = session?.sub ?? null;

    const active = await getActiveTournamentPublic(TOP_LIMIT, viewerId);
    if (!active) {
      return jsonOk({ tournament: null });
    }

    // Resolve display handles for the visible rows plus the viewer in a
    // single query.
    const ids = new Set<string>(active.standings.map((r) => r.userId));
    if (active.viewer) ids.add(active.viewer.userId);
    const users = ids.size
      ? await db.user.findMany({ where: { id: { in: [...ids] } }, select: { id: true, username: true } })
      : [];
    const nameById = new Map(users.map((u) => [u.id, u.username]));

    const shape = (r: StandingRow, index: number) => ({
      rank: r.rank,
      handle: maskHandle(nameById.get(r.userId), `Player ${index + 1}`),
      score: r.score,
      prizeAmount: r.prizeAmount,
      isSelf: viewerId != null && r.userId === viewerId,
    });

    const standings = active.standings.map(shape);
    const me = active.viewer
      ? {
          rank: active.viewer.rank,
          score: active.viewer.score,
          prizeAmount: active.viewer.prizeAmount,
          handle: maskHandle(nameById.get(active.viewer.userId), 'You'),
        }
      : null;

    return jsonOk({
      tournament: {
        id: active.id,
        nameEn: active.nameEn,
        nameBn: active.nameBn,
        status: active.status,
        startsAt: active.startsAt,
        endsAt: active.endsAt,
        turnoverX: active.turnoverX,
        minTurnover: active.minTurnover,
        prizes: active.prizes,
        participants: active.participants,
        standings,
        me,
      },
    });
  });
}
