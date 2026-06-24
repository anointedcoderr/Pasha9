// Built by Anointed Coder.
//
// POST /api/auth/forgot/sms/complete  { phone, code, newPassword }
//
// Verifies the SMS reset OTP and sets the new password in one step, then
// revokes every other active session so a thief who already had a
// foothold is signed out at the moment the owner regains access. The
// verified OTP is the proof; no intermediate reset token is needed.

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { createHash } from 'node:crypto';
import { db } from '@/lib/db/client';
import { rateLimit } from '@/lib/auth/rate-limit';
import { hashPassword } from '@/lib/auth/password';
import { revokePriorSessionsForUser } from '@/lib/auth/session';
import { recordActivity } from '@/lib/auth/guard';
import { canonicalBdPhone, bdPhoneSearchVariants } from '@/lib/auth/bd-phone';
import { jsonError, jsonOk } from '@/lib/auth/errors';

const schema = z.object({
  phone: z.string().trim().min(6).max(20),
  code: z.string().trim().min(4).max(8),
  newPassword: z.string().min(6, 'Password must be at least 6 characters').max(200),
});

const MAX_ATTEMPTS = 5;
function sha256(v: string) { return createHash('sha256').update(v).digest('hex'); }

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const ua = req.headers.get('user-agent') ?? null;
  if (!rateLimit(`forgot-sms-complete:ip:${ip}`, 20, 60_000).ok) return jsonError(429, 'RATE_LIMITED');

  let body: unknown;
  try { body = await req.json(); } catch { return jsonError(400, 'BAD_JSON'); }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return jsonError(400, 'VALIDATION', undefined, { issues: parsed.error.issues });

  const local = canonicalBdPhone(parsed.data.phone);
  if (!local) return jsonError(400, 'OTP_NOT_FOUND', 'No active reset code for this number.');
  if (!rateLimit(`forgot-sms-complete:phone:${local}`, 5, 60_000).ok) return jsonError(429, 'RATE_LIMITED');

  const record = await db.otpCode.findFirst({
    where: { phone: local, purpose: 'reset', consumedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: 'desc' },
  });
  if (!record) return jsonError(400, 'OTP_NOT_FOUND', 'No active reset code. Request a new one.');
  if (record.attempts >= MAX_ATTEMPTS) return jsonError(429, 'OTP_TOO_MANY_ATTEMPTS', 'Too many incorrect attempts. Request a new code.');
  if (record.codeHash !== sha256(parsed.data.code)) {
    await db.otpCode.update({ where: { id: record.id }, data: { attempts: { increment: 1 } } });
    return jsonError(400, 'OTP_MISMATCH', 'The code does not match.');
  }

  const user = await db.user.findFirst({
    where: { phone: { in: bdPhoneSearchVariants(local) } },
    select: { id: true, status: true },
  });
  if (!user) {
    await db.otpCode.update({ where: { id: record.id }, data: { consumedAt: new Date() } });
    return jsonError(400, 'OTP_NOT_FOUND', 'No account is registered to this number.');
  }
  if (user.status === 'blocked') {
    return jsonError(403, 'USER_BLOCKED', 'This account is suspended. Please contact support.');
  }

  const newHash = await hashPassword(parsed.data.newPassword);
  try {
    await db.$transaction([
      db.user.update({ where: { id: user.id }, data: { passwordHash: newHash, passwordChangedAt: new Date() } }),
      db.otpCode.update({ where: { id: record.id, consumedAt: null }, data: { consumedAt: new Date() } }),
    ]);
  } catch {
    return jsonError(400, 'ALREADY_USED', 'This code was already used. Request a new one.');
  }

  await revokePriorSessionsForUser(user.id).catch((err) => console.error('[forgot/sms/complete] session revoke failed', err));
  await recordActivity({
    actorId: user.id,
    actorRole: 'user',
    action: 'FORGOT_SMS_RESET_OK',
    target: user.id,
    meta: { ip, ua },
  }).catch(() => null);

  return jsonOk({ ok: true });
}
