// Built by Anointed Coder.

export const dynamic = 'force-dynamic';

import { db } from '@/lib/db/client';
import { jsonOk } from '@/lib/auth/errors';

export async function GET() {
  const rows = await db.systemSetting.findMany({
    where: { key: { in: ['apk_download_url', 'apk_version'] } },
  });
  const map: Record<string, string> = {};
  for (const r of rows) if (r.value && r.value.trim()) map[r.key] = r.value.trim();
  return jsonOk({
    url: map.apk_download_url ?? null,
    version: map.apk_version ?? null,
  });
}
