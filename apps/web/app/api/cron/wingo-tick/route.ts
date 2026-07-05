// Built by Anointed Coder.
//
// Pasha WinGo cron driver. On each call it: settles every round past its
// draw across all modes, closes rounds past their bet-close, and ensures
// the current + next round exists for every mode. Idempotent and safe to
// call every few seconds; it is scheduled on the VPS loopback crontab.
//
// All money stays on the server: settlement generates each round's result
// exactly once (guarded status transition) and pays every bet exactly
// once (guarded per-bet flip), so re-running a settled round is a no-op
// and can never double-pay. See lib/wingo/engine.ts.
//
// Auth: Bearer CRON_SECRET (mirrors the other crons) OR a logged-in admin
// with users.read. The Bearer header MUST be `Bearer <CRON_SECRET>`.
//
// POST /api/cron/wingo-tick

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { withAuth, ensurePermission, recordActivity } from '@/lib/auth/guard';
import { jsonError, jsonOk } from '@/lib/auth/errors';
import { wingoTick } from '@/lib/wingo/engine';

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
      const result = await wingoTick();
      return jsonOk({ ok: true, source: 'cron_secret', ...result });
    } catch (err) {
      return jsonError(500, 'CRON_FAILED', err instanceof Error ? err.message : String(err));
    }
  }

  return withAuth(async () => {
    const session = await ensurePermission('users.read');
    try {
      const result = await wingoTick();
      await recordActivity({
        actorId: session.sub,
        actorRole: session.role,
        action: 'WINGO_CRON',
        meta: { ...result },
      });
      return jsonOk({ ok: true, source: 'admin', ...result });
    } catch (err) {
      return jsonError(500, 'CRON_FAILED', err instanceof Error ? err.message : String(err));
    }
  });
}
