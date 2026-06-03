// Built by Anointed Coder.
//
// PATCH  /api/admin/deposit-notices/[id]
// DELETE /api/admin/deposit-notices/[id]

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAuth, ensurePermission, recordActivity } from '@/lib/auth/guard';
import { getCurrentSession } from '@/lib/auth/rbac';
import { jsonError, jsonOk } from '@/lib/auth/errors';
import { db } from '@/lib/db/client';

const patchSchema = z.object({
  titleEn: z.string().trim().min(1).max(200).optional(),
  titleBn: z.string().trim().max(200).nullable().optional(),
  bodyEn: z.string().trim().min(1).max(4000).optional(),
  bodyBn: z.string().trim().max(4000).nullable().optional(),
  ctaLabelEn: z.string().trim().min(1).max(60).optional(),
  ctaLabelBn: z.string().trim().max(60).nullable().optional(),
  position: z.number().int().min(0).max(9999).optional(),
  isEnabled: z.boolean().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  return withAuth(async () => {
    await ensurePermission('settings.write');
    const claims = await getCurrentSession();
    if (!claims) return jsonError(401, 'UNAUTHENTICATED');

    const body = await req.json().catch(() => ({}));
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) return jsonError(400, 'VALIDATION', undefined, { issues: parsed.error.issues });

    const existing = await db.depositNotice.findUnique({ where: { id: params.id } });
    if (!existing) return jsonError(404, 'NOT_FOUND');

    const updated = await db.depositNotice.update({ where: { id: params.id }, data: parsed.data });

    await recordActivity({
      actorId: claims.sub,
      actorRole: claims.role,
      action: 'DEPOSIT_NOTICE_PATCH',
      target: params.id,
      meta: { changes: parsed.data },
    });

    return jsonOk({ notice: updated });
  });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  return withAuth(async () => {
    await ensurePermission('settings.write');
    const claims = await getCurrentSession();
    if (!claims) return jsonError(401, 'UNAUTHENTICATED');

    const existing = await db.depositNotice.findUnique({ where: { id: params.id } });
    if (!existing) return jsonError(404, 'NOT_FOUND');

    await db.depositNotice.delete({ where: { id: params.id } });

    await recordActivity({
      actorId: claims.sub,
      actorRole: claims.role,
      action: 'DEPOSIT_NOTICE_DELETE',
      target: params.id,
      meta: { titleEn: existing.titleEn },
    });

    return jsonOk({ ok: true });
  });
}
