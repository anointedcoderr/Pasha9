// Built by Anointed Coder.
//
// PATCH /api/admin/public-sections/[id]
//
// Edits a PublicSection row in the about or payment_display group.
// Phase B's /api/admin/homepage-sections/[id] route covers
// group=homepage and refuses non-homepage rows; this route is the
// mirror image for the rest of the public surfaces. Phase G uses it
// for about_ambassadors, about_sponsors, public_payment_methods.

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db/client';
import { withAuth, ensurePermission, recordActivity } from '@/lib/auth/guard';
import { getCurrentSession } from '@/lib/auth/rbac';
import { jsonError, jsonOk } from '@/lib/auth/errors';

const ALLOWED_GROUPS = new Set(['about', 'payment_display']);

const schema = z.object({
  titleEn: z.string().trim().min(1).max(200).optional(),
  titleBn: z.string().trim().max(200).nullable().optional(),
  subtitleEn: z.string().trim().max(400).nullable().optional(),
  subtitleBn: z.string().trim().max(400).nullable().optional(),
  isVisible: z.boolean().optional(),
  position: z.number().int().min(0).max(9999).optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  return withAuth(async () => {
    await ensurePermission('settings.write');
    const claims = await getCurrentSession();
    if (!claims) return jsonError(401, 'UNAUTHENTICATED');

    const body = await req.json().catch(() => ({}));
    const parsed = schema.safeParse(body);
    if (!parsed.success) return jsonError(400, 'VALIDATION', undefined, { issues: parsed.error.issues });

    const existing = await db.publicSection.findUnique({ where: { id: params.id } });
    if (!existing) return jsonError(404, 'NOT_FOUND');
    if (!ALLOWED_GROUPS.has(existing.group)) {
      return jsonError(403, 'WRONG_GROUP', 'This endpoint only edits about / payment_display sections.');
    }

    const row = await db.publicSection.update({ where: { id: params.id }, data: parsed.data });

    await recordActivity({
      actorId: claims.sub,
      actorRole: claims.role,
      action: 'PUBLIC_SECTION_PATCH',
      target: existing.key,
      meta: { changes: parsed.data },
    });

    return jsonOk({ section: row });
  });
}
