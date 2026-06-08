// Built by Anointed Coder.
//
// POST /api/admin/cashback/[id]/run   { periodStart?, periodEnd? }
//
// Runs the cashback engine for the campaign. Without explicit window,
// the engine defaults to the campaign cadence (daily/weekly/monthly)
// ending at now. Returns the per-user payout breakdown so the admin
// can audit who got paid and why.

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAuth, ensurePermission, recordActivity } from '@/lib/auth/guard';
import { jsonError, jsonOk } from '@/lib/auth/errors';
import { runCashbackCampaign } from '@/lib/cashback/engine';

const bodySchema = z.object({
  periodStart: z.string().datetime().optional(),
  periodEnd: z.string().datetime().optional(),
});

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  return withAuth(async () => {
    const session = await ensurePermission('bonuses.write');
    const body = await req.json().catch(() => ({}));
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) return jsonError(400, 'VALIDATION');
    const { periodStart, periodEnd } = parsed.data;

    let result;
    try {
      result = await runCashbackCampaign({
        campaignId: params.id,
        periodStart: periodStart ? new Date(periodStart) : undefined,
        periodEnd: periodEnd ? new Date(periodEnd) : undefined,
        actorId: session.sub,
        actorRole: session.role,
      });
    } catch (err) {
      const code = err instanceof Error && err.message === 'CAMPAIGN_NOT_FOUND' ? 404 : err instanceof Error && err.message === 'CAMPAIGN_INACTIVE' ? 409 : 500;
      return jsonError(code, 'CASHBACK_RUN_FAILED', err instanceof Error ? err.message : 'Run failed');
    }

    await recordActivity({
      actorId: session.sub,
      actorRole: session.role,
      action: 'CASHBACK_RUN',
      target: params.id,
      meta: {
        periodKey: result.periodKey,
        eligibleUsers: result.eligibleUsers,
        paidUsers: result.paidUsers,
        totalCashback: result.totalCashback,
      },
    });

    return jsonOk(result);
  });
}
