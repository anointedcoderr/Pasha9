// Built by Anointed Coder.
//
// POST /api/auth/forgot/phone/reset
// Body: { resetToken, newPassword }
//
// Consumes the single-use PasswordResetToken minted by
// /api/auth/forgot/phone/verify, writes the new bcrypt hash, and
// revokes every other active session so a thief who already had a
// foothold on the account is signed out at the same moment the
// owner regains access.
//
// Same shape as /api/auth/reset-password but additionally:
//   - requires the token's verifiedVia='firebase_phone' provenance
//   - revokes prior sessions
//   - logs FORGOT_PHONE_RESET_OK on success

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { createHash } from 'crypto';
import { db } from '@/lib/db/client';
import { hashPassword } from '@/lib/auth/password';
import { jsonError, jsonOk } from '@/lib/auth/errors';
import { rateLimit } from '@/lib/auth/rate-limit';
import { revokePriorSessionsForUser } from '@/lib/auth/session';
import { recordActivity } from '@/lib/auth/guard';

const schema = z.object({
  resetToken: z.string().min(20).max(200),
  newPassword: z.string().min(6, 'Password must be at least 6 characters').max(200),
});

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'anon';
  const ua = req.headers.get('user-agent') ?? null;
  if (!rateLimit(`forgot-phone-reset:${ip}`, 5, 10 * 60_000).ok) {
    return jsonError(429, 'RATE_LIMITED');
  }

  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) return jsonError(400, 'VALIDATION', undefined, { issues: parsed.error.issues });

  const tokenHash = createHash('sha256').update(parsed.data.resetToken).digest('hex');
  const row = await db.passwordResetToken.findUnique({ where: { tokenHash } });
  if (!row) return jsonError(400, 'INVALID_TOKEN', 'This reset link is invalid. Start the Forgot Password flow again.');
  if (row.status !== 'approved' || row.verifiedVia !== 'firebase_phone') {
    return jsonError(400, 'INVALID_TOKEN', 'This reset link is invalid.');
  }
  if (row.consumedAt) return jsonError(400, 'ALREADY_USED', 'This reset link was already used.');
  if (row.expiresAt < new Date()) return jsonError(400, 'EXPIRED', 'This reset link has expired. Request a new code.');

  // Hash + write + consume in a single transaction so a concurrent
  // request cannot double-consume the same token.
  const newHash = await hashPassword(parsed.data.newPassword);
  try {
    await db.$transaction([
      db.user.update({
        where: { id: row.userId },
        data: { passwordHash: newHash, passwordChangedAt: new Date() },
      }),
      db.passwordResetToken.update({
        where: { id: row.id, consumedAt: null },
        data: { consumedAt: new Date(), status: 'consumed' },
      }),
    ]);
  } catch {
    // Race: another request consumed the same token between findUnique
    // and the update. Return the same error a stale token would surface.
    return jsonError(400, 'ALREADY_USED', 'This reset link was already used.');
  }

  // Revoke every active session for this user so a thief who already
  // had a foothold on the account is signed out at the same moment the
  // owner regains access.
  await revokePriorSessionsForUser(row.userId).catch((err) => {
    console.error('[forgot/phone/reset] session revoke failed', err);
  });

  await recordActivity({
    actorId: row.userId,
    actorRole: 'user',
    action: 'FORGOT_PHONE_RESET_OK',
    target: row.userId,
    detail: row.identifier ?? undefined,
    meta: { ip, ua, firebaseUid: row.firebaseUid ?? null },
  }).catch(() => null);

  return jsonOk({ ok: true });
}
