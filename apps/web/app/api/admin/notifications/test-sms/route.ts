// Built by Anointed Coder.
//
// Admin "send a test SMS" button. Bypasses templates / dedupe; useful
// to verify a freshly-entered provider credential without waiting
// for a real deposit/withdrawal to fire.

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAuth, ensurePermission, recordActivity } from '@/lib/auth/guard';
import { jsonError, jsonOk } from '@/lib/auth/errors';
import { sendSms } from '@/lib/sms/service';

const schema = z.object({
  phone: z.string().trim().min(6).max(20),
  body: z.string().min(1).max(500).optional(),
});

export async function POST(req: NextRequest) {
  return withAuth(async () => {
    const session = await ensurePermission('settings.write');
    const body = await req.json().catch(() => ({}));
    const parsed = schema.safeParse(body);
    if (!parsed.success) return jsonError(400, 'VALIDATION', undefined, { issues: parsed.error.issues });

    const message = parsed.data.body ?? `Pasha 9 SMS test from /admin/notifications . ${new Date().toISOString()}`;
    const result = await sendSms({
      phone: parsed.data.phone,
      body: message,
      template: 'admin_test',
      triggerKey: `admin_test:${parsed.data.phone}:${Date.now()}`,
    });

    await recordActivity({
      actorId: session.sub,
      actorRole: session.role,
      action: result.ok ? 'NOTIFICATIONS_TEST_SMS_OK' : 'NOTIFICATIONS_TEST_SMS_FAIL',
      detail: `provider=${result.provider} phone=${parsed.data.phone.slice(0, 4)}***`,
      meta: { ok: result.ok, errorCode: result.errorCode, ref: result.ref },
    });

    return jsonOk({ result });
  });
}
