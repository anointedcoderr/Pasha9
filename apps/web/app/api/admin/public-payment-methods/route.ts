// Built by Anointed Coder.
//
// GET  /api/admin/public-payment-methods   list every public-display row
// POST /api/admin/public-payment-methods   create a new pill
//
// This is the public display surface (icon pills shown on the homepage
// / about / footer). It is SEPARATE from the real gateway PaymentMethod
// rows managed at /admin/payment-methods.

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db/client';
import { withAuth, ensurePermission, recordActivity } from '@/lib/auth/guard';
import { getCurrentSession } from '@/lib/auth/rbac';
import { jsonError, jsonOk } from '@/lib/auth/errors';

const createSchema = z.object({
  buttonText: z.string().trim().min(1).max(60),
  iconUrl: z.string().trim().max(500).nullable().optional(),
  position: z.coerce.number().int().min(0).max(9999).optional(),
  isActive: z.boolean().optional(),
});

export async function GET() {
  return withAuth(async () => {
    await ensurePermission('settings.write');
    const rows = await db.publicPaymentMethod.findMany({ orderBy: [{ position: 'asc' }, { updatedAt: 'desc' }] });
    return jsonOk({ paymentMethods: rows });
  });
}

export async function POST(req: NextRequest) {
  return withAuth(async () => {
    await ensurePermission('settings.write');
    const claims = await getCurrentSession();
    if (!claims) return jsonError(401, 'UNAUTHENTICATED');

    const body = await req.json().catch(() => ({}));
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) return jsonError(400, 'VALIDATION', undefined, { issues: parsed.error.issues });

    const next = ((await db.publicPaymentMethod.aggregate({ _max: { position: true } }))._max.position ?? 0) + 10;
    const row = await db.publicPaymentMethod.create({
      data: {
        buttonText: parsed.data.buttonText,
        iconUrl: parsed.data.iconUrl ?? null,
        position: parsed.data.position ?? next,
        isActive: parsed.data.isActive ?? true,
      },
    });

    await recordActivity({
      actorId: claims.sub,
      actorRole: claims.role,
      action: 'PUBLIC_PAYMENT_CREATE',
      target: row.id,
      meta: { buttonText: row.buttonText },
    });

    return jsonOk({ paymentMethod: row }, 201);
  });
}
