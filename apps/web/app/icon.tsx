// Built by Anointed Coder.
//
// Dynamic /icon route. Returns a redirect to the operator-uploaded
// favicon (with the SystemSetting favicon_version appended as a
// cache-bust query) and pins the response with no-store cache
// headers so the redirect itself never gets pinned by an upstream
// proxy / CDN / browser. The legacy /favicon.ico path is rewritten
// to /icon (next.config.mjs) so probes at both routes land here.

import { db } from '@/lib/db/client';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const NO_CACHE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
  Pragma: 'no-cache',
  Expires: '0',
} as const;

export default async function Icon() {
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
