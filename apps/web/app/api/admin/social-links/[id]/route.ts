// Built by Anointed Coder.
//
// PATCH  /api/admin/social-links/[id]   edit one
// DELETE /api/admin/social-links/[id]   remove one

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db/client';
import { withAuth, ensurePermission, recordActivity } from '@/lib/auth/guard';
import { jsonError, jsonOk } from '@/lib/auth/errors';

const PLATFORMS = ['telegram', 'whatsapp', 'facebook', 'youtube', 'instagram', 'twitter', 'tiktok', 'linkedin', 'discord', 'snapchat', 'pinterest', 'email', 'custom'] as const;

const patchSchema = z.object({
  platform: z.enum(PLATFORMS).optional(),
  label: z.string().trim().min(1).max(60).optional(),
  labelBn: z.string().trim().max(60).optional().nullable(),
  url: z.string().trim().min(1).max(500).optional(),
  iconUrl: z.string().trim().max(500).optional().nullable(),
  sortOrder: z.coerce.number().int().min(0).max(9999).optional(),
  isActive: z.boolean().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  return withAuth(async () => {
    const session = await ensurePermission('settings.write');
    const body = await req.json().catch(() => ({}));
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) return jsonError(400, 'VALIDATION', undefined, { issues: parsed.error.issues });
    const existing = await db.socialLink.findUnique({ where: { id: params.id } });
    if (!existing) return jsonError(404, 'NOT_FOUND');
    const link = await db.socialLink.update({ where: { id: params.id }, data: parsed.data });
    await recordActivity({
      actorId: session.sub,
      actorRole: session.role,
      action: 'SOCIAL_LINK_PATCH',
      target: link.id,
      meta: { changes: parsed.data },
    });
    return jsonOk({ link });
  });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  return withAuth(async () => {
    const session = await ensurePermission('settings.write');
    const existing = await db.socialLink.findUnique({ where: { id: params.id } });
    if (!existing) return jsonError(404, 'NOT_FOUND');
    await db.socialLink.delete({ where: { id: params.id } });
    await recordActivity({
      actorId: session.sub,
      actorRole: session.role,
      action: 'SOCIAL_LINK_DELETE',
      target: params.id,
      meta: { platform: existing.platform, label: existing.label },
    });
    return jsonOk({ ok: true });
  });
}
