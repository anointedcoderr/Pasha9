// Built by Anointed Coder.

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db/client';
import { verifyPassword } from '@/lib/auth/password';
import { setAuthCookies, getClientIp, getUserAgent } from '@/lib/auth/session';
import { loadPermissionsForRole } from '@/lib/auth/rbac';
import { rateLimit } from '@/lib/auth/rate-limit';
import { jsonError, jsonOk } from '@/lib/auth/errors';

const ADMIN_ROLES = new Set(['super_admin', 'admin', 'staff']);

const schema = z.object({
  username: z.string().trim().min(3).max(64),
  password: z.string().min(1).max(128),
});

export async function POST(req: NextRequest) {
  const ip = getClientIp() ?? 'unknown';
  const limit = rateLimit(`admin-login:${ip}`, 8, 60_000);
  if (!limit.ok) return jsonError(429, 'RATE_LIMITED');

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
    return jsonError(401, 'INVALID_CREDENTIALS', 'Invalid username or password.');
  }
  if (user.status === 'blocked') {
    return jsonError(403, 'STAFF_BLOCKED', 'This staff account is suspended.');
  }

  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) return jsonError(401, 'INVALID_CREDENTIALS', 'Invalid username or password.');

  await db.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date(), lastLoginIp: ip },
  });

  const perms = await loadPermissionsForRole(user.roleId);
  await setAuthCookies(user.id, user.role.key, perms, {
    ip,
    userAgent: getUserAgent(),
  });

  await db.activityLog.create({
    data: {
      actorId: user.id,
      actorRole: user.role.key,
      action: 'ADMIN_LOGIN',
      target: user.id,
      ip,
      userAgent: getUserAgent(),
    },
  });

  return jsonOk({
    user: { id: user.id, username: user.username, role: user.role.key },
  });
}
