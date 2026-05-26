// Built by Anointed Coder.
//
// Admin "fire a test tracking event" button. Sends one custom event
// to every enabled platform so the operator can validate the pixel
// IDs + tokens without simulating a real deposit/registration.

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAuth, ensurePermission, recordActivity } from '@/lib/auth/guard';
import { jsonError, jsonOk } from '@/lib/auth/errors';
import { fireEvent } from '@/lib/tracking/dispatcher';

const schema = z.object({
  event: z.enum(['signup', 'login', 'deposit', 'withdrawal', 'lotto_bet', 'bonus_claim', 'custom']).default('custom'),
  value: z.coerce.number().optional(),
  reference: z.string().max(80).optional(),
});

export async function POST(req: NextRequest) {
  return withAuth(async () => {
    const session = await ensurePermission('settings.write');
    const body = await req.json().catch(() => ({}));
    const parsed = schema.safeParse(body);
    if (!parsed.success) return jsonError(400, 'VALIDATION', undefined, { issues: parsed.error.issues });

    const result = await fireEvent({
      event: parsed.data.event,
      source: 'server',
      userId: session.sub,
      value: parsed.data.value,
      currency: 'BDT',
      reference: parsed.data.reference ?? `admin_test_${Date.now()}`,
      payload: { triggeredBy: 'admin_test' },
    });

    await recordActivity({
      actorId: session.sub,
      actorRole: session.role,
      action: 'NOTIFICATIONS_TEST_EVENT',
      detail: `event=${parsed.data.event} platforms=${result.results.map((r) => `${r.platform}:${r.status}`).join(' ')}`,
      meta: { results: result.results, trackingEventId: result.trackingEventId },
    });

    return jsonOk(result);
  });
}
