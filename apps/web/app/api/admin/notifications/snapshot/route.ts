// Built by Anointed Coder.
//
// One-call dashboard payload for /admin/notifications. Returns:
//   - SMS provider catalog (live status, settings keys, descriptions)
//   - Current SMS settings values (secrets are MASKED for display)
//   - Tracking platform catalog (live status, settings keys)
//   - Recent NotificationLog + TrackingEvent rows for the history panel

export const dynamic = 'force-dynamic';

import { db } from '@/lib/db/client';
import { withAuth, ensurePermission } from '@/lib/auth/guard';
import { jsonOk } from '@/lib/auth/errors';
import { listSmsAdapters } from '@/lib/sms/registry';
import { platformsStatus } from '@/lib/tracking/dispatcher';

const SECRET_KEY_HINT = /(token|secret|api_key|api_token|auth_token)/i;

function maskSecret(value: string): string {
  if (!value) return '';
  if (value.length <= 8) return '****';
  return `${value.slice(0, 4)}...${value.slice(-2)}`;
}

export async function GET() {
  return withAuth(async () => {
    await ensurePermission('settings.write');

    const adapters = listSmsAdapters();
    const allKeys = Array.from(new Set([
      'sms_provider',
      'sms_sender_id',
      ...adapters.flatMap((a) => a.describe().settingKeys),
      'pixel_facebook',
      'pixel_facebook_capi_token',
      'pixel_facebook_test_event_code',
      'pixel_tiktok',
      'pixel_tiktok_access_token',
      'analytics_ga4',
      'analytics_ga4_api_secret',
      'analytics_google_ads',
      'analytics_google_ads_conv_label',
    ]));

    const rows = await db.systemSetting.findMany({
      where: { key: { in: allKeys } },
      select: { key: true, value: true },
    });
    const settingsMap: Record<string, string> = {};
    const displaySettings: Record<string, string> = {};
    for (const r of rows) {
      const v = r.value ?? '';
      settingsMap[r.key] = v;
      displaySettings[r.key] = SECRET_KEY_HINT.test(r.key) ? maskSecret(v) : v;
    }

    const smsCatalog = await Promise.all(adapters.map(async (a) => {
      const status = await a.configStatus(settingsMap);
      const desc = a.describe();
      return {
        key: desc.key,
        label: desc.label,
        description: desc.description,
        settingKeys: desc.settingKeys,
        status,
        isCurrent: (settingsMap.sms_provider || 'manual') === desc.key,
      };
    }));

    const tracking = await platformsStatus();

    const [notifs, events] = await Promise.all([
      db.notificationLog.findMany({
        orderBy: { createdAt: 'desc' },
        take: 30,
      }),
      db.trackingEvent.findMany({
        orderBy: { createdAt: 'desc' },
        take: 30,
      }),
    ]);

    return jsonOk({
      currentSmsProvider: settingsMap.sms_provider || 'manual',
      smsCatalog,
      tracking,
      settings: displaySettings,
      notifications: notifs.map((n) => ({
        id: n.id,
        channel: n.channel,
        provider: n.provider,
        recipient: n.recipient,
        template: n.template,
        body: n.body,
        ok: n.ok,
        ref: n.ref,
        errorCode: n.errorCode,
        errorBody: n.errorBody,
        createdAt: n.createdAt,
      })),
      events: events.map((e) => ({
        id: e.id,
        event: e.event,
        source: e.source,
        userId: e.userId,
        value: e.value ? Number(e.value) : null,
        currency: e.currency,
        reference: e.reference,
        results: e.results,
        createdAt: e.createdAt,
      })),
    });
  });
}
