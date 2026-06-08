// Built by Anointed Coder.
//
// GET  /api/admin/social-links        list all links
// POST /api/admin/social-links        create one
// PUT  /api/admin/social-links        body { ids: string[] }  atomic reorder

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db/client';
import { withAuth, ensurePermission, recordActivity } from '@/lib/auth/guard';
import { jsonError, jsonOk } from '@/lib/auth/errors';

const PLATFORMS = ['telegram', 'whatsapp', 'facebook', 'youtube', 'instagram', 'twitter', 'tiktok', 'linkedin', 'discord', 'snapchat', 'pinterest', 'email', 'custom'] as const;

const createSchema = z.object({
  platform: z.enum(PLATFORMS),
  label: z.string().trim().min(1).max(60),
  labelBn: z.string().trim().max(60).optional().nullable(),
  url: z.string().trim().min(1).max(500),
  iconUrl: z.string().trim().max(500).optional().nullable(),
  sortOrder: z.coerce.number().int().min(0).max(9999).optional().default(0),
  isActive: z.boolean().optional().default(true),
});

const reorderSchema = z.object({
  ids: z.array(z.string().min(1).max(60)).min(1).max(50),
});

export async function GET() {
  return withAuth(async () => {
    await ensurePermission('settings.read');
    const links = await db.socialLink.findMany({
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
    return jsonOk({ links });
  });
}

export async function POST(req: NextRequest) {
  return withAuth(async () => {
    const session = await ensurePermission('settings.write');
    const body = await req.json().catch(() => ({}));
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) return jsonError(400, 'VALIDATION', undefined, { issues: parsed.error.issues });
    const max = (await db.socialLink.aggregate({ _max: { sortOrder: true } }))._max.sortOrder ?? 0;
    const link = await db.socialLink.create({
      data: {
        ...parsed.data,
        labelBn: parsed.data.labelBn ?? null,
        iconUrl: parsed.data.iconUrl ?? null,
        sortOrder: parsed.data.sortOrder ?? max + 10,
      },
    });
    await recordActivity({
      actorId: session.sub,
      actorRole: session.role,
      action: 'SOCIAL_LINK_CREATE',
      target: link.id,
      meta: { platform: link.platform, label: link.label },
    });
    return jsonOk({ link }, 201);
  });
}

export async function PUT(req: NextRequest) {
  return withAuth(async () => {
    const session = await ensurePermission('settings.write');
    const body = await req.json().catch(() => ({}));
    const parsed = reorderSchema.safeParse(body);
    if (!parsed.success) return jsonError(400, 'VALIDATION', undefined, { issues: parsed.error.issues });
    const { ids } = parsed.data;
    const existing = await db.socialLink.findMany({ select: { id: true } });
    const knownIds = new Set(existing.map((r) => r.id));
    for (const id of ids) {
      if (!knownIds.has(id)) return jsonError(404, 'LINK_NOT_FOUND', `Social link ${id} not found`);
    }
    await db.$transaction(
      ids.map((id, idx) =>
        db.socialLink.update({ where: { id }, data: { sortOrder: (idx + 1) * 10 } }),
      ),
    );
    await recordActivity({
      actorId: session.sub,
      actorRole: session.role,
      action: 'SOCIAL_LINK_REORDER',
      target: 'social_link',
      meta: { count: ids.length },
    });
    return jsonOk({ ok: true });
  });
}
