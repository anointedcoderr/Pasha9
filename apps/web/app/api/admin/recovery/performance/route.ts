// Built by Anointed Coder.
//
// Staff performance report. Aggregates RecoveryContactLog +
// RecoveryTask close counts per staff over an optional date range.
// from / to are ISO datetimes; both optional. Useful for the weekly
// supervisor review.

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { withAuth, ensurePermission } from '@/lib/auth/guard';
import { jsonOk } from '@/lib/auth/errors';
import { getStaffPerformance } from '@/lib/recovery/engine';

export async function GET(req: NextRequest) {
  return withAuth(async () => {
    await ensurePermission('users.read');
    const url = new URL(req.url);
    const fromStr = url.searchParams.get('from');
    const toStr = url.searchParams.get('to');
    const from = fromStr && !Number.isNaN(Date.parse(fromStr)) ? new Date(fromStr) : undefined;
    const to = toStr && !Number.isNaN(Date.parse(toStr)) ? new Date(toStr) : undefined;
    const rows = await getStaffPerformance(from, to);
    return jsonOk({ rows, from: from ?? null, to: to ?? null });
  });
}
