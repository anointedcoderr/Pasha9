// Built by Anointed Coder.
//
// M4 Phase E referral maturity cron. Recomputes the cached
// ReferralBalance projection for every affiliate who has at least one
// AffiliateCommission row. The projection itself is computed from the
// canonical ledger inside lib/affiliate/balance.ts so this endpoint
// is idempotent: re-running it within the same minute will produce
// the same numbers.
//
// Auth: Bearer CRON_SECRET OR a logged-in admin with users.read.
// Triggered by a Unix cron / GitHub Actions / Vercel cron hourly.

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { withAuth, ensurePermission, recordActivity } from '@/lib/auth/guard';
import { jsonError, jsonOk } from '@/lib/auth/errors';
import { loadReferralSettings, refreshAllBalances } from '@/lib/affiliate/balance';

function bearerMatchesCronSecret(req: NextRequest): boolean {
  const header = req.headers.get('authorization') ?? '';
  const expected = process.env.CRON_SECRET ?? '';
  if (!expected) return false;
  const presented = header.startsWith('Bearer ') ? header.slice(7) : '';
  return presented.length > 0 && presented === expected;
}

async function run() {
  const settings = await loadReferralSettings();
  const result = await refreshAllBalances(settings.holdDays);
  console.info('[cron] referral-mature', { ...result, holdDays: settings.holdDays });
  return { holdDays: settings.holdDays, ...result };
}

export async function POST(req: NextRequest) {
  if (bearerMatchesCronSecret(req)) {
    try {
      const result = await run();
      return jsonOk({ ok: true, source: 'cron_secret', ...result });
    } catch (err) {
      return jsonError(500, 'CRON_FAILED', err instanceof Error ? err.message : String(err));
    }
  }

  return withAuth(async () => {
    const session = await ensurePermission('users.read');
    try {
      const result = await run();
      await recordActivity({
        actorId: session.sub,
        actorRole: session.role,
        action: 'REFERRAL_MATURE_CRON',
        meta: result,
      });
      return jsonOk({ ok: true, source: 'admin', ...result });
    } catch (err) {
      return jsonError(500, 'CRON_FAILED', err instanceof Error ? err.message : String(err));
    }
  });
}

export async function GET(req: NextRequest) {
  // Mirror POST so systemd / curl GET-only schedulers work.
  return POST(req);
}
