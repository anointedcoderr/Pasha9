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
import { autoSettleMaturedReferralUsers } from '@/lib/affiliate/settlement';

function bearerMatchesCronSecret(req: NextRequest): boolean {
  const header = req.headers.get('authorization') ?? '';
  const expected = process.env.CRON_SECRET ?? '';
  if (!expected) return false;
  const presented = header.startsWith('Bearer ') ? header.slice(7) : '';
  return presented.length > 0 && presented === expected;
}

async function run() {
  const settings = await loadReferralSettings();
  const balances = await refreshAllBalances(settings.holdDays);
  const auto = await autoSettleMaturedReferralUsers(settings);
  console.info('[cron] referral-mature', { ...balances, ...auto, holdDays: settings.holdDays, cadence: settings.cadence });
  return { holdDays: settings.holdDays, cadence: settings.cadence, ...balances, ...auto };
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

// GET intentionally not exported. A state-mutating GET would let
// any logged-in admin trigger referral settlement by loading a
// page containing <img src="/api/cron/referral-mature">. Cron
// callers must POST + Authorization: Bearer ${CRON_SECRET}.
