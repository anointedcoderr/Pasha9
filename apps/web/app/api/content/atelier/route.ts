// Built by Anointed Coder.
//
// GET /api/content/atelier
//
// Returns the operator-uploaded URL for every premium asset slot
// (hero backdrops, tier crests, lottery balls, textures). Empty
// slots return null so client components fall back to CSS-only
// rendering.

export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { db } from '@/lib/db/client';
import { jsonOk } from '@/lib/auth/errors';
import { ATELIER_SLOTS } from '@/lib/atelier/slots';

const KEYS = ATELIER_SLOTS.map((s) => s.key);

export async function GET() {
  const rows = await db.systemSetting
    .findMany({ where: { key: { in: KEYS } } })
    .catch(() => [] as Array<{ key: string; value: string | null }>);
  const map: Record<string, string> = {};
  for (const r of rows) if (r.value && r.value.trim()) map[r.key] = r.value.trim();
  const assets: Record<string, string | null> = {};
  for (const slot of ATELIER_SLOTS) assets[slot.id] = map[slot.key] || null;
  return jsonOk({ assets });
}
