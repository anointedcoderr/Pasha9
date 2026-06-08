// Built by Anointed Coder.
//
// POST /api/admin/campaigns/[id]/dispatch
// Triggers the dispatch service. Returns the resulting status so the
// admin UI can show 'sent', 'partial', 'failed' or 'provider_setup_required'
// without polling.

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { db } from '@/lib/db/client';
import { withAuth, ensurePermission, recordActivity } from '@/lib/auth/guard';
import { jsonError, jsonOk } from '@/lib/auth/errors';
import { dispatchCampaign } from '@/lib/campaigns/dispatch';

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  return withAuth(async () => {
    const session = await ensurePermission('settings.write');
    const existing = await db.campaign.findUnique({ where: { id: params.id } });
    if (!existing) return jsonError(404, 'NOT_FOUND');
    if (existing.status === 'sent') return jsonError(409, 'ALREADY_SENT', 'Campaign was already dispatched.');

    let result;
    try {
      result = await dispatchCampaign(params.id);
    } catch (err) {
      console.error('[campaigns/dispatch] failed', err);
      return jsonError(500, 'DISPATCH_FAILED', err instanceof Error ? err.message : 'Dispatch failed.');
    }

    await recordActivity({
      actorId: session.sub,
      actorRole: session.role,
      action: 'CAMPAIGN_DISPATCH',
      target: params.id,
      detail: existing.title,
      meta: { ...result } as Record<string, unknown>,
    });

    return jsonOk(result);
  });
}
