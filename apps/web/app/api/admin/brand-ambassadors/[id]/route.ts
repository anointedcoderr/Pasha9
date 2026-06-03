// Built by Anointed Coder.
//
// PATCH  /api/admin/brand-ambassadors/[id]
// DELETE /api/admin/brand-ambassadors/[id]

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db/client';
import { withAuth, ensurePermission, recordActivity } from '@/lib/auth/guard';
import { getCurrentSession } from '@/lib/auth/rbac';
import { jsonError, jsonOk } from '@/lib/auth/errors';

const patchSchema = z.object({
  nameEn: z.string().trim().min(1).max(120).optional(),
  nameBn: z.string().trim().max(120).nullable().optional(),
  iconUrl: z.string().trim().max(500).nullable().optional(),
  subtitle: z.string().trim().max(120).nullable().optional(),
  position: z.coerce.number().int().min(0).max(9999).optional(),
  isActive: z.boolean().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  return withAuth(async () => {
    await ensurePermission('settings.write');
    const claims = await getCurrentSession();
    if (!claims) return jsonError(401, 'UNAUTHENTICATED');

    const body = await req.json().catch(() => ({}));
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) return jsonError(400, 'VALIDATION', undefined, { issues: parsed.error.issues });

    const existing = await db.brandAmbassador.findUnique({ where: { id: params.id } });
    if (!existing) return jsonError(404, 'NOT_FOUND');

    const row = await db.brandAmbassador.update({ where: { id: params.id }, data: parsed.data });

    await recordActivity({
      actorId: claims.sub,
      actorRole: claims.role,
      action: 'AMBASSADOR_PATCH',
      target: params.id,
      meta: { changes: parsed.data },
    });

    return jsonOk({ ambassador: row });
  });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  return withAuth(async () => {
    await ensurePermission('settings.write');
    const claims = await getCurrentSession();
    if (!claims) return jsonError(401, 'UNAUTHENTICATED');

    const existing = await db.brandAmbassador.findUnique({ where: { id: params.id } });
    if (!existing) return jsonError(404, 'NOT_FOUND');

    await db.brandAmbassador.delete({ where: { id: params.id } });

    await recordActivity({
      actorId: claims.sub,
      actorRole: claims.role,
      action: 'AMBASSADOR_DELETE',
      target: params.id,
      meta: { nameEn: existing.nameEn },
    });

    return jsonOk({ ok: true });
  });
}
