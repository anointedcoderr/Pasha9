// Built by Anointed Coder.
//
// Per-payout actions: approve, reject, mark-paid. Uses the engine
// helpers so the linked AffiliateCommission rows are kept in sync.

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db/client';
import { withAuth, ensurePermission, recordActivity } from '@/lib/auth/guard';
import { jsonError, jsonOk } from '@/lib/auth/errors';
import { approvePayout, markPayoutPaid, rejectPayout } from '@/lib/affiliate/engine';

const schema = z.object({
  action: z.enum(['approve', 'reject', 'mark_paid']),
  adminNote: z.string().max(500).optional(),
  providerKey: z.string().max(40).optional(),
  providerRef: z.string().max(80).optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  return withAuth(async () => {
    const session = await ensurePermission('affiliate.write');
    const body = await req.json().catch(() => ({}));
    const parsed = schema.safeParse(body);
    if (!parsed.success) return jsonError(400, 'VALIDATION', undefined, { issues: parsed.error.issues });

    const existing = await db.commissionPayout.findUnique({ where: { id: params.id } });
    if (!existing) return jsonError(404, 'NOT_FOUND');

    try {
      if (parsed.data.action === 'approve') {
        await approvePayout(params.id, session.sub, parsed.data.adminNote);
      } else if (parsed.data.action === 'reject') {
        await rejectPayout(params.id, session.sub, parsed.data.adminNote);
      } else {
        await markPayoutPaid(params.id, session.sub, {
          providerKey: parsed.data.providerKey,
          providerRef: parsed.data.providerRef,
          adminNote: parsed.data.adminNote,
        });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const known = ['PAYOUT_NOT_FOUND', 'PAYOUT_NOT_PENDING', 'PAYOUT_REJECTED', 'ALREADY_PAID'];
      if (known.includes(msg)) return jsonError(400, msg);
      console.error('[affiliate-payout] action failed', err);
      return jsonError(500, 'ACTION_FAILED', msg);
    }

    await recordActivity({
      actorId: session.sub,
      actorRole: session.role,
      action: `AFFILIATE_PAYOUT_${parsed.data.action.toUpperCase()}`,
      target: params.id,
      detail: parsed.data.adminNote ?? undefined,
      meta: {
        affiliateId: existing.affiliateId,
        amount: Number(existing.amount),
        method: existing.method,
        providerKey: parsed.data.providerKey,
        providerRef: parsed.data.providerRef,
      },
    });

    const updated = await db.commissionPayout.findUnique({ where: { id: params.id } });
    return jsonOk({ payout: updated });
  });
}
