// Built by Anointed Coder.

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db/client';
import { verifyPassword } from '@/lib/auth/password';
import { setAuthCookies, getClientIp, getUserAgent, revokeRefreshFromCurrentCookie, revokePriorSessionsForUser } from '@/lib/auth/session';
import { loadEffectivePermissions } from '@/lib/auth/rbac';
import { rateLimit } from '@/lib/auth/rate-limit';
import { jsonError, jsonOk } from '@/lib/auth/errors';
import { isIpBlocked } from '@/lib/security/ip-block';
import { recordLoginAttempt } from '@/lib/security/login-attempts';
import { scoreLoginContext } from '@/lib/security/heuristics';
import { signChallengeToken } from '@/lib/security/challenge-token';

const schema = z.object({
  identifier: z.string().trim().min(3, 'Enter your phone or username').max(64),
  password: z.string().min(1, 'Password is required').max(128),
});

function normalisePhone(input: string): string {
  if (input.startsWith('+880')) return input;
  if (input.startsWith('880')) return `+${input}`;
  return input;
}

export async function POST(req: NextRequest) {
  const ip = getClientIp() ?? 'unknown';
  const ua = getUserAgent() ?? '';
  const limit = rateLimit(`login:${ip}`, 10, 60_000);
  if (!limit.ok) {
    await recordLoginAttempt({ identifier: '<unknown>', surface: 'user', ip, userAgent: ua, success: false, reason: 'rate_limited' });
    return jsonError(429, 'RATE_LIMITED', 'Too many attempts. Try again in a minute.');
  }

  // M2K IP block list check.
  const blocked = await isIpBlocked(ip);
  if (blocked.blocked) {
    await recordLoginAttempt({ identifier: '<unknown>', surface: 'user', ip, userAgent: ua, success: false, reason: 'ip_blocked', flags: ['ip_blocked'] });
    return jsonError(403, 'IP_BLOCKED', 'Your IP is blocked. Contact support.');
  }

  let body: unknown;
  try { body = await req.json(); } catch { return jsonError(400, 'BAD_JSON'); }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, 'VALIDATION', 'Please check your input', { issues: parsed.error.issues });
  }

  const { identifier, password } = parsed.data;

  const phone = normalisePhone(identifier);

  const user = await db.user.findFirst({
    where: { OR: [{ username: identifier }, { phone }] },
    include: { role: true },
  });

  if (!user) {
    await recordLoginAttempt({ identifier, surface: 'user', ip, userAgent: ua, success: false, reason: 'unknown_user' });
    return jsonError(401, 'INVALID_CREDENTIALS', 'Invalid username or password.');
  }
  if (user.status === 'blocked') {
    await recordLoginAttempt({ identifier, userId: user.id, surface: 'user', ip, userAgent: ua, success: false, reason: 'blocked' });
    await revokePriorSessionsForUser(user.id);
    return jsonError(403, 'USER_BLOCKED', 'This account is suspended. Contact support.');
  }

  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) {
    await recordLoginAttempt({ identifier, userId: user.id, surface: 'user', ip, userAgent: ua, success: false, reason: 'bad_password' });
    return jsonError(401, 'INVALID_CREDENTIALS', 'Invalid username or password.');
  }

  const score = await scoreLoginContext({ userId: user.id, surface: 'user', ip, userAgent: ua });

  // M2K: if TOTP is enabled, hold off issuing cookies and ask the
  // client to complete via /api/auth/2fa/challenge.
  if (user.totpEnabled) {
    await recordLoginAttempt({
      identifier, userId: user.id, surface: 'user', ip, userAgent: ua,
      success: false, reason: '2fa_required', flags: score.flags,
    });
    const challengeToken = await signChallengeToken({ sub: user.id, surface: 'user' });
    return jsonOk({ challenge: true, challengeToken, flags: score.flags });
  }

  await db.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date(), lastLoginIp: ip },
  });

  // Revoke ONLY the session row that the current pasha9_refresh
  // cookie points to (the previous account on THIS device, if any).
  // Prevents cross-account state leakage in the same browser.
  //
  // Previously this also called revokePriorSessionsForUser(user.id)
  // which killed every active session for the logging-in user across
  // every device they owned - if a player logged in on the website
  // from a new browser, their phone was kicked out at the same
  // moment. Operators reported this as "accounts get logged out
  // automatically on refresh" because their test phones lost the
  // session whenever the same account was re-touched anywhere else.
  // Multi-device sessions for the same user are now preserved; the
  // /admin/users force-logout button still has access to the bulk
  // revoke via revokePriorSessionsForUser for the explicit security
  // case (password compromise, account block).
  await revokeRefreshFromCurrentCookie();

  const perms = await loadEffectivePermissions(user.id);
  const tokens = await setAuthCookies(user.id, user.role.key, perms, {
    ip,
    userAgent: getUserAgent(),
  });

  await db.activityLog.create({
    data: {
      actorId: user.id,
      actorRole: user.role.key,
      action: 'USER_LOGIN',
      target: user.id,
      ip,
      userAgent: ua,
      detail: score.flags.length > 0 ? score.flags.join(',') : null,
    },
  });

  await recordLoginAttempt({
    identifier, userId: user.id, surface: 'user', ip, userAgent: ua,
    success: true, reason: 'ok', flags: score.flags,
  });

  // Additive mobile contract: only when the request explicitly carries
  // X-Client: mobile do we also return the access/refresh tokens in the
  // body (native clients hold no cookies). Web requests get the exact
  // same body as before - no tokens leak to non-mobile callers.
  const isMobile = req.headers.get('x-client') === 'mobile';

  return jsonOk({
    user: {
      id: user.id,
      username: user.username,
      phone: user.phone,
      role: user.role.key,
      status: user.status,
    },
    flags: score.flags,
    ...(isMobile
      ? { token: tokens.token, refresh: tokens.refresh, expiresIn: tokens.expiresIn }
      : {}),
  });
}
