// Built by Anointed Coder.

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db/client';
import { withAuth, ensurePermission, recordActivity } from '@/lib/auth/guard';
import { jsonError, jsonOk } from '@/lib/auth/errors';

// Image-only banners are allowed: every text field accepts empty
// strings so the operator can save a banner with just an uploaded
// image. The public PromotionBannerSlider renders the title /
// subtitle blocks conditionally based on whether the value is a
// non-empty string after trim.
const createSchema = z.object({
  titleEn: z.string().trim().max(120).optional().default(''),
  titleBn: z.string().trim().max(120).optional().nullable(),
  subtitleEn: z.string().trim().max(280).optional().nullable(),
  subtitleBn: z.string().trim().max(280).optional().nullable(),
  imageUrl: z.string().trim().max(600).optional().nullable(),
  ctaUrl: z.string().trim().max(600).optional().nullable(),
  sortOrder: z.coerce.number().int().min(0).max(9999).optional(),
  isActive: z.boolean().optional().default(true),
});

const reorderSchema = z.object({
  ids: z.array(z.string().min(1).max(60)).min(1).max(50),
});

export async function GET() {
  return withAuth(async () => {
    await ensurePermission('bonuses.write');
    const banners = await db.promotionBanner.findMany({
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
    return jsonOk({ banners });
  });
}
export async function POST(req: NextRequest) {
  return withAuth(async () => {
    const session = await ensurePermission('bonuses.write');
    const body = await req.json().catch(() => ({}));
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) return jsonError(400, 'VALIDATION', undefined, { issues: parsed.error.issues });
    const max = (await db.promotionBanner.aggregate({ _max: { sortOrder: true } }))._max.sortOrder ?? 0;
    const banner = await db.promotionBanner.create({
      data: {
        ...parsed.data,
        titleBn: parsed.data.titleBn ?? null,
        subtitleEn: parsed.data.subtitleEn ?? null,
        subtitleBn: parsed.data.subtitleBn ?? null,
        imageUrl: parsed.data.imageUrl ?? null,
        ctaUrl: parsed.data.ctaUrl ?? null,
        sortOrder: parsed.data.sortOrder ?? max + 10,
      },
    });
    await recordActivity({
      actorId: session.sub,
      actorRole: session.role,
      action: 'PROMOTION_BANNER_CREATE',
      target: banner.id,
      meta: { titleEn: banner.titleEn },
    });
    return jsonOk({ banner }, 201);
  });
}

export async function PUT(req: NextRequest) {
  return withAuth(async () => {
    const session = await ensurePermission('bonuses.write');
    const body = await req.json().catch(() => ({}));
    const parsed = reorderSchema.safeParse(body);
    if (!parsed.success) return jsonError(400, 'VALIDATION', undefined, { issues: parsed.error.issues });
    const existing = await db.promotionBanner.findMany({ select: { id: true } });
    const known = new Set(existing.map((row) => row.id));
    for (const id of parsed.data.ids) {
      if (!known.has(id)) return jsonError(404, 'BANNER_NOT_FOUND', `Banner ${id} not found`);
    }
    await db.$transaction(
      parsed.data.ids.map((id, index) =>
        db.promotionBanner.update({ where: { id }, data: { sortOrder: (index + 1) * 10 } }),
      ),
    );
    await recordActivity({
      actorId: session.sub,
      actorRole: session.role,
      action: 'PROMOTION_BANNER_REORDER',
      target: 'promotion_banner',
      meta: { count: parsed.data.ids.length },
    });
    return jsonOk({ ok: true });
  });
}
