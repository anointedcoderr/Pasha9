// Built by Anointed Coder.
//
// Bulk upsert for SMS + tracking SystemSetting keys. Refuses to
// write any key outside the allowlist. Empty string is treated as
// "leave existing value alone" for secret-shaped keys so the admin
// can patch one field without re-entering the API token every time.

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db/client';
import { withAuth, ensurePermission, recordActivity } from '@/lib/auth/guard';
import { jsonError, jsonOk } from '@/lib/auth/errors';
import { invalidateTelegramSettingsCache } from '@/lib/telegram/notify';

const ALLOWED_KEYS = new Set([
  'sms_provider',
  'sms_sender_id',
  'sms_sslwireless_api_token',
  'sms_sslwireless_sid',
  'sms_sslwireless_endpoint',
  'sms_twilio_account_sid',
  'sms_twilio_auth_token',
  'sms_twilio_from',
  'sms_smsnetbd_api_key',
  'sms_smsnetbd_endpoint',
  'telegram_alerts_enabled',
  'telegram_bot_token',
  'telegram_chat_id',
  'pixel_facebook',
  'pixel_facebook_capi_token',
  'pixel_facebook_test_event_code',
  'pixel_tiktok',
  'pixel_tiktok_access_token',
  'analytics_ga4',
  'analytics_ga4_api_secret',
  'analytics_google_ads',
  'analytics_google_ads_conv_label',
  'analytics_gtm',
]);
const SECRET_KEY = /(token|secret|api_key|api_token|auth_token)/i;

const schema = z.object({
  updates: z.array(z.object({
    key: z.string().min(1).max(80),
    value: z.string().max(4000),
  })).max(40),
});

export async function PATCH(req: NextRequest) {
  return withAuth(async () => {
    const session = await ensurePermission('settings.write');
    const body = await req.json().catch(() => ({}));
    const parsed = schema.safeParse(body);
    if (!parsed.success) return jsonError(400, 'VALIDATION', undefined, { issues: parsed.error.issues });

    const ops = [];
    const writtenKeys: string[] = [];
    for (const u of parsed.data.updates) {
      if (!ALLOWED_KEYS.has(u.key)) continue;
      // Empty value on a secret key = leave the stored value as-is.
      if (SECRET_KEY.test(u.key) && u.value.trim() === '') continue;
      ops.push(
        db.systemSetting.upsert({
          where: { key: u.key },
          update: { value: u.value },
          // SettingCategory has no dedicated telegram value, so the
          // Telegram keys live under 'general' (schema stays untouched).
          create: { key: u.key, value: u.value, category: u.key.startsWith('sms_') ? 'sms' : u.key.startsWith('telegram_') ? 'general' : 'tracking' },
        }),
      );
      writtenKeys.push(u.key);
    }

    if (ops.length === 0) return jsonOk({ ok: true, updated: 0 });

    await db.$transaction(ops);

    // Telegram settings are cached briefly on the hot notify path;
    // drop the cache so a fresh token / chat id applies immediately.
    if (writtenKeys.some((k) => k.startsWith('telegram_'))) {
      invalidateTelegramSettingsCache();
    }

    await recordActivity({
      actorId: session.sub,
      actorRole: session.role,
      action: 'NOTIFICATIONS_SETTINGS_UPDATE',
      detail: writtenKeys.join(','),
    });

    return jsonOk({ ok: true, updated: ops.length, keys: writtenKeys });
  });
}
