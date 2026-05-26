// Built by Anointed Coder.
//
// Public read of the web-pixel IDs. Returns ONLY the non-secret
// fields the browser needs to fire pixel snippets (FB pixel id,
// TikTok pixel code, GA4 measurement id, Google Ads conversion id).
// Server-side tokens (CAPI tokens, GA4 API secret) stay private and
// are loaded by the dispatcher in lib/tracking.

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

import { db } from '@/lib/db/client';
import { jsonOk } from '@/lib/auth/errors';

const PUBLIC_KEYS = [
  'pixel_facebook',
  'pixel_tiktok',
  'analytics_ga4',
  'analytics_google_ads',
  'analytics_google_ads_conv_label',
];

export async function GET() {
  const rows = await db.systemSetting.findMany({
    where: { key: { in: PUBLIC_KEYS } },
    select: { key: true, value: true },
  });
  const map = new Map(rows.map((r) => [r.key, (r.value ?? '').trim()]));
  return jsonOk({
    facebook: map.get('pixel_facebook') || null,
    tiktok: map.get('pixel_tiktok') || null,
    ga4: map.get('analytics_ga4') || null,
    googleAds: map.get('analytics_google_ads') || null,
    googleAdsConversionLabel: map.get('analytics_google_ads_conv_label') || null,
  });
}
