// Built by Anointed Coder.
//
// Dynamic /apple-icon route. Mirrors /icon for Safari and iOS
// bookmark / Home Screen flows. Strong no-cache headers so the
// redirect itself does not pin to an upstream proxy. iOS still
// caches the Home Screen icon snapshot aggressively once the PWA
// is installed; a reinstall picks up the new icon.

import { db } from '@/lib/db/client';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const NO_CACHE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
  Pragma: 'no-cache',
  Expires: '0',
} as const;

export default async function AppleIcon() {
  const rows = await db.systemSetting
    .findMany({ where: { key: { in: ['favicon_url', 'favicon_version'] } } })
    .catch(() => [] as Array<{ key: string; value: string | null }>);
  const map: Record<string, string> = {};
  for (const r of rows) if (r.value && r.value.trim()) map[r.key] = r.value.trim();
  const base = map.favicon_url ?? '/favicon.svg';
  const version = map.favicon_version ?? '1';
  const target = base === '/favicon.svg'
    ? base
    : `${base}${base.includes('?') ? '&' : '?'}v=${encodeURIComponent(version)}`;
  return new Response(null, {
    status: 302,
    headers: {
      Location: target,
      ...NO_CACHE_HEADERS,
    },
  });
}
