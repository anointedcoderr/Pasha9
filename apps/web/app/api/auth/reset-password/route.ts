// Built by Anointed Coder.
//
// POST /api/auth/reset-password
// Body: { token, newPassword }
//
// Looks up the token by SHA-256 hash, verifies it is approved + not
// expired + not consumed, writes the new bcrypt hash, and marks the
// row consumed. Token is single-use.

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { createHash } from 'crypto';
import { db } from '@/lib/db/client';
import { hashPassword } from '@/lib/auth/password';
import { jsonError, jsonOk } from '@/lib/auth/errors';
import { rateLimit } from '@/lib/auth/rate-limit';

const schema = z.object({
  token: z.string().min(20).max(200),
  newPassword: z.string().min(6).max(200),
});

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'anon';
  if (!(await rateLimit(`reset-pw:${ip}`, 5, 10 * 60_000))) return jsonError(429, 'RATE_LIMITED');

  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) return jsonError(400, 'VALIDATION');

  const tokenHash = createHash('sha256').update(parsed.data.token).digest('hex');
  const row = await db.passwordResetToken.findUnique({ where: { tokenHash } });
  if (!row || row.status !== 'approved') return jsonError(400, 'INVALID_TOKEN');
  if (row.consumedAt) return jsonError(400, 'ALREADY_USED');
  if (row.expiresAt < new Date()) return jsonError(400, 'EXPIRED');

  const newHash = await hashPassword(parsed.data.newPassword);
  await db.$transaction([
    db.user.update({ where: { id: row.userId }, data: { passwordHash: newHash, passwordChangedAt: new Date() } }),
    db.passwordResetToken.update({ where: { id: row.id }, data: { consumedAt: new Date(), status: 'consumed' } }),
  ]);

  return jsonOk({ ok: true });
}
