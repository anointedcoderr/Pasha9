// Built by Anointed Coder.
//
// M2J time-series feed. Query params:
//   metric=deposits|deposits_count|withdrawals|withdrawals_count|
//          signups|active_users|bonus_payout|commission_paid|
//          lotto_payout|net_cash|operating_result
//   granularity=day|week|month   default day
//   from=ISO datetime            default = to - 30 days
//   to=ISO datetime              default = now

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { withAuth, ensurePermission } from '@/lib/auth/guard';
import { jsonError, jsonOk } from '@/lib/auth/errors';
import { getTimeseries, ALL_METRICS, METRIC_LABELS, type Metric, type Granularity } from '@/lib/reports/timeseries';

export async function GET(req: NextRequest) {
  return withAuth(async () => {
    // Was activity.read (shared with the unrelated Activity Log section);
    // reports.read is the dedicated code so the two are independently
    // grantable.
    await ensurePermission('reports.read');
    const url = req.nextUrl;
    const metric = (url.searchParams.get('metric') ?? 'deposits') as Metric;
    if (!ALL_METRICS.includes(metric)) {
      return jsonError(400, 'INVALID_METRIC', `Unknown metric. Allowed: ${ALL_METRICS.join(', ')}`);
    }
    const granularity = (url.searchParams.get('granularity') ?? 'day') as Granularity;
    if (!['day', 'week', 'month'].includes(granularity)) {
      return jsonError(400, 'INVALID_GRANULARITY');
    }
    const fromStr = url.searchParams.get('from');
    const toStr = url.searchParams.get('to');
    const from = fromStr && !Number.isNaN(Date.parse(fromStr)) ? new Date(fromStr) : undefined;
    const to = toStr && !Number.isNaN(Date.parse(toStr)) ? new Date(toStr) : undefined;

    try {
      const result = await getTimeseries({ metric, granularity, from, to });
      return jsonOk({ ...result, label: METRIC_LABELS[metric] });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[reports-timeseries] failed', err);
      return jsonError(500, 'TIMESERIES_FAILED', msg);
    }
  });
}
