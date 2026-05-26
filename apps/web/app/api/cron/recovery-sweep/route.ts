// Built by Anointed Coder.
//
// M2H cron sweep. POST every few minutes (or however often the VPS
// cron runs) to:
//   1. release any task whose lockedUntil is in the past so the next
//      staff can pick it up. Tasks in_progress flip back to open.
//   2. materialize new tasks for every active rule with
//      autoCreateTasks=true (idempotent - users with existing open
//      tasks for the rule are skipped).
//
// Dual auth: Bearer CRON_SECRET (headless cron callers) OR session
// with users.update permission (admin button in /admin/recovery).

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { withAuth, ensurePermission, recordActivity } from '@/lib/auth/guard';
import { jsonError, jsonOk } from '@/lib/auth/errors';
import { releaseExpiredLocks, materializeAllAuto } from '@/lib/recovery/engine';

function bearerMatchesCronSecret(req: NextRequest): boolean {
  const header = req.headers.get('authorization') ?? '';
  const expected = process.env.CRON_SECRET ?? '';
  if (!expected) return false;
  const presented = header.startsWith('Bearer ') ? header.slice(7) : '';
  return presented.length > 0 && presented === expected;
}

async function run() {
  const lockRelease = await releaseExpiredLocks();
  const materialized = await materializeAllAuto();
  const totalCreated = materialized.reduce((acc, r) => acc + r.created, 0);
  const totalSkipped = materialized.reduce((acc, r) => acc + r.skippedExisting, 0);
  return {
    released: lockRelease.released,
    rulesEvaluated: materialized.length,
    tasksCreated: totalCreated,
    tasksSkippedExisting: totalSkipped,
    perRule: materialized,
    message: `released ${lockRelease.released} expired lock(s) . materialized ${totalCreated} new task(s) across ${materialized.length} active auto-rule(s)`,
  };
}

export async function POST(req: NextRequest) {
  if (bearerMatchesCronSecret(req)) {
    try {
      const result = await run();
      console.info('[cron] recovery sweep (cron-secret)', result);
      return jsonOk({ ok: true, source: 'cron_secret', ...result });
    } catch (err) {
      console.error('[cron] recovery sweep failed', err);
      return jsonError(500, 'SWEEP_FAILED', err instanceof Error ? err.message : String(err));
    }
  }

  return withAuth(async () => {
    const session = await ensurePermission('users.update');
    try {
      const result = await run();
      await recordActivity({
        actorId: session.sub,
        actorRole: session.role,
        action: 'RECOVERY_SWEEP',
        detail: result.message,
        meta: result,
      });
      return jsonOk({ ok: true, source: 'admin', ...result });
    } catch (err) {
      console.error('[cron] recovery sweep failed', err);
      return jsonError(500, 'SWEEP_FAILED', err instanceof Error ? err.message : String(err));
    }
  });
}

export async function GET(req: NextRequest) {
  return POST(req);
}
