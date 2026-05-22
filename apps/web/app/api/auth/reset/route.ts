// Built by Anointed Coder.

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db/client';
import { hashPassword } from '@/lib/auth/password';
import { hashToken } from '@/lib/auth/session';
import { rateLimit } from '@/lib/auth/rate-limit';
import { jsonError, jsonOk } from '@/lib/auth/errors';

const schema = z.object({
  token: z.string().min(20),
  password: z.string().min(6).max(128),
});

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const limit = rateLimit(`reset:${ip}`, 5, 60_000);
  if (!limit.ok) return jsonError(429, 'RATE_LIMITED');

  let body: unknown;
  try { body = await req.json(); } catch { return jsonError(400, 'BAD_JSON'); }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return jsonError(400, 'VALIDATION');

  const { token, password } = parsed.data;

  const record = await db.passwordResetToken.findFirst({
    where: {
      tokenHash: hashToken(token),
      consumedAt: null,
      expiresAt: { gt: new Date() },
    },
  });
  if (!record) return jsonError(400, 'INVALID_TOKEN', 'This reset link is invalid or has expired.');

  const passwordHash = await hashPassword(password);
  await db.$transaction([
    db.user.update({
      where: { id: record.userId },
      data: { passwordHash, passwordChangedAt: new Date() },
    }),
    db.passwordResetToken.update({
      where: { id: record.id },
      data: { consumedAt: new Date() },
    }),
    db.session.updateMany({
      where: { userId: record.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
    db.activityLog.create({
      data: {
        actorId: record.userId,
        actorRole: 'user',
        action: 'PASSWORD_RESET',
        target: record.userId,
        ip,
      },
    }),
  ]);

  return jsonOk({ reset: true });
}
