// Built by Anointed Coder.
//
// Per-user device / session history. GET lists every Session row for
// the signed-in user (active + revoked, last 50). DELETE accepts a
// session id and revokes it.

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db/client';
import { withAuth, recordActivity } from '@/lib/auth/guard';
import { requireUser } from '@/lib/auth/rbac';
import { jsonError, jsonOk } from '@/lib/auth/errors';

export async function GET() {
  return withAuth(async () => {
    const session = await requireUser();
    const rows = await db.session.findMany({
      where: { userId: session.sub },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true, userAgent: true, ip: true, createdAt: true, expiresAt: true, revokedAt: true,
      },
    });
    const recentAttempts = await db.loginAttempt.findMany({
      where: { userId: session.sub },
      orderBy: { createdAt: 'desc' },
      take: 30,
      select: { id: true, ip: true, userAgent: true, success: true, reason: true, flags: true, createdAt: true, surface: true },
    });
    return jsonOk({ sessions: rows, attempts: recentAttempts });
  });
}

const delSchema = z.object({ id: z.string().min(1) });

export async function DELETE(req: NextRequest) {
  return withAuth(async () => {
    const session = await requireUser();
    const body = await req.json().catch(() => ({}));
    const parsed = delSchema.safeParse(body);
    if (!parsed.success) return jsonError(400, 'VALIDATION');

    const target = await db.session.findUnique({ where: { id: parsed.data.id } });
    if (!target || target.userId !== session.sub) return jsonError(404, 'NOT_FOUND');
    if (target.revokedAt) return jsonOk({ ok: true, alreadyRevoked: true });

    await db.session.update({ where: { id: target.id }, data: { revokedAt: new Date() } });
    await recordActivity({
      actorId: session.sub,
      actorRole: session.role,
      action: 'SESSION_REVOKE',
      target: target.id,
    });
    return jsonOk({ ok: true });
  });
}
