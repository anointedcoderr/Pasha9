// Built by Anointed Coder.
//
// Public Jackpot config. Reads the keyed SystemSetting rows the admin
// edits in /admin/website -> Jackpot. Sensible defaults are returned
// for any key that is missing or empty so the public JackpotStrip
// continues to render the existing premium card even before the
// operator touches it.

export const dynamic = 'force-dynamic';

import { db } from '@/lib/db/client';
import { jsonOk } from '@/lib/auth/errors';

export const revalidate = 30;

const KEYS = [
  'jackpot_enabled',
  'jackpot_title',
  'jackpot_subtitle',
  'jackpot_bg_url',
  'jackpot_mini_title',
  'jackpot_mini_icon_url',
  'jackpot_mini_value',
  'jackpot_grand_title',
  'jackpot_grand_icon_url',
  'jackpot_grand_value',
  'jackpot_major_title',
  'jackpot_major_icon_url',
  'jackpot_major_value',
] as const;

type Key = typeof KEYS[number];

function num(v?: string): number | null {
  if (!v) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function bool(v?: string, fallback = true): boolean {
  if (v === undefined || v === '') return fallback;
  return v === '1' || v.toLowerCase() === 'true' || v.toLowerCase() === 'yes';
}

export async function GET() {
  const rows = await db.systemSetting.findMany({ where: { key: { in: [...KEYS] } } });
  const map = new Map<Key, string>();
  for (const r of rows) {
    if (r.value !== null && r.value !== undefined) map.set(r.key as Key, String(r.value).trim());
  }

  return jsonOk({
    enabled: bool(map.get('jackpot_enabled'), true),
    title: map.get('jackpot_title') ?? null,
    subtitle: map.get('jackpot_subtitle') ?? null,
    backgroundUrl: map.get('jackpot_bg_url') ?? null,
    mini: {
      title: map.get('jackpot_mini_title') ?? null,
      iconUrl: map.get('jackpot_mini_icon_url') ?? null,
      value: num(map.get('jackpot_mini_value')),
    },
    grand: {
      title: map.get('jackpot_grand_title') ?? null,
      iconUrl: map.get('jackpot_grand_icon_url') ?? null,
      value: num(map.get('jackpot_grand_value')),
    },
    major: {
      title: map.get('jackpot_major_title') ?? null,
      iconUrl: map.get('jackpot_major_icon_url') ?? null,
      value: num(map.get('jackpot_major_value')),
    },
  });
}
