// Built by Anointed Coder.
//
// POST /api/admin/homepage-featured/reorder
//
// Accepts an ordered array of HomepageFeaturedGame ids and writes
// positions 10, 20, 30, ... in a single transaction. This replaces the
// previous swap-positions approach (two parallel PATCH calls per
// up/down click) which raced and could leave duplicate position values
// across rows. The atomic write keeps the public Hot Games strip in
// the exact order the operator dragged.

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAuth, ensurePermission, recordActivity } from '@/lib/auth/guard';
import { getCurrentSession } from '@/lib/auth/rbac';
import { jsonError, jsonOk } from '@/lib/auth/errors';
import { db } from '@/lib/db/client';

const reorderSchema = z.object({
  ids: z.array(z.string().min(1).max(60)).min(1).max(50),
});

export async function POST(req: NextRequest) {
  return withAuth(async () => {
    await ensurePermission('homepage.write');
    const claims = await getCurrentSession();
    if (!claims) return jsonError(401, 'UNAUTHENTICATED');

    const body = await req.json().catch(() => ({}));
    const parsed = reorderSchema.safeParse(body);
    if (!parsed.success) return jsonError(400, 'VALIDATION', undefined, { issues: parsed.error.issues });

    const ids = parsed.data.ids;
    if (new Set(ids).size !== ids.length) {
      return jsonError(400, 'DUPLICATE_IDS', 'Reorder payload contains duplicate ids.');
    }

    // Verify every id exists. Refuse to write a partial order against
    // stale client state.
    const existing = await db.homepageFeaturedGame.findMany({
      where: { id: { in: ids } },
      select: { id: true },
    });
    if (existing.length !== ids.length) {
      return jsonError(409, 'STALE_LIST', 'One or more rows in the reorder payload no longer exist. Refresh the list and try again.');
    }

    await db.$transaction(async (tx) => {
      let position = 10;
      for (const id of ids) {
        await tx.homepageFeaturedGame.update({ where: { id }, data: { position } });
        position += 10;
      }
    });

    await recordActivity({
      actorId: claims.sub,
      actorRole: claims.role,
      action: 'HOMEPAGE_FEATURED_REORDER',
      target: 'homepage_hot',
      meta: { count: ids.length },
    });

    return jsonOk({ ok: true, count: ids.length });
  });
}
