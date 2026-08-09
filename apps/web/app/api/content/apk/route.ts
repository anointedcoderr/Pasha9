// Built by Anointed Coder.
//
// Public APK download details. Single source of truth for every "Download
// App" surface on the site (home section, mobile top strip, mobile drawer),
// so there is exactly one place a stale link could come from.
//
// CACHE BUSTING is the important part here. Operators replace the APK by
// uploading a new file to the SAME path, which leaves the URL byte-identical.
// The browser and Cloudflare both then serve their cached copy, so players
// keep downloading the previous build even though the new one is on disk.
// That is the "users are still getting the old APK" report, and no amount of
// re-checking the links would have found it - the links were always correct.
//
// A version suffix fixes it, the same way the favicon already does it. The
// suffix prefers the operator's apk_version, but falls back to the settings
// row's updatedAt so the cache still breaks when they upload a new file and
// forget to bump the version - which is the common case.

export const dynamic = 'force-dynamic';

import { db } from '@/lib/db/client';
import { jsonOk } from '@/lib/auth/errors';

export async function GET() {
  const rows = await db.systemSetting.findMany({
    where: { key: { in: ['apk_download_url', 'apk_version', 'app_icon_url', 'logo_url', 'favicon_url', 'site_name'] } },
    select: { key: true, value: true, updatedAt: true },
  });

  const map: Record<string, string> = {};
  let urlUpdatedAt: Date | null = null;
  for (const r of rows) {
    if (r.value && r.value.trim()) map[r.key] = r.value.trim();
    if (r.key === 'apk_download_url') urlUpdatedAt = r.updatedAt;
  }

  const rawUrl = map.apk_download_url ?? null;
  const version = map.apk_version ?? null;

  // Only versioned for files we host. An external link (Drive, S3, a
  // shortener) is left exactly as the operator entered it, because appending
  // a query string to someone else's URL can break their signed links.
  let url = rawUrl;
  if (rawUrl && rawUrl.startsWith('/')) {
    const stamp = version || (urlUpdatedAt ? String(urlUpdatedAt.getTime()) : '');
    if (stamp) {
      const sep = rawUrl.includes('?') ? '&' : '?';
      url = `${rawUrl}${sep}v=${encodeURIComponent(stamp)}`;
    }
  }

  return jsonOk({
    url,
    version,
    // The download surfaces show a small app icon and the brand name next to
    // the label. Served from here so they use the operator's real uploaded
    // artwork instead of a hardcoded placeholder, and so they do not need a
    // second request.
    //
    // app_icon_url wins because that slot is a small SQUARE. The logo is a wide
    // wordmark and letterboxes badly at that size, which is why the operator
    // asked for a different image here than the one on the header. Falls back
    // to the logo, then the favicon, so a site that never sets it still shows
    // something real.
    iconUrl: map.app_icon_url ?? map.logo_url ?? map.favicon_url ?? null,
    siteName: map.site_name ?? null,
  });
}
