// Built by Anointed Coder.
//
// Admin login. M2K additions:
//   - IP block list check (returns 403 IP_BLOCKED, audited)
//   - LoginAttempt row written for EVERY attempt success or fail
//   - heuristic flags appended to the audit row + ActivityLog
//   - if user has TOTP enabled, returns { challenge: true,
//     challengeToken } instead of cookies so the client can finish
//     via /api/auth/2fa/challenge
//   - SMS admin-login alert via M2I (fail-safe) on successful
//     non-2FA flow; the 2FA challenge route fires the alert on the
//     2FA-completed flow

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db/client';
import { verifyPassword } from '@/lib/auth/password';
import { setAuthCookies, getClientIp, getUserAgent } from '@/lib/auth/session';
import { loadEffectivePermissions } from '@/lib/auth/rbac';
import { rateLimit } from '@/lib/auth/rate-limit';
import { jsonError, jsonOk } from '@/lib/auth/errors';
import { isIpBlocked } from '@/lib/security/ip-block';
import { recordLoginAttempt } from '@/lib/security/login-attempts';
import { scoreLoginContext } from '@/lib/security/heuristics';
import { signChallengeToken } from '@/lib/security/challenge-token';
import { sendSms } from '@/lib/sms/service';

const ADMIN_ROLES = new Set(['super_admin', 'admin', 'staff']);

const schema = z.object({
  username: z.string().trim().min(3).max(64),
  password: z.string().min(1).max(128),
});

export async function POST(req: NextRequest) {
  const ip = getClientIp() ?? 'unknown';
  const ua = getUserAgent() ?? '';

  const limit = rateLimit(`admin-login:${ip}`, 8, 60_000);
  if (!limit.ok) {
    await recordLoginAttempt({ identifier: '<unknown>', surface: 'admin', ip, userAgent: ua, success: false, reason: 'rate_limited' });
    return jsonError(429, 'RATE_LIMITED');
  }

  // M2K IP block list check.
  const blocked = await isIpBlocked(ip);
  if (blocked.blocked) {
    await recordLoginAttempt({ identifier: '<unknown>', surface: 'admin', ip, userAgent: ua, success: false, reason: 'ip_blocked', flags: ['ip_blocked'] });
    return jsonError(403, 'IP_BLOCKED', 'Your IP is blocked. Contact support.');
  }

  let body: unknown;
  try { body = await req.json(); } catch { return jsonError(400, 'BAD_JSON'); }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return jsonError(400, 'VALIDATION');

  const { username, password } = parsed.data;

  const user = await db.user.findUnique({
    where: { username },
    include: { role: true },
  });

  if (!user || !ADMIN_ROLES.has(user.role.key)) {
    await recordLoginAttempt({ identifier: username, surface: 'admin', ip, userAgent: ua, success: false, reason: 'unknown_user' });
    return jsonError(401, 'INVALID_CREDENTIALS', 'Invalid username or password.');
  }
  if (user.status === 'blocked') {
    await recordLoginAttempt({ identifier: username, userId: user.id, surface: 'admin', ip, userAgent: ua, success: false, reason: 'blocked' });
    return jsonError(403, 'STAFF_BLOCKED', 'This staff account is suspended.');
  }

  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) {
    await recordLoginAttempt({ identifier: username, userId: user.id, surface: 'admin', ip, userAgent: ua, success: false, reason: 'bad_password' });
    return jsonError(401, 'INVALID_CREDENTIALS', 'Invalid username or password.');
  }

  const score = await scoreLoginContext({ userId: user.id, surface: 'admin', ip, userAgent: ua });

  // If TOTP is enabled, do NOT mint cookies. Return a challenge
  // token; the client completes via /api/auth/2fa/challenge.
  if (user.totpEnabled) {
    await recordLoginAttempt({
      identifier: username, userId: user.id, surface: 'admin', ip, userAgent: ua,
      success: false, reason: '2fa_required', flags: score.flags,
    });
    const challengeToken = await signChallengeToken({ sub: user.id, surface: 'admin' });
    return jsonOk({ challenge: true, challengeToken, flags: score.flags });
  }

  await db.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date(), lastLoginIp: ip },
  });

  const perms = await loadEffectivePermissions(user.id);
  await setAuthCookies(user.id, user.role.key, perms, { ip, userAgent: ua });

  await db.activityLog.create({
    data: {
      actorId: user.id,
      actorRole: user.role.key,
      action: 'ADMIN_LOGIN',
      target: user.id,
      ip,
      userAgent: ua,
      detail: score.flags.length > 0 ? score.flags.join(',') : null,
    },
  });

  await recordLoginAttempt({
    identifier: username, userId: user.id, surface: 'admin', ip, userAgent: ua,
    success: true, reason: 'ok', flags: score.flags,
  });

  // M2I SMS admin login alert. Fail-safe.
  try {
    await sendSms({
      phone: user.phone,
      userId: user.id,
      template: 'admin_login_alert',
      triggerKey: `admin_login:${user.id}:${Date.now()}`,
      body: `Pasha 9: New admin login on your account at ${new Date().toUTCString()} from ${ip}.${score.flags.length > 0 ? ' Flags: ' + score.flags.join(',') : ''}`,
    });
  } catch (err) {
    console.error('[admin-login] SMS alert failed', err);
  }

  return jsonOk({
    user: { id: user.id, username: user.username, role: user.role.key },
    flags: score.flags,
  });
}
