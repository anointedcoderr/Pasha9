// Built by Anointed Coder.
//
// GET /api/admin/reports/business-snapshot?from=ISO&to=ISO
// Returns every range-bound business KPI a Pasha 9 operator needs.
// Defaults to the last 30 days when from/to are omitted.

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { withAuth, ensurePermission } from '@/lib/auth/guard';
import { jsonError, jsonOk } from '@/lib/auth/errors';
import { getBusinessSnapshot } from '@/lib/reports/business-snapshot';

function parseDate(v: string | null, fallback: Date): Date {
  if (!v) return fallback;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? fallback : d;
}

export async function GET(req: NextRequest) {
  return withAuth(async () => {
    // Same permission as the other reports endpoints and the admin nav, so
    // the whole reports page works under one grant. Was activity.read
    // (shared with the unrelated Activity Log section); reports.read is the
    // dedicated code.
    await ensurePermission('reports.read');
    try {
      const url = req.nextUrl;
      const to = parseDate(url.searchParams.get('to'), new Date());
      const from = parseDate(url.searchParams.get('from'), new Date(Date.now() - 30 * 86_400_000));
      const snap = await getBusinessSnapshot({ from, to });
      return jsonOk(snap);
    } catch (err) {
      return jsonError(500, 'SNAPSHOT_FAILED', err instanceof Error ? err.message : String(err));
    }
  });
}
