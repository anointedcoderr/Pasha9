// Built by Anointed Coder.

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db/client';
import { hashPassword, verifyPassword } from '@/lib/auth/password';
import { requireUser } from '@/lib/auth/rbac';
import { withAuth, recordActivity } from '@/lib/auth/guard';
import { getClientIp, getUserAgent } from '@/lib/auth/session';
import { rateLimit } from '@/lib/auth/rate-limit';
import { jsonError, jsonOk } from '@/lib/auth/errors';

const schema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required').max(128),
    newPassword: z.string().min(8, 'New password must be at least 8 characters').max(128),
    confirm: z.string().min(1).max(128),
  })
  .refine((d) => d.newPassword === d.confirm, { path: ['confirm'], message: 'Passwords do not match' })
  .refine((d) => d.newPassword !== d.currentPassword, { path: ['newPassword'], message: 'New password must differ from current' });

export async function POST(req: NextRequest) {
  return withAuth(async () => {
    const session = await requireUser();
    const ip = getClientIp() ?? 'unknown';
    const limit = rateLimit(`password-change:${session.sub}`, 5, 60_000);
    if (!limit.ok) return jsonError(429, 'RATE_LIMITED');

    const body = await req.json().catch(() => ({}));
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return jsonError(400, 'VALIDATION', 'Please check your input', { issues: parsed.error.issues });
    }

    const user = await db.user.findUnique({ where: { id: session.sub } });
    if (!user) return jsonError(401, 'UNAUTHENTICATED');

    const ok = await verifyPassword(parsed.data.currentPassword, user.passwordHash);
    if (!ok) return jsonError(400, 'WRONG_CURRENT_PASSWORD', 'Current password does not match.');

    const newHash = await hashPassword(parsed.data.newPassword);

    await db.$transaction([
      db.user.update({
        where: { id: user.id },
        data: { passwordHash: newHash, passwordChangedAt: new Date() },
      }),
      // Revoke all other sessions so other devices need to log in again.
      db.session.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);

    await recordActivity({
      actorId: user.id,
      actorRole: session.role,
      action: 'PASSWORD_CHANGE',
      target: user.id,
      detail: `from ${ip} ${getUserAgent() ?? 'unknown UA'}`,
    });

    return jsonOk({ changed: true });
  });
}
