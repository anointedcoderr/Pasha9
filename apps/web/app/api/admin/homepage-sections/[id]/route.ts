// Built by Anointed Coder.
//
// PATCH /api/admin/homepage-sections/[id]
//
// Edits a single PublicSection row. Limited to the homepage group
// here; the upcoming Phase G console will edit about + payment_display
// groups through the same endpoint with a separate permission gate.

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAuth, ensurePermission, recordActivity } from '@/lib/auth/guard';
import { getCurrentSession } from '@/lib/auth/rbac';
import { jsonError, jsonOk } from '@/lib/auth/errors';
import { db } from '@/lib/db/client';

const schema = z.object({
  titleEn: z.string().trim().min(1).max(200).optional(),
  titleBn: z.string().trim().max(200).nullable().optional(),
  subtitleEn: z.string().trim().max(400).nullable().optional(),
  subtitleBn: z.string().trim().max(400).nullable().optional(),
  isVisible: z.boolean().optional(),
  position: z.number().int().min(0).max(9999).optional(),
  // Operator-uploaded section icon. Stored inside the existing meta
  // JSON column so the change is additive (no schema migration). An
  // empty string clears the override; null is treated the same.
  iconImageUrl: z.string().trim().max(600).nullable().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  return withAuth(async () => {
    await ensurePermission('homepage.write');
    const claims = await getCurrentSession();
    if (!claims) return jsonError(401, 'UNAUTHENTICATED');

    const body = await req.json().catch(() => ({}));
    const parsed = schema.safeParse(body);
    if (!parsed.success) return jsonError(400, 'VALIDATION', undefined, { issues: parsed.error.issues });

    const current = await db.publicSection.findUnique({ where: { id: params.id } });
    if (!current) return jsonError(404, 'NOT_FOUND');
    if (current.group !== 'homepage') return jsonError(403, 'WRONG_GROUP', 'This endpoint only edits homepage sections.');

    const { iconImageUrl, ...rest } = parsed.data;
    const nextMeta = (() => {
      if (iconImageUrl === undefined) return undefined;
      const base = (current.meta && typeof current.meta === 'object' && !Array.isArray(current.meta))
        ? { ...(current.meta as Record<string, unknown>) }
        : {};
      const trimmed = iconImageUrl?.trim() ?? '';
      if (trimmed) base.iconImageUrl = trimmed;
      else delete base.iconImageUrl;
      return base;
    })();

    const updated = await db.publicSection.update({
      where: { id: params.id },
      data: {
        ...rest,
        ...(nextMeta !== undefined ? { meta: nextMeta as object } : {}),
      },
    });

    await recordActivity({
      actorId: claims.sub,
      actorRole: claims.role,
      action: 'HOMEPAGE_SECTION_PATCH',
      target: current.key,
      meta: { changes: parsed.data },
    });

    return jsonOk({ section: updated });
  });
}
