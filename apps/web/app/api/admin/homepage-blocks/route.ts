// Built by Anointed Coder.
//
// GET  /api/admin/homepage-blocks   list every homepage game block
// POST /api/admin/homepage-blocks   create a new block
//
// Each block defines its own title + subtitle and chooses how to fill
// itself: manual (curated items), category, brand, jackpot, featured.
// The /api/content/homepage-sections public endpoint stitches blocks
// together with the legacy PublicSection rows on the homepage.

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAuth, ensurePermission, recordActivity } from '@/lib/auth/guard';
import { getCurrentSession } from '@/lib/auth/rbac';
import { jsonError, jsonOk } from '@/lib/auth/errors';
import { db } from '@/lib/db/client';

const SOURCE_TYPES = ['manual', 'category', 'brand', 'jackpot', 'featured'] as const;

const createSchema = z.object({
  key: z.string().trim().min(2).max(60).regex(/^[a-z0-9_-]+$/, 'lowercase letters, digits, _ and - only'),
  titleEn: z.string().trim().min(1).max(120),
  titleBn: z.string().trim().max(200).optional().nullable(),
  subtitleEn: z.string().trim().max(200).optional().nullable(),
  subtitleBn: z.string().trim().max(200).optional().nullable(),
  sourceType: z.enum(SOURCE_TYPES).default('manual'),
  category: z.string().trim().max(60).optional().nullable(),
  brandId: z.string().trim().max(60).optional().nullable(),
  limit: z.coerce.number().int().min(1).max(30).default(12),
  position: z.coerce.number().int().min(0).max(9999).default(0),
  isVisible: z.boolean().default(true),
  layout: z.string().trim().max(20).default('grid'),
});

export async function GET() {
  return withAuth(async () => {
    await ensurePermission('homepage.write');
    const rows = await db.homepageGameBlock.findMany({
      orderBy: [{ position: 'asc' }, { titleEn: 'asc' }],
      include: { items: { orderBy: { position: 'asc' } } },
    });
    return jsonOk({ blocks: rows });
  });
}

export async function POST(req: NextRequest) {
  return withAuth(async () => {
    await ensurePermission('homepage.write');
    const claims = await getCurrentSession();
    if (!claims) return jsonError(401, 'UNAUTHENTICATED');

    const body = await req.json().catch(() => ({}));
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) return jsonError(400, 'VALIDATION', undefined, { issues: parsed.error.issues });

    const existing = await db.homepageGameBlock.findUnique({ where: { key: parsed.data.key } });
    if (existing) return jsonError(409, 'KEY_TAKEN', `A block with key "${parsed.data.key}" already exists.`);

    if (parsed.data.sourceType === 'category' && !parsed.data.category) {
      return jsonError(400, 'CATEGORY_REQUIRED', 'sourceType=category requires a category value.');
    }
    if (parsed.data.sourceType === 'brand' && !parsed.data.brandId) {
      return jsonError(400, 'BRAND_REQUIRED', 'sourceType=brand requires a brandId.');
    }

    const row = await db.homepageGameBlock.create({
      data: {
        key: parsed.data.key,
        titleEn: parsed.data.titleEn,
        titleBn: parsed.data.titleBn ?? null,
        subtitleEn: parsed.data.subtitleEn ?? null,
        subtitleBn: parsed.data.subtitleBn ?? null,
        sourceType: parsed.data.sourceType,
        category: parsed.data.sourceType === 'category' ? parsed.data.category ?? null : null,
        brandId: parsed.data.sourceType === 'brand' ? parsed.data.brandId ?? null : null,
        limit: parsed.data.limit,
        position: parsed.data.position,
        isVisible: parsed.data.isVisible,
        layout: parsed.data.layout,
      },
    });

    await recordActivity({
      actorId: claims.sub,
      actorRole: claims.role,
      action: 'HOMEPAGE_BLOCK_CREATE',
      target: row.id,
      meta: { key: row.key, sourceType: row.sourceType },
    });
    return jsonOk({ block: row }, 201);
  });
}
