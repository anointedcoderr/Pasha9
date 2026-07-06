// Built by Anointed Coder.
//
// GET  /api/admin/promo-codes        list codes with redemption counts
// POST /api/admin/promo-codes        create one

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { db } from '@/lib/db/client';
import { withAuth, ensurePermission, recordActivity } from '@/lib/auth/guard';
import { jsonError, jsonOk } from '@/lib/auth/errors';
import { promoCreateSchema, createPromoCode, serializePromoCode as serialize } from '@/lib/promo-codes/create';

export async function GET() {
  return withAuth(async () => {
    await ensurePermission('bonuses.read');
    const rows = await db.promoCode.findMany({
      orderBy: [{ isActive: 'desc' }, { createdAt: 'desc' }],
      // Bounded payload as the promo catalogue grows. Operators
      // with more than 500 active codes should add a filter or
      // archive expired codes from the admin console.
      take: 500,
      include: { _count: { select: { redemptions: true } } },
    });
    return jsonOk({ codes: rows.map(serialize) });
  });
}

export async function POST(req: NextRequest) {
  return withAuth(async () => {
    const session = await ensurePermission('bonuses.write');
    const body = await req.json().catch(() => ({}));
    const parsed = promoCreateSchema.safeParse(body);
    if (!parsed.success) return jsonError(400, 'VALIDATION', undefined, { issues: parsed.error.issues });

    const result = await createPromoCode(parsed.data);
    if (!result.ok) return jsonError(result.httpStatus, result.code, result.message);
    const created = result.promoCode;

    await recordActivity({
      actorId: session.sub,
      actorRole: session.role,
      action: 'PROMO_CODE_CREATE',
      target: created.id,
      detail: created.code,
    });

    return jsonOk({ promoCode: serialize(created) }, 201);
  });
}
