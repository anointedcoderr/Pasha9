// Built by Anointed Coder.

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db/client';
import { verifyPassword } from '@/lib/auth/password';
import { setAuthCookies, getClientIp, getUserAgent, revokePriorSessionsForUser, revokeRefreshFromCurrentCookie } from '@/lib/auth/session';
import { loadPermissionsForRole } from '@/lib/auth/rbac';
import { rateLimit } from '@/lib/auth/rate-limit';
import { jsonError, jsonOk } from '@/lib/auth/errors';

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
  const limit = rateLimit(`login:${ip}`, 10, 60_000);
  if (!limit.ok) return jsonError(429, 'RATE_LIMITED', 'Too many attempts. Try again in a minute.');

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
    return jsonError(401, 'INVALID_CREDENTIALS', 'Invalid username or password.');
  }
  if (user.status === 'blocked') {
    // Make sure any leftover refresh session row from before the block
    // is also revoked so the user cannot transparently refresh.
    await revokePriorSessionsForUser(user.id);
    return jsonError(403, 'USER_BLOCKED', 'This account is suspended. Contact support.');
  }

  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) {
    return jsonError(401, 'INVALID_CREDENTIALS', 'Invalid username or password.');
  }

  await db.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date(), lastLoginIp: ip },
  });

  // Kill any prior sessions for this user (other devices and this
  // device's previous account) AND specifically revoke whatever session
  // row the existing pasha9_refresh cookie points to before issuing
  // fresh cookies. Prevents cross-account state leakage in the same
  // browser.
  await revokePriorSessionsForUser(user.id);
  await revokeRefreshFromCurrentCookie();

  const perms = await loadPermissionsForRole(user.roleId);
  await setAuthCookies(user.id, user.role.key, perms, {
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
      userAgent: getUserAgent(),
    },
  });

  return jsonOk({
    user: {
      id: user.id,
      username: user.username,
      phone: user.phone,
      role: user.role.key,
      status: user.status,
    },
  });
}
