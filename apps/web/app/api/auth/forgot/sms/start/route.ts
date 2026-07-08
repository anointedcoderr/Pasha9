// Built by Anointed Coder.
//
// POST /api/auth/forgot/sms/start  { phone }
//
// Sends a password-reset OTP by SMS to a registered Bangladesh number
// through the configured SMS provider. Enumeration-safe: always returns
// { ok: true } whether or not the phone belongs to an account, so the
// response never reveals which numbers are registered. Gated by the
// SystemSetting flag forgot_password_enabled.

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { randomInt, createHash } from 'node:crypto';
import { db } from '@/lib/db/client';
import { rateLimit } from '@/lib/auth/rate-limit';
import { sendOtpSms } from '@/lib/sms/service';
import { canonicalBdPhone, bdPhoneSearchVariants } from '@/lib/auth/bd-phone';
import { jsonError, jsonOk } from '@/lib/auth/errors';
import { notifyAdminsPasswordResetRequested } from '@/lib/notifications/notify';

const schema = z.object({ phone: z.string().trim().min(6).max(20) });
const TTL_MIN = 5;

function sha256(v: string) { return createHash('sha256').update(v).digest('hex'); }
function makeCode() { let c = ''; for (let i = 0; i < 6; i++) c += randomInt(0, 10).toString(); return c; }

async function flagEnabled(): Promise<boolean> {
  try {
    const row = await db.systemSetting.findUnique({ where: { key: 'forgot_password_enabled' } });
    return (row?.value ?? '').trim() === '1';
  } catch { return false; }
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  let body: unknown;
  try { body = await req.json(); } catch { return jsonError(400, 'BAD_JSON'); }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return jsonError(400, 'VALIDATION');

  if (!(await flagEnabled())) {
    return jsonError(503, 'FORGOT_DISABLED', 'Password reset by SMS is turned off right now.');
  }

  if (!rateLimit(`forgot-sms-start:ip:${ip}`, 10, 60_000).ok) return jsonError(429, 'RATE_LIMITED');

  const local = canonicalBdPhone(parsed.data.phone);
  // Invalid shape: reply ok anyway (no enumeration), just send nothing.
  if (!local) return jsonOk({ ok: true, expiresInMinutes: TTL_MIN });

  if (!rateLimit(`forgot-sms-start:phone:${local}`, 5, 5 * 60_000).ok) return jsonError(429, 'RATE_LIMITED');

  const user = await db.user.findFirst({
    where: { phone: { in: bdPhoneSearchVariants(local) } },
    select: { id: true, status: true },
  });

  // Only generate + send for a real, non-blocked account. Reply ok
  // either way so the caller cannot tell which numbers are registered.
  if (user && user.status !== 'blocked') {
    const code = makeCode();
    try {
      await db.otpCode.create({
        data: {
          phone: local,
          codeHash: sha256(code),
          purpose: 'reset',
          ip,
          expiresAt: new Date(Date.now() + TTL_MIN * 60_000),
        },
      });
      await sendOtpSms(local, code, 'reset');
    } catch (err) {
      console.error('[forgot/sms/start] send failed', err);
    }
    // Best-effort admin ping (bell + Telegram). Masks all but the last
    // 3 digits and never carries the OTP.
    try {
      const masked = local.length > 3 ? `${'*'.repeat(local.length - 3)}${local.slice(-3)}` : local;
      await notifyAdminsPasswordResetRequested({ identifier: masked, channel: 'sms' });
    } catch (err) {
      console.error('[forgot/sms/start] admin notify failed', err);
    }
  }

  return jsonOk({ ok: true, expiresInMinutes: TTL_MIN });
}
