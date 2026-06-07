// Built by Anointed Coder.
//
// Cancel an active bonus grant. Clawbacks the locked bonus balance
// + writes an adjust transaction. Only allowed for status="active".

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAuth, ensurePermission, recordActivity } from '@/lib/auth/guard';
import { jsonError, jsonOk } from '@/lib/auth/errors';
import { cancelGrant } from '@/lib/bonuses/engine';

const schema = z.object({ note: z.string().max(500).optional() });

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  return withAuth(async () => {
    const session = await ensurePermission('bonuses.write');
    const body = await req.json().catch(() => ({}));
    const parsed = schema.safeParse(body);
    if (!parsed.success) return jsonError(400, 'VALIDATION', undefined, { issues: parsed.error.issues });

    try {
      await cancelGrant(params.id, parsed.data.note);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'CANCEL_FAILED';
      const known = ['GRANT_NOT_FOUND', 'GRANT_NOT_ACTIVE', 'REFERRAL_LOCK_MANAGED_BY_REFERRAL_LEDGER'];
      if (known.includes(msg)) return jsonError(400, msg);
      console.error('grant cancel failed', err);
      return jsonError(500, 'SERVER_ERROR');
    }

    await recordActivity({
      actorId: session.sub,
      actorRole: session.role,
      action: 'BONUS_GRANT_CANCEL',
      target: params.id,
      detail: parsed.data.note ?? undefined,
    });

    return jsonOk({ ok: true });
  });
}
