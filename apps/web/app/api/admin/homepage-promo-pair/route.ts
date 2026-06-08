// Built by Anointed Coder.
//
// GET  /api/admin/homepage-promo-pair   read current values
// PUT  /api/admin/homepage-promo-pair   bulk upsert
//
// Stores the homepage two-card promo strip (Refer and Earn, Exclusive
// Betting Pass) as SystemSetting rows so the operator can rebrand the
// homepage without a code deploy.

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db/client';
import { withAuth, ensurePermission, recordActivity } from '@/lib/auth/guard';
import { jsonError, jsonOk } from '@/lib/auth/errors';

const optionalText = z.string().trim().max(500).optional().nullable().transform((v) => (v == null ? null : v));
const optionalUrl = z.string().trim().max(600).optional().nullable().transform((v) => (v == null ? null : v));

const slotSchema = z.object({
  kickerEn: optionalText,
  kickerBn: optionalText,
  titleEn: optionalText,
  titleBn: optionalText,
  bodyEn: optionalText,
  bodyBn: optionalText,
  ctaEn: optionalText,
  ctaBn: optionalText,
  href: optionalUrl,
  imageUrl: optionalUrl,
});

const putSchema = z.object({ refer: slotSchema, pass: slotSchema });

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
] as const;

export async function GET() {
  return withAuth(async () => {
    await ensurePermission('settings.read');
    const rows = await db.systemSetting.findMany({ where: { key: { in: [...KEYS] } } });
    const map: Record<string, string> = {};
    for (const r of rows) if (r.value) map[r.key] = r.value;
    return jsonOk({ values: map });
  });
}

export async function PUT(req: NextRequest) {
  return withAuth(async () => {
    const session = await ensurePermission('settings.write');
    const body = await req.json().catch(() => ({}));
    const parsed = putSchema.safeParse(body);
    if (!parsed.success) return jsonError(400, 'VALIDATION', undefined, { issues: parsed.error.issues });
    const data = parsed.data;

    const writes: Array<{ key: (typeof KEYS)[number]; value: string }> = [
      { key: 'promo_pair_refer_kicker_en', value: data.refer.kickerEn ?? '' },
      { key: 'promo_pair_refer_kicker_bn', value: data.refer.kickerBn ?? '' },
      { key: 'promo_pair_refer_title_en', value: data.refer.titleEn ?? '' },
      { key: 'promo_pair_refer_title_bn', value: data.refer.titleBn ?? '' },
      { key: 'promo_pair_refer_body_en', value: data.refer.bodyEn ?? '' },
      { key: 'promo_pair_refer_body_bn', value: data.refer.bodyBn ?? '' },
      { key: 'promo_pair_refer_cta_en', value: data.refer.ctaEn ?? '' },
      { key: 'promo_pair_refer_cta_bn', value: data.refer.ctaBn ?? '' },
      { key: 'promo_pair_refer_href', value: data.refer.href ?? '' },
      { key: 'promo_pair_refer_image_url', value: data.refer.imageUrl ?? '' },
      { key: 'promo_pair_pass_kicker_en', value: data.pass.kickerEn ?? '' },
      { key: 'promo_pair_pass_kicker_bn', value: data.pass.kickerBn ?? '' },
      { key: 'promo_pair_pass_title_en', value: data.pass.titleEn ?? '' },
      { key: 'promo_pair_pass_title_bn', value: data.pass.titleBn ?? '' },
      { key: 'promo_pair_pass_body_en', value: data.pass.bodyEn ?? '' },
      { key: 'promo_pair_pass_body_bn', value: data.pass.bodyBn ?? '' },
      { key: 'promo_pair_pass_cta_en', value: data.pass.ctaEn ?? '' },
      { key: 'promo_pair_pass_cta_bn', value: data.pass.ctaBn ?? '' },
      { key: 'promo_pair_pass_href', value: data.pass.href ?? '' },
      { key: 'promo_pair_pass_image_url', value: data.pass.imageUrl ?? '' },
    ];

    await db.$transaction(
      writes.map((w) =>
        db.systemSetting.upsert({
          where: { key: w.key },
          create: { key: w.key, value: w.value },
          update: { value: w.value },
        }),
      ),
    );

    await recordActivity({
      actorId: session.sub,
      actorRole: session.role,
      action: 'HOMEPAGE_PROMO_PAIR_UPDATE',
      target: 'homepage_promo_pair',
      meta: { keys: writes.length },
    });

    return jsonOk({ ok: true });
  });
}
