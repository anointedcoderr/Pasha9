// Built by Anointed Coder.

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { randomInt, createHash } from 'node:crypto';
import { db } from '@/lib/db/client';
import { rateLimit } from '@/lib/auth/rate-limit';
import { sendOtpSms } from '@/lib/sms/service';
import { jsonError, jsonOk } from '@/lib/auth/errors';

const schema = z.object({
  phone: z.string().trim().min(6).max(20),
  purpose: z.enum(['signup', 'login', 'reset', 'verify_phone']),
});

const TTL_MIN = 5;
const CODE_LENGTH = 6;

function sha256(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

function makeCode() {
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i++) code += randomInt(0, 10).toString();
  return code;
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  let body: unknown;
  try { body = await req.json(); } catch { return jsonError(400, 'BAD_JSON'); }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return jsonError(400, 'VALIDATION');

  const { phone, purpose } = parsed.data;

  const ipBucket = rateLimit(`otp:ip:${ip}`, 10, 60_000);
  const phoneBucket = rateLimit(`otp:phone:${phone}`, 5, 5 * 60_000);
  if (!ipBucket.ok || !phoneBucket.ok) {
    return jsonError(429, 'RATE_LIMITED', 'Too many OTP requests. Try again later.');
  }

  const code = makeCode();
  await db.otpCode.create({
    data: {
      phone,
      codeHash: sha256(code),
      purpose,
      ip,
      expiresAt: new Date(Date.now() + TTL_MIN * 60_000),
    },
  });

  const send = await sendOtpSms(phone, code, purpose);

  // M2I: a 'manual' provider counts as ok=true (the code lands in
  // NotificationLog so admin can read + relay). A real provider
  // returning ok=false is a soft failure - the OtpCode row already
  // exists so the user can still complete verification if the admin
  // hand-delivers the code.
  if (!send.ok && send.provider !== 'manual' && send.provider !== 'test') {
    console.error('[otp] SMS provider failed', { provider: send.provider, code: send.errorCode });
    return jsonError(503, 'OTP_DELIVERY_FAILED', 'OTP could not be delivered right now. Please try again or contact support.');
  }

  return jsonOk({
    delivered: send.provider,
    expiresInMinutes: TTL_MIN,
    // dev-only convenience: return the bare code in dev so the QA
    // panel can fill it in automatically. Never returned in
    // production (admin must read the code from NotificationLog
    // when the manual adapter is in use).
    devCode: process.env.NODE_ENV !== 'production' ? code : undefined,
  });
}
