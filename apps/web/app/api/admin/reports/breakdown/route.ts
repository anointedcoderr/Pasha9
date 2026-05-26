// Built by Anointed Coder.
//
// M2J breakdown feed. kind=deposit_by_method|withdrawal_by_method|
// bonus_by_type|commission_by_level|lotto_by_tier

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { withAuth, ensurePermission } from '@/lib/auth/guard';
import { jsonError, jsonOk } from '@/lib/auth/errors';
import { getBreakdown, type BreakdownKind } from '@/lib/reports/breakdown';

const ALLOWED: BreakdownKind[] = ['deposit_by_method', 'withdrawal_by_method', 'bonus_by_type', 'commission_by_level', 'lotto_by_tier'];

export async function GET(req: NextRequest) {
  return withAuth(async () => {
    await ensurePermission('activity.read');
    const url = req.nextUrl;
    const kind = (url.searchParams.get('kind') ?? 'deposit_by_method') as BreakdownKind;
    if (!ALLOWED.includes(kind)) {
      return jsonError(400, 'INVALID_KIND', `Allowed: ${ALLOWED.join(', ')}`);
    }
    const fromStr = url.searchParams.get('from');
    const toStr = url.searchParams.get('to');
    const to = toStr && !Number.isNaN(Date.parse(toStr)) ? new Date(toStr) : new Date();
    const from = fromStr && !Number.isNaN(Date.parse(fromStr)) ? new Date(fromStr) : new Date(to.getTime() - 30 * 86_400_000);
    try {
      const result = await getBreakdown(kind, from, to);
      return jsonOk(result);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[reports-breakdown] failed', err);
      return jsonError(500, 'BREAKDOWN_FAILED', msg);
    }
  });
}
