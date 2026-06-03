// Built by Anointed Coder.
//
// POST /api/me/password
// Body: { currentPassword, newPassword }
//
// Verifies the current password and writes a new bcrypt hash.
// Session stays valid so the user is not bumped out after the
// change. Rate-limited.

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db/client';
import { withAuth, ensureUser, recordActivity } from '@/lib/auth/guard';
import { jsonError, jsonOk } from '@/lib/auth/errors';
import { hashPassword, verifyPassword } from '@/lib/auth/password';
import { rateLimit } from '@/lib/auth/rate-limit';

const schema = z.object({
  currentPassword: z.string().min(6).max(200),
  newPassword: z.string().min(6, 'Password must be at least 6 characters').max(200),
});

export async function POST(req: NextRequest) {
  return withAuth(async () => {
    const session = await ensureUser();
    if (!(await rateLimit(`me:password:${session.sub}`, 5, 5 * 60_000))) {
      return jsonError(429, 'RATE_LIMITED', 'Too many password change attempts. Try again later.');
    }

    const body = await req.json().catch(() => ({}));
    const parsed = schema.safeParse(body);
    if (!parsed.success) return jsonError(400, 'VALIDATION', undefined, { issues: parsed.error.issues });

    const row = await db.user.findUnique({ where: { id: session.sub }, select: { id: true, passwordHash: true } });
    if (!row) return jsonError(404, 'USER_NOT_FOUND');

    const ok = await verifyPassword(parsed.data.currentPassword, row.passwordHash);
    if (!ok) return jsonError(400, 'WRONG_CURRENT_PASSWORD', 'Current password is incorrect.');

    const newHash = await hashPassword(parsed.data.newPassword);
    await db.user.update({
      where: { id: session.sub },
      data: { passwordHash: newHash, passwordChangedAt: new Date() },
    });

    await recordActivity({
      actorId: session.sub,
      actorRole: session.role,
      action: 'PASSWORD_CHANGE',
      target: session.sub,
    });

    return jsonOk({ changed: true });
  });
}
