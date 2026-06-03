// Built by Anointed Coder.
//
// POST /api/admin/password-resets/[id]/approve
//
// Generates a one-time reset token (cryptographically random), stores
// its SHA-256 hash on the row, marks the request approved, and returns
// the raw token to the admin ONE TIME so it can be shared with the
// user out-of-band. The raw token is never persisted or logged.

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { createHash, randomBytes } from 'crypto';
import { db } from '@/lib/db/client';
import { withAuth, ensurePermission, recordActivity } from '@/lib/auth/guard';
import { getCurrentSession } from '@/lib/auth/rbac';
import { jsonError, jsonOk } from '@/lib/auth/errors';

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  return withAuth(async () => {
    await ensurePermission('users.write');
    const claims = await getCurrentSession();
    if (!claims) return jsonError(401, 'UNAUTHENTICATED');

    const row = await db.passwordResetToken.findUnique({ where: { id: params.id } });
    if (!row) return jsonError(404, 'NOT_FOUND');
    if (row.status !== 'pending') return jsonError(409, 'INVALID_STATE');

    const token = randomBytes(24).toString('hex');
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
    const updated = await db.passwordResetToken.update({
      where: { id: row.id },
      data: {
        tokenHash,
        status: 'approved',
        approvedById: claims.sub,
        approvedAt: new Date(),
        expiresAt,
      },
    });

    await recordActivity({
      actorId: claims.sub,
      actorRole: claims.role,
      action: 'PASSWORD_RESET_APPROVE',
      target: updated.id,
      meta: { userId: updated.userId },
    });

    return jsonOk({
      token,
      expiresAt,
      message: 'Share this one-time code with the user. It is not stored anywhere else.',
    });
  });
}
