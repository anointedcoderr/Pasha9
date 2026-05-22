// Built by Anointed Coder.

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db/client';
import { withAuth, ensurePermission, recordActivity } from '@/lib/auth/guard';
import { jsonOk, jsonError } from '@/lib/auth/errors';

const updateSchema = z.object({
  title: z.string().min(1).max(120).optional(),
  titleEn: z.string().max(120).optional().nullable(),
  subtitle: z.string().max(240).optional().nullable(),
  subtitleEn: z.string().max(240).optional().nullable(),
  imageUrl: z.string().max(500).optional().nullable(),
  link: z.string().max(500).optional().nullable(),
  ctaLabel: z.string().max(60).optional().nullable(),
  accent: z.enum(['gold', 'neon', 'mixed', 'royal', 'red']).optional(),
  position: z.coerce.number().int().min(0).max(99).optional(),
  status: z.enum(['active', 'hidden', 'paused']).optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  return withAuth(async () => {
    const session = await ensurePermission('banners.write');
    const body = await req.json().catch(() => ({}));
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) return jsonError(400, 'VALIDATION', undefined, { issues: parsed.error.issues });
    const banner = await db.banner.update({ where: { id: params.id }, data: parsed.data });
    await recordActivity({ actorId: session.sub, actorRole: session.role, action: 'BANNER_UPDATE', target: banner.id });
    return jsonOk({ banner });
  });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  return withAuth(async () => {
    const session = await ensurePermission('banners.write');
    await db.banner.delete({ where: { id: params.id } });
    await recordActivity({ actorId: session.sub, actorRole: session.role, action: 'BANNER_DELETE', target: params.id });
    return jsonOk({ deleted: true });
  });
}
