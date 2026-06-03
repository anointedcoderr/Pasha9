// Built by Anointed Coder.
//
// GET  /api/admin/brand-ambassadors   list every row
// POST /api/admin/brand-ambassadors   create a new ambassador

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db/client';
import { withAuth, ensurePermission, recordActivity } from '@/lib/auth/guard';
import { getCurrentSession } from '@/lib/auth/rbac';
import { jsonError, jsonOk } from '@/lib/auth/errors';

const createSchema = z.object({
  nameEn: z.string().trim().min(1).max(120),
  nameBn: z.string().trim().max(120).nullable().optional(),
  iconUrl: z.string().trim().max(500).nullable().optional(),
  subtitle: z.string().trim().max(120).nullable().optional(),
  position: z.coerce.number().int().min(0).max(9999).optional(),
  isActive: z.boolean().optional(),
});

export async function GET() {
  return withAuth(async () => {
    await ensurePermission('settings.write');
    const rows = await db.brandAmbassador.findMany({ orderBy: [{ position: 'asc' }, { updatedAt: 'desc' }] });
    return jsonOk({ ambassadors: rows });
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

    const next = ((await db.brandAmbassador.aggregate({ _max: { position: true } }))._max.position ?? 0) + 10;
    const row = await db.brandAmbassador.create({
      data: {
        nameEn: parsed.data.nameEn,
        nameBn: parsed.data.nameBn ?? null,
        iconUrl: parsed.data.iconUrl ?? null,
        subtitle: parsed.data.subtitle ?? null,
        position: parsed.data.position ?? next,
        isActive: parsed.data.isActive ?? true,
      },
    });

    await recordActivity({
      actorId: claims.sub,
      actorRole: claims.role,
      action: 'AMBASSADOR_CREATE',
      target: row.id,
      meta: { nameEn: row.nameEn },
    });

    return jsonOk({ ambassador: row }, 201);
  });
}
