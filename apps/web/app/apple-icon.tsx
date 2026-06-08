// Built by Anointed Coder.
//
// Dynamic /apple-icon route. Mirrors the /icon resolver above so
// Safari and iOS bookmark/Home Screen flows pick up the admin
// uploaded asset. iOS does its own aggressive caching once the PWA
// is installed; a reinstall picks up the new icon.

import { redirect } from 'next/navigation';
import { db } from '@/lib/db/client';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function AppleIcon() {
  const rows = await db.systemSetting
    .findMany({ where: { key: { in: ['favicon_url', 'favicon_version'] } } })
    .catch(() => [] as Array<{ key: string; value: string | null }>);
  const map: Record<string, string> = {};
  for (const r of rows) if (r.value && r.value.trim()) map[r.key] = r.value.trim();
  const base = map.favicon_url ?? '/favicon.svg';
  const version = map.favicon_version ?? '1';
  if (base === '/favicon.svg') redirect(base);
  const sep = base.includes('?') ? '&' : '?';
  redirect(`${base}${sep}v=${encodeURIComponent(version)}`);
}
