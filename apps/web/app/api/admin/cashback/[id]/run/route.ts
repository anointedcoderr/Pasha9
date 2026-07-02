// Built by Anointed Coder.
//
// POST /api/admin/cashback/[id]/run   { periodStart?, periodEnd?, dryRun? }
//
// Runs the cashback engine for the campaign. Without explicit window,
// the engine defaults to the campaign cadence (daily/weekly/monthly)
// ending at now. Returns the per-user payout breakdown so the admin
// can audit who got paid and why.
//
// dryRun: true makes the engine preview-only: identical eligibility
// scan and per-user math, but zero database writes (no payout, wallet,
// bonus, transaction or notification rows). The response carries
// dryRun: true so the UI can label it as a preview.

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAuth, ensurePermission, recordActivity } from '@/lib/auth/guard';
import { jsonError, jsonOk } from '@/lib/auth/errors';
import { runCashbackCampaign } from '@/lib/cashback/engine';

const bodySchema = z.object({
  periodStart: z.string().datetime().optional(),
  periodEnd: z.string().datetime().optional(),
  dryRun: z.boolean().optional(),
});

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  return withAuth(async () => {
    const session = await ensurePermission('bonuses.write');
    // An empty body means "scheduled run over the default window", but
    // MALFORMED JSON must fail closed: with previews in play, silently
    // degrading a corrupted preview request to {} would turn "just look"
    // into a real paying run.
    const raw = await req.text().catch(() => '');
    let body: unknown = {};
    if (raw.trim().length > 0) {
      try {
        body = JSON.parse(raw);
      } catch {
        return jsonError(400, 'VALIDATION', 'Request body is not valid JSON.');
      }
    }
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) return jsonError(400, 'VALIDATION');
    const { periodStart, periodEnd, dryRun } = parsed.data;

    let result;
    try {
      result = await runCashbackCampaign({
        campaignId: params.id,
        periodStart: periodStart ? new Date(periodStart) : undefined,
        periodEnd: periodEnd ? new Date(periodEnd) : undefined,
        actorId: session.sub,
        actorRole: session.role,
        dryRun: dryRun === true,
      });
    } catch (err) {
      const code = err instanceof Error && err.message === 'CAMPAIGN_NOT_FOUND' ? 404 : err instanceof Error && err.message === 'CAMPAIGN_INACTIVE' ? 409 : 500;
      return jsonError(code, 'CASHBACK_RUN_FAILED', err instanceof Error ? err.message : 'Run failed');
    }

    // A dry run must write nothing at all, so even the activity-log row
    // is skipped: the preview is purely read + compute end to end.
    if (!result.dryRun) {
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
    }

    return jsonOk(result);
  });
}
