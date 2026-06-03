// Built by Anointed Coder.
//
// POST /api/admin/password-resets/[id]/reject  Body: { adminNote? }
//
// Marks the row rejected; no token is generated. Idempotent on
// invalid state.

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db/client';
import { withAuth, ensurePermission, recordActivity } from '@/lib/auth/guard';
import { getCurrentSession } from '@/lib/auth/rbac';
import { jsonError, jsonOk } from '@/lib/auth/errors';

const schema = z.object({
  adminNote: z.string().trim().max(1000).optional(),
});

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  return withAuth(async () => {
    await ensurePermission('users.write');
    const claims = await getCurrentSession();
    if (!claims) return jsonError(401, 'UNAUTHENTICATED');

    const row = await db.passwordResetToken.findUnique({ where: { id: params.id } });
    if (!row) return jsonError(404, 'NOT_FOUND');
    if (row.status !== 'pending') return jsonError(409, 'INVALID_STATE');

    const body = await req.json().catch(() => ({}));
    const parsed = schema.safeParse(body);
    if (!parsed.success) return jsonError(400, 'VALIDATION');

    const updated = await db.passwordResetToken.update({
      where: { id: row.id },
      data: {
        status: 'rejected',
        adminNote: parsed.data.adminNote ?? null,
        approvedById: claims.sub,
        approvedAt: new Date(),
      },
    });

    await recordActivity({
      actorId: claims.sub,
      actorRole: claims.role,
      action: 'PASSWORD_RESET_REJECT',
      target: updated.id,
      meta: { userId: updated.userId },
    });

    return jsonOk({ ok: true });
  });
}
