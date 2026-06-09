// Built by Anointed Coder.

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { createHash } from 'node:crypto';
import { db } from '@/lib/db/client';
import { rateLimit } from '@/lib/auth/rate-limit';
import { jsonError, jsonOk } from '@/lib/auth/errors';

const schema = z.object({
  phone: z.string().trim().min(6).max(20),
  purpose: z.enum(['signup', 'login', 'reset', 'verify_phone']),
  code: z.string().trim().min(4).max(8),
});

const MAX_ATTEMPTS = 5;

function sha256(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const limit = rateLimit(`otp-verify:${ip}`, 20, 60_000);
  if (!limit.ok) return jsonError(429, 'RATE_LIMITED');

  let body: unknown;
  try { body = await req.json(); } catch { return jsonError(400, 'BAD_JSON'); }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return jsonError(400, 'VALIDATION');

  const { phone, purpose, code } = parsed.data;

  // Per-phone bucket on top of the per-IP bucket. Without this an
  // attacker behind a NAT or rotating proxy could still enumerate
  // which Bangladeshi phone numbers have an active OTP by spamming
  // verify with random codes for many phones. The phone-scoped
  // bucket caps that enumeration vector.
  const phoneBucket = rateLimit(`otp-verify:phone:${phone}`, 5, 60_000);
  if (!phoneBucket.ok) return jsonError(429, 'RATE_LIMITED');

  const record = await db.otpCode.findFirst({
    where: {
      phone,
      purpose,
      consumedAt: null,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: 'desc' },
  });

  if (!record) return jsonError(400, 'OTP_NOT_FOUND', 'No active OTP for this number.');

  if (record.attempts >= MAX_ATTEMPTS) {
    return jsonError(429, 'OTP_TOO_MANY_ATTEMPTS', 'Too many incorrect attempts. Request a new code.');
  }

  if (record.codeHash !== sha256(code)) {
    await db.otpCode.update({
      where: { id: record.id },
      data: { attempts: { increment: 1 } },
    });
    return jsonError(400, 'OTP_MISMATCH', 'Code does not match.');
  }

  await db.otpCode.update({
    where: { id: record.id },
    data: { consumedAt: new Date() },
  });

  if (purpose === 'verify_phone') {
    const user = await db.user.findUnique({ where: { phone }, select: { id: true } });
    if (user) {
      await db.user.update({ where: { id: user.id }, data: { phoneVerifiedAt: new Date() } });
    }
  }

  return jsonOk({ verified: true });
}
