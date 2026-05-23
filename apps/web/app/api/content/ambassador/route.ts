// Built by Anointed Coder.

export const dynamic = 'force-dynamic';

import { db } from '@/lib/db/client';
import { jsonOk } from '@/lib/auth/errors';

const KEYS = [
  'ambassador_name',
  'ambassador_caption',
  'ambassador_image_url',
  'ambassador_active',
  'video_promo_title',
  'video_promo_caption',
  'video_promo_url',
  'video_promo_poster_url',
];

export async function GET() {
  const rows = await db.systemSetting.findMany({ where: { key: { in: KEYS } } });
  const v: Record<string, string> = {};
  for (const r of rows) v[r.key] = r.value ?? '';
  const active = v.ambassador_active !== 'false';
  return jsonOk({
    active,
    ambassador: {
      name: v.ambassador_name || null,
      caption: v.ambassador_caption || null,
      imageUrl: v.ambassador_image_url || null,
    },
    video: {
      title: v.video_promo_title || null,
      caption: v.video_promo_caption || null,
      url: v.video_promo_url || null,
      posterUrl: v.video_promo_poster_url || null,
    },
  });
}
