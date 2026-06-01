// Built by Anointed Coder.
//
// PATCH /api/admin/providers/[id]/games/bulk-status
// Body: { ids: string[], status: 'active' | 'maintenance' | 'hidden' }
//
// Bulk flip ExternalGame.status for a batch of rows. The where
// clause is scoped by providerId so a crafted payload with foreign
// ids becomes a no-op rather than overwriting another provider's
// games.

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAuth, ensurePermission, recordActivity } from '@/lib/auth/guard';
import { getCurrentSession } from '@/lib/auth/rbac';
import { jsonError, jsonOk } from '@/lib/auth/errors';
import { db } from '@/lib/db/client';

const schema = z.object({
  ids: z.array(z.string().trim().min(1).max(80)).min(1).max(500),
  status: z.enum(['active', 'maintenance', 'hidden']),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  return withAuth(async () => {
    await ensurePermission('settings.write');
    const claims = await getCurrentSession();
    if (!claims) return jsonError(401, 'UNAUTHENTICATED');

    const body = await req.json().catch(() => ({}));
    const parsed = schema.safeParse(body);
    if (!parsed.success) return jsonError(400, 'VALIDATION', undefined, { issues: parsed.error.issues });

    const provider = await db.gameProvider.findUnique({ where: { id: params.id }, select: { id: true } });
    if (!provider) return jsonError(404, 'NOT_FOUND');

    const result = await db.externalGame.updateMany({
      where: { providerId: provider.id, id: { in: parsed.data.ids } },
      data: { status: parsed.data.status },
    });

    const skipped = parsed.data.ids.length - result.count;

    await recordActivity({
      actorId: claims.sub,
      actorRole: claims.role,
      action: 'PROVIDER_GAME_BULK_STATUS',
      target: provider.id,
      meta: { requested: parsed.data.ids.length, updated: result.count, skipped, status: parsed.data.status },
    });

    return jsonOk({ updated: result.count, skipped, status: parsed.data.status });
  });
}
