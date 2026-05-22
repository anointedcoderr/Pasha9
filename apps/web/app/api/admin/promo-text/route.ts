// Built by Anointed Coder.

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db/client';
import { withAuth, ensurePermission, recordActivity } from '@/lib/auth/guard';
import { jsonError, jsonOk } from '@/lib/auth/errors';

const createSchema = z.object({
  message: z.string().min(1).max(280),
  position: z.coerce.number().int().min(0).max(99).default(0),
  status: z.enum(['active', 'hidden', 'paused']).default('active'),
});

export async function GET() {
  return withAuth(async () => {
    await ensurePermission('promo.write');
    const items = await db.promoText.findMany({ orderBy: [{ position: 'asc' }] });
    return jsonOk({ items });
  });
}

export async function POST(req: NextRequest) {
  return withAuth(async () => {
    const session = await ensurePermission('promo.write');
    const body = await req.json().catch(() => ({}));
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) return jsonError(400, 'VALIDATION', undefined, { issues: parsed.error.issues });
    const item = await db.promoText.create({ data: parsed.data });
    await recordActivity({ actorId: session.sub, actorRole: session.role, action: 'PROMO_CREATE', target: item.id });
    return jsonOk({ item }, 201);
  });
}
