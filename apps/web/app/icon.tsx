// Built by Anointed Coder.
//
// Dynamic /icon route. Next.js looks up this file at request time and
// serves the resolved favicon as the canonical browser-tab icon for
// every page. We redirect to the operator-uploaded /uploads/branding
// asset when it exists so a hard refresh always lands on the latest
// upload; the cache-bust query is generated server-side from the
// SystemSetting favicon_version key.
//
// Falls back to the in-repo /favicon.svg when no admin upload exists
// so a fresh database still renders a polished icon.

import { redirect } from 'next/navigation';
import { db } from '@/lib/db/client';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function Icon() {
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
