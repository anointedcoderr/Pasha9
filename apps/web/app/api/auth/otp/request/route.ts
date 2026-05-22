// Built by Anointed Coder.

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { randomInt, createHash } from 'node:crypto';
import { db } from '@/lib/db/client';
import { rateLimit } from '@/lib/auth/rate-limit';
import { getOtpProvider } from '@/lib/otp';
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

  const provider = getOtpProvider();
  const send = await provider.send(phone, code, purpose);

  if (!send.ok) {
    return jsonError(503, 'OTP_PROVIDER_NOT_CONFIGURED', 'OTP delivery is not configured yet. Please contact support.');
  }

  return jsonOk({
    delivered: provider.name,
    expiresInMinutes: TTL_MIN,
    devCode: send.devCode,
  });
}
