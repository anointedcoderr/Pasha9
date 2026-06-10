// Built by Anointed Coder.
//
// GET  /api/admin/lotto-banners   list every row (active + hidden)
// POST /api/admin/lotto-banners   create one
// PUT  /api/admin/lotto-banners   body { ids: string[] } atomic reorder
//
// Mirrors the homepage-videos admin contract so the editor UI can
// follow the same Move Up / Move Down / Toggle / Edit / Delete flow.

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db/client';
import { withAuth, ensurePermission, recordActivity } from '@/lib/auth/guard';
import { jsonError, jsonOk } from '@/lib/auth/errors';

const KIND = z.enum(['image', 'video']);

const createSchema = z
  .object({
    kind: KIND.default('image'),
    imageUrl: z.string().trim().max(500).optional().nullable(),
    videoUrl: z.string().trim().max(500).optional().nullable(),
    posterUrl: z.string().trim().max(500).optional().nullable(),
    titleEn: z.string().trim().max(160).optional().nullable(),
    titleBn: z.string().trim().max(160).optional().nullable(),
    ctaUrl: z.string().trim().max(500).optional().nullable(),
    autoplay: z.boolean().optional().default(true),
    muted: z.boolean().optional().default(true),
    loop: z.boolean().optional().default(true),
    sortOrder: z.coerce.number().int().min(0).max(9999).optional().default(0),
    isActive: z.boolean().optional().default(true),
  })
  .refine(
    (d) => (d.kind === 'image' ? Boolean(d.imageUrl) : Boolean(d.videoUrl)),
    'An image URL is required for kind=image; a video URL is required for kind=video.',
  );

const reorderSchema = z.object({
  ids: z.array(z.string().min(1).max(60)).min(1).max(50),
});

export async function GET() {
  return withAuth(async () => {
    await ensurePermission('homepage.write');
    const rows = await db.lottoBanner.findMany({
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
    return jsonOk({ banners: rows });
  });
}

export async function POST(req: NextRequest) {
  return withAuth(async () => {
    const session = await ensurePermission('homepage.write');
    const body = await req.json().catch(() => ({}));
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) return jsonError(400, 'VALIDATION', undefined, { issues: parsed.error.issues });
    const data = parsed.data;

    const max = (await db.lottoBanner.aggregate({ _max: { sortOrder: true } }))._max.sortOrder ?? 0;

    const created = await db.lottoBanner.create({
      data: {
        kind: data.kind,
        imageUrl: data.kind === 'image' ? data.imageUrl ?? null : null,
        videoUrl: data.kind === 'video' ? data.videoUrl ?? null : null,
        posterUrl: data.posterUrl ?? null,
        titleEn: data.titleEn ?? null,
        titleBn: data.titleBn ?? null,
        ctaUrl: data.ctaUrl ?? null,
        autoplay: data.autoplay,
        muted: data.muted,
        loop: data.loop,
        sortOrder: data.sortOrder ?? max + 10,
        isActive: data.isActive,
      },
    });

    await recordActivity({
      actorId: session.sub,
      actorRole: session.role,
      action: 'LOTTO_BANNER_CREATE',
      target: created.id,
      detail: created.titleEn ?? created.kind,
    });

    return jsonOk({ banner: created }, 201);
  });
}

export async function PUT(req: NextRequest) {
  return withAuth(async () => {
    const session = await ensurePermission('homepage.write');
    const body = await req.json().catch(() => ({}));
    const parsed = reorderSchema.safeParse(body);
    if (!parsed.success) return jsonError(400, 'VALIDATION', undefined, { issues: parsed.error.issues });
    const { ids } = parsed.data;
    const existing = await db.lottoBanner.findMany({ select: { id: true } });
    const known = new Set(existing.map((r) => r.id));
    for (const id of ids) {
      if (!known.has(id)) return jsonError(404, 'BANNER_NOT_FOUND', `Banner ${id} not found`);
    }
    await db.$transaction(
      ids.map((id, idx) =>
        db.lottoBanner.update({ where: { id }, data: { sortOrder: (idx + 1) * 10 } }),
      ),
    );
    await recordActivity({
      actorId: session.sub,
      actorRole: session.role,
      action: 'LOTTO_BANNER_REORDER',
      target: 'lotto_banner',
      meta: { count: ids.length },
    });
    return jsonOk({ ok: true });
  });
}
