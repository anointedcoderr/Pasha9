// Built by Anointed Coder.
//
// Admin CRUD for GameCategory rows. Replaces the prior mock-data
// admin/categories page with the real DB. iconImageUrl is an optional
// uploaded image used by the public site in place of iconKey when set.

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db/client';
import { withAuth, ensurePermission, recordActivity } from '@/lib/auth/guard';
import { jsonError, jsonOk } from '@/lib/auth/errors';

const createSchema = z.object({
  slug: z.string().trim().min(1).max(60).regex(/^[a-z0-9-]+$/, 'lowercase letters, digits and dashes only'),
  nameEn: z.string().trim().min(1).max(80),
  nameBn: z.string().trim().min(1).max(80),
  iconKey: z.string().trim().min(1).max(40),
  iconImageUrl: z.string().trim().max(500).optional().nullable(),
  position: z.coerce.number().int().min(0).max(99).default(0),
  status: z.enum(['active', 'hidden', 'paused']).default('active'),
});

export async function GET() {
  return withAuth(async () => {
    await ensurePermission('categories.write');
    const rows = await db.gameCategory.findMany({ orderBy: [{ position: 'asc' }, { nameEn: 'asc' }] });
    return jsonOk({ categories: rows });
  });
}

export async function POST(req: NextRequest) {
  return withAuth(async () => {
    const session = await ensurePermission('categories.write');
    const body = await req.json().catch(() => ({}));
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) return jsonError(400, 'VALIDATION', undefined, { issues: parsed.error.issues });
    const category = await db.gameCategory.create({ data: parsed.data });
    await recordActivity({
      actorId: session.sub,
      actorRole: session.role,
      action: 'CATEGORY_CREATE',
      target: category.id,
      detail: category.slug,
    });
    return jsonOk({ category }, 201);
  });
}
