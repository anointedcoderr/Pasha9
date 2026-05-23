// Built by Anointed Coder.

export const dynamic = 'force-dynamic';

import { db } from '@/lib/db/client';
import { jsonOk } from '@/lib/auth/errors';

const PUBLIC_KEYS = ['support_telegram', 'support_whatsapp', 'support_email', 'site_name'] as const;

export async function GET() {
  const rows = await db.systemSetting.findMany({
    where: { key: { in: [...PUBLIC_KEYS] } },
  });
  const map: Record<string, string> = {};
  for (const r of rows) {
    if (r.value && r.value.trim()) map[r.key] = r.value.trim();
  }
  return jsonOk({
    siteName: map.site_name ?? 'Pasha 9',
    telegram: map.support_telegram ?? null,
    whatsapp: map.support_whatsapp ?? null,
    email: map.support_email ?? null,
  });
}
