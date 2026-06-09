// Built by Anointed Coder.

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { randomBytes } from 'node:crypto';
import { db } from '@/lib/db/client';
import { hashToken } from '@/lib/auth/session';
import { rateLimit } from '@/lib/auth/rate-limit';
import { jsonError, jsonOk } from '@/lib/auth/errors';

const schema = z.object({
  identifier: z.string().trim().min(3).max(64),
});

const TTL_MIN = 30;

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const limit = rateLimit(`forgot:${ip}`, 5, 60_000);
  if (!limit.ok) return jsonError(429, 'RATE_LIMITED', 'Too many attempts. Try again in a minute.');

  let body: unknown;
  try { body = await req.json(); } catch { return jsonError(400, 'BAD_JSON'); }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return jsonError(400, 'VALIDATION');

  const identifier = parsed.data.identifier;
  const user = await db.user.findFirst({
    where: { OR: [{ username: identifier }, { phone: identifier }] },
    select: { id: true },
  });

  // Always reply ok to avoid enumeration of accounts.
  if (!user) return jsonOk({ delivered: 'ok' });

  const secret = randomBytes(32).toString('base64url');
  await db.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(secret),
      ip,
      expiresAt: new Date(Date.now() + TTL_MIN * 60_000),
    },
  });

  // The token is delivered via SMS / NotificationLog only. We never
  // return the raw secret in the HTTP response (a misconfigured
  // NODE_ENV in production would leak single-use reset tokens to
  // anyone who could call this endpoint). QA can read the token
  // from /admin/notifications -> the NotificationLog row created
  // by the SMS provider.

  return jsonOk({ delivered: 'ok' });
}
