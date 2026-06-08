// Built by Anointed Coder.
//
// GET /api/content/homepage-promo-pair
//
// Public read of the two homepage marketing cards (Refer and Earn,
// Exclusive Betting Pass). Values live under SystemSetting keys
// prefixed promo_pair_refer_* and promo_pair_pass_*. The public page
// always renders; empty values fall back to bundled i18n + svg art.

export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { db } from '@/lib/db/client';
import { jsonOk } from '@/lib/auth/errors';

const KEYS = [
  'promo_pair_refer_kicker_en',
  'promo_pair_refer_kicker_bn',
  'promo_pair_refer_title_en',
  'promo_pair_refer_title_bn',
  'promo_pair_refer_body_en',
  'promo_pair_refer_body_bn',
  'promo_pair_refer_cta_en',
  'promo_pair_refer_cta_bn',
  'promo_pair_refer_href',
  'promo_pair_refer_image_url',
  'promo_pair_refer_image_only',
  'promo_pair_refer_overlay_enabled',
  'promo_pair_pass_kicker_en',
  'promo_pair_pass_kicker_bn',
  'promo_pair_pass_title_en',
  'promo_pair_pass_title_bn',
  'promo_pair_pass_body_en',
  'promo_pair_pass_body_bn',
  'promo_pair_pass_cta_en',
  'promo_pair_pass_cta_bn',
  'promo_pair_pass_href',
  'promo_pair_pass_image_url',
  'promo_pair_pass_image_only',
  'promo_pair_pass_overlay_enabled',
] as const;

function bool(v: string | undefined, fallback: boolean): boolean {
  if (v == null) return fallback;
  const t = v.trim().toLowerCase();
  if (t === '') return fallback;
  return t === '1' || t === 'true' || t === 'on';
}

function get(map: Record<string, string>, key: string): string | null {
  const v = map[key];
  return v && v.trim() ? v.trim() : null;
}

export async function GET() {
  const rows = await db.systemSetting
    .findMany({ where: { key: { in: [...KEYS] } } })
    .catch(() => [] as Array<{ key: string; value: string | null }>);
  const map: Record<string, string> = {};
  for (const r of rows) if (r.value) map[r.key] = r.value;

  return jsonOk({
    refer: {
      kicker: get(map, 'promo_pair_refer_kicker_en'),
      kickerBn: get(map, 'promo_pair_refer_kicker_bn'),
      title: get(map, 'promo_pair_refer_title_en'),
      titleBn: get(map, 'promo_pair_refer_title_bn'),
      body: get(map, 'promo_pair_refer_body_en'),
      bodyBn: get(map, 'promo_pair_refer_body_bn'),
      cta: get(map, 'promo_pair_refer_cta_en'),
      ctaBn: get(map, 'promo_pair_refer_cta_bn'),
      href: get(map, 'promo_pair_refer_href'),
      imageUrl: get(map, 'promo_pair_refer_image_url'),
      imageOnly: bool(map.promo_pair_refer_image_only, false),
      overlayEnabled: bool(map.promo_pair_refer_overlay_enabled, true),
    },
    pass: {
      kicker: get(map, 'promo_pair_pass_kicker_en'),
      kickerBn: get(map, 'promo_pair_pass_kicker_bn'),
      title: get(map, 'promo_pair_pass_title_en'),
      titleBn: get(map, 'promo_pair_pass_title_bn'),
      body: get(map, 'promo_pair_pass_body_en'),
      bodyBn: get(map, 'promo_pair_pass_body_bn'),
      cta: get(map, 'promo_pair_pass_cta_en'),
      ctaBn: get(map, 'promo_pair_pass_cta_bn'),
      href: get(map, 'promo_pair_pass_href'),
      imageUrl: get(map, 'promo_pair_pass_image_url'),
      imageOnly: bool(map.promo_pair_pass_image_only, false),
      overlayEnabled: bool(map.promo_pair_pass_overlay_enabled, true),
    },
  });
}
