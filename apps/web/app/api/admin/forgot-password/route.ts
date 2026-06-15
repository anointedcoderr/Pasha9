// Built by Anointed Coder.
//
// Admin toggle + status for the Firebase Phone Auth Forgot Password
// flow. GET returns the current flag value plus a server-side check
// on whether the Firebase Admin SDK env vars are present. PATCH flips
// the SystemSetting 'forgot_password_enabled' value.

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db/client';
import { withAuth, ensurePermission, recordActivity } from '@/lib/auth/guard';
import { jsonError, jsonOk } from '@/lib/auth/errors';
import { isFirebaseConfigured } from '@/lib/firebase/admin';

const SETTING_KEY = 'forgot_password_enabled';

export async function GET() {
  return withAuth(async () => {
    await ensurePermission('settings.read');
    const row = await db.systemSetting.findUnique({ where: { key: SETTING_KEY }, select: { value: true } });
    return jsonOk({
      enabled: (row?.value ?? '0').trim() === '1',
      adminSdkConfigured: isFirebaseConfigured(),
    });
  });
}

const patchSchema = z.object({
  enabled: z.boolean(),
});

export async function PATCH(req: NextRequest) {
  return withAuth(async () => {
    const session = await ensurePermission('settings.write');
    const body = await req.json().catch(() => ({}));
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) return jsonError(400, 'VALIDATION');
    const value = parsed.data.enabled ? '1' : '0';
    await db.systemSetting.upsert({
      where: { key: SETTING_KEY },
      update: { value },
      create: { key: SETTING_KEY, value },
    });
    await recordActivity({
      actorId: session.sub,
      actorRole: session.role,
      action: 'FORGOT_PHONE_FLAG_TOGGLE',
      target: SETTING_KEY,
      detail: value,
    });
    return jsonOk({ enabled: parsed.data.enabled });
  });
}
