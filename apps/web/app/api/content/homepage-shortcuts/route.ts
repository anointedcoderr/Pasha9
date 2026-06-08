// Built by Anointed Coder.
//
// GET /api/content/homepage-shortcuts
//
// Returns the operator-uploaded category-shortcut icon override for
// each homepage shortcut key. Keys not present in SystemSetting are
// omitted; the public CategorySlider falls back to its built-in lucide
// icon for missing keys so the row always renders.

export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { db } from '@/lib/db/client';
import { jsonOk } from '@/lib/auth/errors';

export const SHORTCUT_KEYS = [
  'jackpot',
  'hot',
  'slot',
  'casino',
  'crash',
  'sports',
  'fishing',
  'table',
] as const;

const settingKey = (key: string) => `homepage_shortcut_icon_${key}`;

export async function GET() {
  const rows = await db.systemSetting.findMany({
    where: { key: { in: SHORTCUT_KEYS.map(settingKey) } },
  });
  const icons: Record<string, string> = {};
  for (const r of rows) {
    if (!r.value || !r.value.trim()) continue;
    const k = r.key.replace('homepage_shortcut_icon_', '');
    if ((SHORTCUT_KEYS as readonly string[]).includes(k)) icons[k] = r.value.trim();
  }
  return jsonOk({ icons });
}
