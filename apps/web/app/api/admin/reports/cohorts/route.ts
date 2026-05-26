// Built by Anointed Coder.
//
// M2J signup cohort feed. Default granularity=week, last 90 days.

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { withAuth, ensurePermission } from '@/lib/auth/guard';
import { jsonError, jsonOk } from '@/lib/auth/errors';
import { getCohorts, type CohortGranularity } from '@/lib/reports/cohorts';

export async function GET(req: NextRequest) {
  return withAuth(async () => {
    await ensurePermission('activity.read');
    const url = req.nextUrl;
    const granularity = (url.searchParams.get('granularity') ?? 'week') as CohortGranularity;
    if (!['day', 'week', 'month'].includes(granularity)) {
      return jsonError(400, 'INVALID_GRANULARITY');
    }
    const fromStr = url.searchParams.get('from');
    const toStr = url.searchParams.get('to');
    const from = fromStr && !Number.isNaN(Date.parse(fromStr)) ? new Date(fromStr) : undefined;
    const to = toStr && !Number.isNaN(Date.parse(toStr)) ? new Date(toStr) : undefined;
    try {
      const result = await getCohorts({ granularity, from, to });
      return jsonOk(result);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[reports-cohorts] failed', err);
      return jsonError(500, 'COHORTS_FAILED', msg);
    }
  });
}
