// Built by Anointed Coder.
//
// WinGo Tournament cron driver. On each call it: activates scheduled
// drafts whose window has opened, ends tournaments past their endsAt,
// then settles every ended tournament EXACTLY ONCE. Idempotent and safe
// to call every minute; it is scheduled on the VPS loopback crontab.
//
// All money stays on the server: settlement transitions ended -> paid via
// a guarded updateMany (one caller claims it) and pays every winning rank
// exactly once, keyed by a unique TournamentPayout.idempotencyKey, so a
// re-run or a crash mid-settlement can never double-pay. See
// lib/tournaments/engine.ts.
//
// Auth: Bearer CRON_SECRET (mirrors the other crons) OR a logged-in admin
// with users.read. The Bearer header MUST be `Bearer <CRON_SECRET>`.
//
// POST /api/cron/tournament-tick

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { withAuth, ensurePermission, recordActivity } from '@/lib/auth/guard';
import { jsonError, jsonOk } from '@/lib/auth/errors';
import { runTournamentTick } from '@/lib/tournaments/engine';

function bearerMatchesCronSecret(req: NextRequest): boolean {
  const header = req.headers.get('authorization') ?? '';
  const expected = process.env.CRON_SECRET ?? '';
  if (!expected) return false;
  const presented = header.startsWith('Bearer ') ? header.slice(7) : '';
  return presented.length > 0 && presented === expected;
}

export async function POST(req: NextRequest) {
  if (bearerMatchesCronSecret(req)) {
    try {
      const result = await runTournamentTick();
      return jsonOk({ ok: true, source: 'cron_secret', ...result });
    } catch (err) {
      return jsonError(500, 'CRON_FAILED', err instanceof Error ? err.message : String(err));
    }
  }

  return withAuth(async () => {
    const session = await ensurePermission('users.read');
    try {
      const result = await runTournamentTick(new Date(), { actorId: session.sub, actorRole: session.role });
      await recordActivity({
        actorId: session.sub,
        actorRole: session.role,
        action: 'TOURNAMENT_CRON',
        meta: { ...result },
      });
      return jsonOk({ ok: true, source: 'admin', ...result });
    } catch (err) {
      return jsonError(500, 'CRON_FAILED', err instanceof Error ? err.message : String(err));
    }
  });
}
