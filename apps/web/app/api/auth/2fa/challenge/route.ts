// Built by Anointed Coder.
//
// 2FA challenge completion. Called from the login UI after the
// password call returned { challenge: true }. The client passes
// back the pending login token (a short-lived signed JWT we minted
// at the password-OK step) plus the 6-digit code or recovery code.
// On success we issue the real access + refresh cookies.

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db/client';
import { jsonError, jsonOk } from '@/lib/auth/errors';
import { setAuthCookies, getClientIp, getUserAgent, revokePriorSessionsForUser } from '@/lib/auth/session';
import { loadEffectivePermissions } from '@/lib/auth/rbac';
import { verifyTotp, consumeRecoveryCode } from '@/lib/security/totp';
import { recordLoginAttempt } from '@/lib/security/login-attempts';
import { verifyChallengeToken } from '@/lib/security/challenge-token';
import { rateLimit } from '@/lib/auth/rate-limit';
import { sendSms } from '@/lib/sms/service';
import { scoreLoginContext } from '@/lib/security/heuristics';

const schema = z.object({
  challengeToken: z.string().min(20).max(2000),
  code: z.string().min(4).max(20),
});

const ADMIN_ROLES = new Set(['super_admin', 'admin', 'staff']);

export async function POST(req: NextRequest) {
  const ip = getClientIp() ?? 'unknown';
  const ua = getUserAgent() ?? '';
  const limit = rateLimit(`2fa-challenge:${ip}`, 10, 60_000);
  if (!limit.ok) return jsonError(429, 'RATE_LIMITED');

  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) return jsonError(400, 'VALIDATION');

  const claims = await verifyChallengeToken(parsed.data.challengeToken);
  if (!claims) return jsonError(401, 'CHALLENGE_INVALID', 'The challenge has expired. Please log in again.');

  const user = await db.user.findUnique({
    where: { id: claims.sub },
    include: { role: true },
  });
  if (!user) return jsonError(401, 'USER_GONE');
  if (user.status === 'blocked') return jsonError(403, 'USER_BLOCKED');
  if (!user.totpEnabled || !user.totpSecret) return jsonError(400, 'TOTP_NOT_ENABLED');

  // Either a TOTP code or a recovery code is accepted. Recovery
  // codes are single-use and the remaining list is persisted.
  let ok = verifyTotp(parsed.data.code, user.totpSecret);
  let usedRecovery = false;
  let updatedRecoveryHash: string | null = null;
  if (!ok) {
    updatedRecoveryHash = consumeRecoveryCode(parsed.data.code, user.recoveryCodesHash);
    if (updatedRecoveryHash !== null) {
      ok = true;
      usedRecovery = true;
    }
  }

  if (!ok) {
    await recordLoginAttempt({
      identifier: user.username,
      userId: user.id,
      surface: claims.surface,
      ip,
      userAgent: ua,
      success: false,
      reason: '2fa_failed',
      flags: ['2fa'],
    });
    return jsonError(401, 'TOTP_INVALID', 'Invalid 2FA code.');
  }

  if (usedRecovery && updatedRecoveryHash !== null) {
    await db.user.update({
      where: { id: user.id },
      data: { recoveryCodesHash: updatedRecoveryHash },
    });
  }

  // Mirror the regular login flow: stamp last login + nuke previous
  // sessions + issue cookies.
  await db.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date(), lastLoginIp: ip },
  });
  if (claims.surface === 'user') {
    await revokePriorSessionsForUser(user.id);
  }

  const perms = await loadEffectivePermissions(user.id);
  await setAuthCookies(user.id, user.role.key, perms, { ip, userAgent: ua });

  const score = await scoreLoginContext({ userId: user.id, surface: claims.surface, ip, userAgent: ua });
  const flags = [...score.flags, ...(usedRecovery ? ['recovery_used'] : [])];

  await db.activityLog.create({
    data: {
      actorId: user.id,
      actorRole: user.role.key,
      action: claims.surface === 'admin' ? 'ADMIN_LOGIN' : 'USER_LOGIN',
      target: user.id,
      ip,
      userAgent: ua,
      detail: flags.length > 0 ? flags.join(',') : null,
    },
  });

  await recordLoginAttempt({
    identifier: user.username,
    userId: user.id,
    surface: claims.surface,
    ip,
    userAgent: ua,
    success: true,
    reason: usedRecovery ? '2fa_recovery_ok' : '2fa_ok',
    flags,
  });

  // Admin login SMS alert (M2I integration). Fail-safe.
  if (claims.surface === 'admin' && ADMIN_ROLES.has(user.role.key)) {
    try {
      await sendSms({
        phone: user.phone,
        userId: user.id,
        template: 'admin_login_alert',
        triggerKey: `admin_login:${user.id}:${Date.now()}`,
        body: `Pasha 9: New admin login on your account at ${new Date().toUTCString()} from ${ip}.${flags.length > 0 ? ' Flags: ' + flags.join(',') : ''}`,
      });
    } catch (err) {
      console.error('[2fa-challenge] admin SMS alert failed', err);
    }
  }

  return jsonOk({
    user: { id: user.id, username: user.username, role: user.role.key },
    flags,
    usedRecoveryCode: usedRecovery,
  });
}
