// Built by Anointed Coder.
//
// POST /api/auth/forgot/phone/verify
// Body: { idToken: string }
//
// Verifies a Firebase ID token obtained client-side after the player
// completes the phone-auth challenge (SMS code entered into the
// browser-side Firebase widget). Matches the verified E.164 phone
// against the Pasha 9 user table - if a user is found, mints a
// short-lived PasswordResetToken (status='approved',
// verifiedVia='firebase_phone') and returns the raw token to the
// client for the next step.
//
// The response shape is identical when the phone does not match a
// user, except resetToken is omitted - the client renders the same
// "verification succeeded" UI so an attacker cannot enumerate which
// phones are registered.
//
// Gated by SystemSetting key 'forgot_password_enabled'. While the
// flag is off the endpoint returns 503 FORGOT_DISABLED so an
// operator can ship the deploy and confirm Firebase wiring with a
// single test phone before flipping the flag on for all players.

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { createHash, randomBytes } from 'crypto';
import { db } from '@/lib/db/client';
import { jsonError, jsonOk } from '@/lib/auth/errors';
import { rateLimit } from '@/lib/auth/rate-limit';
import { recordActivity } from '@/lib/auth/guard';
import { verifyFirebasePhoneIdToken, isFirebaseConfigured } from '@/lib/firebase/admin';
import { bdPhoneVariants } from '@/lib/firebase/phone';

const schema = z.object({
  idToken: z.string().trim().min(50).max(8000),
});

const RESET_TTL_MIN = 10;

async function isFlagEnabled(): Promise<boolean> {
  try {
    const row = await db.systemSetting.findUnique({
      where: { key: 'forgot_password_enabled' },
      select: { value: true },
    });
    return (row?.value ?? '0').trim() === '1';
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'anon';
  const ua = req.headers.get('user-agent') ?? null;

  // Per-IP rate limit. Phone-specific rate-limit happens implicitly via
  // Firebase Authentication's per-phone abuse controls (configured in
  // the Firebase console SMS region policy + sign-up quota panel).
  if (!rateLimit(`forgot-phone-verify:${ip}`, 10, 60 * 60_000).ok) {
    return jsonError(429, 'RATE_LIMITED');
  }

  if (!(await isFlagEnabled())) {
    return jsonError(503, 'FORGOT_DISABLED', 'Forgot Password by SMS is not enabled. Contact support.');
  }
  if (!isFirebaseConfigured()) {
    console.error('[forgot/phone/verify] FIREBASE_ADMIN_NOT_CONFIGURED');
    return jsonError(503, 'FORGOT_DISABLED', 'Phone reset is temporarily unavailable.');
  }

  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) return jsonError(400, 'VALIDATION');

  // 1. Verify the Firebase ID token. Throws on signature mismatch,
  //    expired token, revoked Firebase user, or missing phone claim.
  let verified;
  try {
    verified = await verifyFirebasePhoneIdToken(parsed.data.idToken);
  } catch (err) {
    const code = err instanceof Error ? err.message : 'INVALID_TOKEN';
    // Log internally so we can debug Firebase wiring issues without
    // revealing detail to the client. Generic VERIFICATION_FAILED so
    // an attacker cannot distinguish "bad token" from "expired token"
    // from "no phone claim".
    console.error('[forgot/phone/verify] firebase verify failed', code, err);
    await recordActivity({
      actorId: 'guest',
      actorRole: 'guest',
      action: 'FORGOT_PHONE_VERIFY_FAIL',
      target: undefined,
      detail: code,
      meta: { ip, ua, code },
    }).catch(() => null);
    return jsonError(400, 'VERIFICATION_FAILED', 'Could not verify your phone. Please request a new code and try again.');
  }

  // 2. Match the E.164 phone against the user table across every
  //    storage variant. legacy registrations may have stored the local
  //    "01..." form or the country-prefixed "880..." form.
  const variants = bdPhoneVariants(verified.phoneNumber);
  if (!variants) {
    // Firebase returned a phone the engine cannot parse as a BD mobile.
    // Treat it as no match (enumeration-safe) and log.
    console.error('[forgot/phone/verify] unparseable firebase phone', verified.phoneNumber);
    return jsonOk({ ok: true, verified: true, resetToken: null });
  }

  const user = await db.user.findFirst({
    where: { phone: { in: variants.all } },
    select: { id: true, status: true, username: true },
  });

  // 3. Enumeration-safe path: when the verified phone does not match a
  //    Pasha 9 user, return ok=true with no resetToken. The 3-step UI
  //    surfaces a generic "phone not registered" message at step 3.
  if (!user) {
    await recordActivity({
      actorId: 'guest',
      actorRole: 'guest',
      action: 'FORGOT_PHONE_VERIFY_NO_USER',
      target: undefined,
      detail: verified.phoneNumber,
      meta: { ip, ua, firebaseUid: verified.uid },
    }).catch(() => null);
    return jsonOk({ ok: true, verified: true, resetToken: null });
  }

  // Blocked users cannot reset their own password. They still see the
  // generic "verified, will email you" branch.
  if (user.status === 'blocked') {
    await recordActivity({
      actorId: user.id,
      actorRole: 'user',
      action: 'FORGOT_PHONE_VERIFY_BLOCKED',
      target: user.id,
      detail: 'blocked',
      meta: { ip, ua, firebaseUid: verified.uid },
    }).catch(() => null);
    return jsonOk({ ok: true, verified: true, resetToken: null });
  }

  // 4. Mint a single-use PasswordResetToken approved by Firebase.
  const raw = randomBytes(32).toString('base64url');
  const tokenHash = createHash('sha256').update(raw).digest('hex');
  const expiresAt = new Date(Date.now() + RESET_TTL_MIN * 60_000);
  await db.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash,
      ip,
      expiresAt,
      status: 'approved',
      identifier: verified.phoneNumber,
      verifiedVia: 'firebase_phone',
      verifiedPhoneE164: verified.phoneNumber,
      firebaseUid: verified.uid,
      approvedAt: new Date(),
    },
  });

  await recordActivity({
    actorId: user.id,
    actorRole: 'user',
    action: 'FORGOT_PHONE_VERIFY_OK',
    target: user.id,
    detail: 'firebase_phone',
    meta: { ip, ua, firebaseUid: verified.uid, expiresAt: expiresAt.toISOString() },
  }).catch(() => null);

  return jsonOk({
    ok: true,
    verified: true,
    resetToken: raw,
    expiresAt: expiresAt.toISOString(),
  });
}
