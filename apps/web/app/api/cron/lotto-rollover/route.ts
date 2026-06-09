// Built by Anointed Coder.
//
// M2F cron-triggerable endpoint. POST every day at 7:30 PM (or any
// cadence chosen by the VPS cron) to:
//
//   1. close every active draw whose drawsAt has passed without a
//      result (sets closedAt). Ticket-accrual will then skip these
//      and attach new tickets to the next open draw instead.
//   2. seed the next day's instance for every closed draw with no
//      open successor (same name + schedule + ticket price +
//      accent, drawsAt = previous drawsAt + 24h).
//
// Settlement itself stays a manual admin action: the winning number
// is entered by an operator on /admin/lotto. This route only handles
// the lifecycle plumbing so the public lotto page always has a
// forward-looking draw and the settlement queue is never blocked by
// stale rows.
//
// Auth: requires either a logged-in admin with lotto.write permission
// OR a Bearer token matching CRON_SECRET in the environment. The
// secret path is what a Unix cron / GitHub Actions / Vercel cron
// would use (no session cookie available there).

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { withAuth, ensurePermission, recordActivity } from '@/lib/auth/guard';
import { jsonError, jsonOk } from '@/lib/auth/errors';
import { rolloverDraws } from '@/lib/lotto/tickets';

function bearerMatchesCronSecret(req: NextRequest): boolean {
  const header = req.headers.get('authorization') ?? '';
  const expected = process.env.CRON_SECRET ?? '';
  if (!expected) return false;
  const presented = header.startsWith('Bearer ') ? header.slice(7) : '';
  return presented.length > 0 && presented === expected;
}

export async function POST(req: NextRequest) {
  // Secret-based auth path for headless cron callers.
  if (bearerMatchesCronSecret(req)) {
    try {
      const result = await rolloverDraws();
      console.info('[cron] lotto rollover (cron-secret)', result);
      return jsonOk({ ok: true, source: 'cron_secret', ...result });
    } catch (err) {
      console.error('[cron] lotto rollover failed', err);
      return jsonError(500, 'ROLLOVER_FAILED', err instanceof Error ? err.message : String(err));
    }
  }

  // Session-based auth path for admin-triggered runs from /admin/lotto.
  return withAuth(async () => {
    const session = await ensurePermission('lotto.write');
    try {
      const result = await rolloverDraws();
      await recordActivity({
        actorId: session.sub,
        actorRole: session.role,
        action: 'LOTTO_ROLLOVER',
        meta: result,
      });
      console.info('[cron] lotto rollover (admin)', result);
      return jsonOk({ ok: true, source: 'admin', ...result });
    } catch (err) {
      console.error('[cron] lotto rollover failed', err);
      return jsonError(500, 'ROLLOVER_FAILED', err instanceof Error ? err.message : String(err));
    }
  });
}

// GET intentionally not exported.
//
// A state-mutating GET is a CSRF vector: any logged-in admin who
// loads a page containing <img src="/api/cron/lotto-rollover"> or
// follows a malicious link would trigger a draw rollover from
// their own browser. Cron callers (Unix cron, systemd, Vercel
// cron) MUST use POST + Authorization: Bearer ${CRON_SECRET}. The
// curl invocation for cron is documented in scripts/cron-examples.
