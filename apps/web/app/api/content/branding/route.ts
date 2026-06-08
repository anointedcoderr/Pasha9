// Built by Anointed Coder.
//
// Public branding feed: logo URL, favicon URL and the display site
// name. Set via /admin/website -> Logo & Favicon. Components like the
// Logo and root layout favicon read this so the operator can swap
// brand visuals without a code deploy.

export const dynamic = 'force-dynamic';

import { db } from '@/lib/db/client';
import { jsonOk } from '@/lib/auth/errors';

const KEYS = ['site_name', 'logo_url', 'favicon_url', 'favicon_version'] as const;

function withVersion(url: string | null, version: string | null): string | null {
  if (!url) return null;
  if (!version) return url;
  if (!url.startsWith('/uploads/') && !/^https?:\/\//i.test(url)) return url;
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}v=${encodeURIComponent(version)}`;
}

export async function GET() {
  const rows = await db.systemSetting.findMany({ where: { key: { in: [...KEYS] } } });
  const map: Record<string, string> = {};
  for (const r of rows) {
    if (r.value && r.value.trim()) map[r.key] = r.value.trim();
  }
  const version = map.favicon_version || null;
  return jsonOk({
    siteName: map.site_name ?? 'Pasha 9',
    logoUrl: map.logo_url ?? null,
    faviconUrl: withVersion(map.favicon_url ?? null, version),
    faviconVersion: version,
  });
}
