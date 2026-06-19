// Built by Anointed Coder.
//
// Cashback maturity cron. Picks up every active CashbackCampaign whose
// previous payout for the implied period has not yet been recorded and
// runs runCashbackCampaign() for it. Re-running a campaign for the same
// period is a no-op thanks to CashbackPayout.idempotencyKey, so the
// cron is safe to fire on any cadence (every minute, hourly, daily) -
// only the matching campaigns actually pay out.
//
// Cadence interpretation:
//   daily   -> defaultPeriodWindow returns yesterday 00:00..today 00:00
//              and periodKey = YYYY-MM-DD. A daily campaign pays at
//              most once per UTC day.
//   weekly  -> last 7 days; periodKey = YYYY-Www (ISO week). A weekly
//              campaign pays at most once per ISO week.
//   monthly -> last calendar month; periodKey = YYYY-MM. At most once
//              per month.
//
// Auth: Bearer CRON_SECRET OR a logged-in admin with users.read.
// Triggered by the same Unix cron / GitHub Actions cron that already
// fires referral-mature and lotto-rollover (see deploy docs).

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { withAuth, ensurePermission, recordActivity } from '@/lib/auth/guard';
import { jsonError, jsonOk } from '@/lib/auth/errors';
import { db } from '@/lib/db/client';
import { runCashbackCampaign } from '@/lib/cashback/engine';

function bearerMatchesCronSecret(req: NextRequest): boolean {
  const header = req.headers.get('authorization') ?? '';
  const expected = process.env.CRON_SECRET ?? '';
  if (!expected) return false;
  const presented = header.startsWith('Bearer ') ? header.slice(7) : '';
  return presented.length > 0 && presented === expected;
}

interface CronRunSummary {
  scanned: number;
  ran: number;
  paidUsers: number;
  totalCashback: number;
  errors: number;
  details: Array<{
    campaignId: string;
    name: string;
    cadence: string;
    status: 'ran' | 'inactive' | 'window_closed' | 'error';
    eligibleUsers?: number;
    paidUsers?: number;
    totalCashback?: number;
    error?: string;
  }>;
}

async function run(): Promise<CronRunSummary> {
  const now = new Date();
  const campaigns = await db.cashbackCampaign.findMany({
    where: { isActive: true },
    select: {
      id: true, nameEn: true, cadence: true,
      startsAt: true, endsAt: true,
    },
  });

  const summary: CronRunSummary = {
    scanned: campaigns.length,
    ran: 0,
    paidUsers: 0,
    totalCashback: 0,
    errors: 0,
    details: [],
  };

  for (const c of campaigns) {
    if (c.startsAt && c.startsAt > now) {
      summary.details.push({ campaignId: c.id, name: c.nameEn, cadence: c.cadence, status: 'window_closed' });
      continue;
    }
    if (c.endsAt && c.endsAt < now) {
      summary.details.push({ campaignId: c.id, name: c.nameEn, cadence: c.cadence, status: 'window_closed' });
      continue;
    }
    try {
      const result = await runCashbackCampaign({ campaignId: c.id, actorId: null, actorRole: 'cron' });
      summary.ran += 1;
      summary.paidUsers += result.paidUsers;
      summary.totalCashback += result.totalCashback;
      summary.details.push({
        campaignId: c.id,
        name: c.nameEn,
        cadence: c.cadence,
        status: 'ran',
        eligibleUsers: result.eligibleUsers,
        paidUsers: result.paidUsers,
        totalCashback: result.totalCashback,
      });
    } catch (err) {
      summary.errors += 1;
      summary.details.push({
        campaignId: c.id,
        name: c.nameEn,
        cadence: c.cadence,
        status: 'error',
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  console.info('[cron] cashback', {
    scanned: summary.scanned,
    ran: summary.ran,
    paidUsers: summary.paidUsers,
    totalCashback: summary.totalCashback,
    errors: summary.errors,
  });
  return summary;
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
        action: 'CASHBACK_CRON',
        meta: { scanned: result.scanned, ran: result.ran, paidUsers: result.paidUsers, totalCashback: result.totalCashback, errors: result.errors },
      });
      return jsonOk({ ok: true, source: 'admin', ...result });
    } catch (err) {
      return jsonError(500, 'CRON_FAILED', err instanceof Error ? err.message : String(err));
    }
  });
}
