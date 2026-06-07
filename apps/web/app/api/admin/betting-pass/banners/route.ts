// Built by Anointed Coder.
//
// GET  /api/admin/betting-pass/banners        list all banners
// POST /api/admin/betting-pass/banners        create one
// PUT  /api/admin/betting-pass/banners        body { ids: string[] }  atomic reorder

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db/client';
import { withAuth, ensurePermission, recordActivity } from '@/lib/auth/guard';
import { jsonError, jsonOk } from '@/lib/auth/errors';

const createSchema = z.object({
  titleEn: z.string().trim().min(1).max(120),
  titleBn: z.string().trim().max(120).optional().nullable(),
  subtitleEn: z.string().trim().max(280).optional().nullable(),
  subtitleBn: z.string().trim().max(280).optional().nullable(),
  imageUrl: z.string().trim().max(600).optional().nullable(),
  ctaUrl: z.string().trim().max(600).optional().nullable(),
  sortOrder: z.coerce.number().int().min(0).max(9999).optional().default(0),
  isActive: z.boolean().optional().default(true),
});

const reorderSchema = z.object({
  ids: z.array(z.string().min(1).max(60)).min(1).max(50),
});

export async function GET() {
  return withAuth(async () => {
    await ensurePermission('rewards.write');
    const banners = await db.bettingPassBanner.findMany({
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
    return jsonOk({ banners });
  });
}

export async function POST(req: NextRequest) {
  return withAuth(async () => {
    const session = await ensurePermission('rewards.write');
    const body = await req.json().catch(() => ({}));
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) return jsonError(400, 'VALIDATION', undefined, { issues: parsed.error.issues });
    const max = (await db.bettingPassBanner.aggregate({ _max: { sortOrder: true } }))._max.sortOrder ?? 0;
    const banner = await db.bettingPassBanner.create({
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
      action: 'BETTING_PASS_BANNER_CREATE',
      target: banner.id,
      meta: { titleEn: banner.titleEn },
    });
    return jsonOk({ banner }, 201);
  });
}

export async function PUT(req: NextRequest) {
  return withAuth(async () => {
    const session = await ensurePermission('rewards.write');
    const body = await req.json().catch(() => ({}));
    const parsed = reorderSchema.safeParse(body);
    if (!parsed.success) return jsonError(400, 'VALIDATION', undefined, { issues: parsed.error.issues });
    const { ids } = parsed.data;
    const existing = await db.bettingPassBanner.findMany({ select: { id: true } });
    const knownIds = new Set(existing.map((r) => r.id));
    for (const id of ids) {
      if (!knownIds.has(id)) return jsonError(404, 'BANNER_NOT_FOUND', `Banner ${id} not found`);
    }
    await db.$transaction(
      ids.map((id, idx) =>
        db.bettingPassBanner.update({ where: { id }, data: { sortOrder: (idx + 1) * 10 } }),
      ),
    );
    await recordActivity({
      actorId: session.sub,
      actorRole: session.role,
      action: 'BETTING_PASS_BANNER_REORDER',
      target: 'betting_pass_banner',
      meta: { count: ids.length },
    });
    return jsonOk({ ok: true });
  });
}
