// Built by Anointed Coder.

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db/client';
import { hashPassword } from '@/lib/auth/password';
import { setAuthCookies, getClientIp, getUserAgent, revokeRefreshFromCurrentCookie } from '@/lib/auth/session';
import { generateUniqueReferralCode } from '@/lib/auth/referral';
import { loadPermissionsForRole } from '@/lib/auth/rbac';
import { rateLimit } from '@/lib/auth/rate-limit';
import { jsonError, jsonOk } from '@/lib/auth/errors';

const bdPhone = /^(?:\+?880|0)?1[3-9]\d{8}$/;

const schema = z.object({
  username: z.string().trim().min(3).max(24).regex(/^[a-zA-Z0-9_.]+$/, 'Letters, numbers, underscore or dot only'),
  phone: z.string().trim().regex(bdPhone, 'Enter a valid Bangladesh mobile number'),
  password: z.string().min(6, 'Password must be at least 6 characters').max(128),
  referral: z.string().trim().max(24).optional().or(z.literal('')),
});

export async function POST(req: NextRequest) {
  const ip = getClientIp() ?? 'unknown';
  const limit = rateLimit(`register:${ip}`, 10, 60_000);
  if (!limit.ok) return jsonError(429, 'RATE_LIMITED', 'Too many attempts. Try again in a minute.');

  let body: unknown;
  try { body = await req.json(); } catch { return jsonError(400, 'BAD_JSON'); }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, 'VALIDATION', 'Please check your input', { issues: parsed.error.issues });
  }

  const { username, phone, password, referral } = parsed.data;

  // Normalise phone: keep digits only after the country prefix.
  const normalisedPhone = phone.startsWith('+') ? phone : phone.startsWith('880') ? `+${phone}` : phone;

  const existing = await db.user.findFirst({
    where: { OR: [{ username }, { phone: normalisedPhone }] },
    select: { id: true, username: true, phone: true },
  });
  if (existing) {
    if (existing.username === username) return jsonError(409, 'USERNAME_TAKEN', 'This username is already in use.');
    return jsonError(409, 'PHONE_TAKEN', 'This phone number is already registered.');
  }

  const role = await db.role.findUnique({ where: { key: 'user' } });
  if (!role) return jsonError(500, 'ROLE_MISSING', 'Default user role is not seeded.');

  let referredById: string | null = null;
  const code = referral?.trim();
  if (code) {
    const ref = await db.user.findUnique({ where: { referralCode: code }, select: { id: true } });
    if (ref) referredById = ref.id;
  }

  const passwordHash = await hashPassword(password);
  const referralCode = await generateUniqueReferralCode();

  const user = await db.user.create({
    data: {
      username,
      phone: normalisedPhone,
      passwordHash,
      passwordChangedAt: new Date(),
      roleId: role.id,
      referralCode,
      referredById,
      wallet: { create: {} },
    },
    select: { id: true, username: true, phone: true, referralCode: true, role: { select: { key: true } } },
  });

  // If a previous account was logged in on this device, revoke that
  // session row before issuing the new user's cookies. setAuthCookies
  // below overwrites both cookies so there is no cross-account leakage.
  await revokeRefreshFromCurrentCookie();

  const perms = await loadPermissionsForRole(role.id);
  await setAuthCookies(user.id, user.role.key, perms, {
    ip,
    userAgent: getUserAgent(),
  });

  await db.activityLog.create({
    data: {
      actorId: user.id,
      actorRole: user.role.key,
      action: 'USER_REGISTER',
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
      referralCode: user.referralCode,
      role: user.role.key,
    },
  }, 201);
}
