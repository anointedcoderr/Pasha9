// Built by Anointed Coder.
//
// PATCH  /api/admin/public-payment-methods/[id]
// DELETE /api/admin/public-payment-methods/[id]

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db/client';
import { withAuth, ensurePermission, recordActivity } from '@/lib/auth/guard';
import { getCurrentSession } from '@/lib/auth/rbac';
import { jsonError, jsonOk } from '@/lib/auth/errors';

const patchSchema = z.object({
  buttonText: z.string().trim().min(1).max(60).optional(),
  iconUrl: z.string().trim().max(500).nullable().optional(),
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

    const existing = await db.publicPaymentMethod.findUnique({ where: { id: params.id } });
    if (!existing) return jsonError(404, 'NOT_FOUND');

    const row = await db.publicPaymentMethod.update({ where: { id: params.id }, data: parsed.data });

    await recordActivity({
      actorId: claims.sub,
      actorRole: claims.role,
      action: 'PUBLIC_PAYMENT_PATCH',
      target: params.id,
      meta: { changes: parsed.data },
    });

    return jsonOk({ paymentMethod: row });
  });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  return withAuth(async () => {
    await ensurePermission('settings.write');
    const claims = await getCurrentSession();
    if (!claims) return jsonError(401, 'UNAUTHENTICATED');

    const existing = await db.publicPaymentMethod.findUnique({ where: { id: params.id } });
    if (!existing) return jsonError(404, 'NOT_FOUND');

    await db.publicPaymentMethod.delete({ where: { id: params.id } });

    await recordActivity({
      actorId: claims.sub,
      actorRole: claims.role,
      action: 'PUBLIC_PAYMENT_DELETE',
      target: params.id,
      meta: { buttonText: existing.buttonText },
    });

    return jsonOk({ ok: true });
  });
}
