// Built by Anointed Coder.
// Session helpers: cookie management, refresh token tracking in DB, login flow side-effects.

import { cookies, headers } from 'next/headers';
import { createHash, randomBytes } from 'node:crypto';
import { db } from '@/lib/db/client';
import { signAccessToken, signRefreshToken, verifyAccessToken, verifyRefreshToken, type AccessClaims } from './jwt';
import { loadPermissionsForRole } from './rbac';

export const ACCESS_COOKIE = 'pasha9_session';
export const REFRESH_COOKIE = 'pasha9_refresh';

// Cookie lifetimes mirror the JWT TTLs in lib/auth/jwt.ts. Bumped from
// 15 min / 7 days so a normal session does not log out mid-flow.
const ACCESS_MAX_AGE_SECONDS = 8 * 60 * 60; // 8 hours
const REFRESH_MAX_AGE_SECONDS = 30 * 24 * 60 * 60; // 30 days

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export function makeRefreshSecret(): string {
  return randomBytes(48).toString('base64url');
}

export function hashToken(token: string): string {
  return sha256(token);
}

interface CookieOptions {
  secure: boolean;
}

function cookieOpts(): CookieOptions {
  return { secure: process.env.NODE_ENV === 'production' };
}

export async function setAuthCookies(userId: string, role: string, perms: string[], opts: { userAgent?: string; ip?: string } = {}) {
  const access = await signAccessToken({ sub: userId, role, perms });
  const refreshSecret = makeRefreshSecret();
  const session = await db.session.create({
    data: {
      userId,
      tokenHash: hashToken(refreshSecret),
      userAgent: opts.userAgent,
      ip: opts.ip,
      expiresAt: new Date(Date.now() + REFRESH_MAX_AGE_SECONDS * 1000),
    },
  });
  const refresh = await signRefreshToken({ sub: userId, sid: session.id });

  const jar = cookies();
  const { secure } = cookieOpts();
  jar.set(ACCESS_COOKIE, access, {
    httpOnly: true,
    sameSite: 'lax',
    secure,
    path: '/',
    maxAge: ACCESS_MAX_AGE_SECONDS,
  });
  // Hold the raw secret alongside the session id so the refresh handler can find the row.
  jar.set(REFRESH_COOKIE, refresh + '.' + refreshSecret, {
    httpOnly: true,
    sameSite: 'lax',
    secure,
    path: '/',
    maxAge: REFRESH_MAX_AGE_SECONDS,
  });
}

/**
 * Mark every non-revoked Session row for this user as revoked. Call
 * before issuing a fresh access cookie on register / login so a
 * previous device's refresh cookie can no longer mint new access
 * tokens, AND when an admin blocks a user so they cannot transparently
 * refresh while blocked.
 */
export async function revokePriorSessionsForUser(userId: string): Promise<number> {
  const result = await db.session.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  return result.count;
}

/**
 * Best-effort revoke of the specific session row whose secret matches
 * the current pasha9_refresh cookie in the request. Used inside
 * register so a previously-logged-in account's session is invalidated
 * before the new account's cookies take over.
 */
export async function revokeRefreshFromCurrentCookie(): Promise<void> {
  const raw = cookies().get(REFRESH_COOKIE)?.value;
  if (!raw) return;
  const split = raw.split('.');
  if (split.length < 2) return;
  const secret = split[split.length - 1];
  if (!secret) return;
  try {
    await db.session.updateMany({
      where: { tokenHash: hashToken(secret), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  } catch {
    // best-effort, do not block the register/login flow
  }
}

export async function clearAuthCookies(opts: { revoke?: boolean } = { revoke: true }) {
  const jar = cookies();
  const refresh = jar.get(REFRESH_COOKIE)?.value;

  if (opts.revoke && refresh) {
    const [, secret] = refresh.split('.', 2);
    if (secret) {
      try {
        await db.session.updateMany({
          where: { tokenHash: hashToken(secret), revokedAt: null },
          data: { revokedAt: new Date() },
        });
      } catch {
        // best-effort revoke; do not block logout
      }
    }
  }

  jar.delete(ACCESS_COOKIE);
  jar.delete(REFRESH_COOKIE);
}

export async function getSessionClaims(): Promise<AccessClaims | null> {
  const token = cookies().get(ACCESS_COOKIE)?.value;
  if (!token) return null;
  return verifyAccessToken(token);
}

/**
 * Best-effort: if the access cookie is missing or expired but the
 * refresh cookie still resolves to a valid, non-revoked session in
 * the DB, mint a fresh access cookie (and rotate the refresh secret
 * for safety) and return the new claims. Returns null otherwise.
 *
 * Safe to call on any request - never throws on bad/missing cookies.
 * Used by /api/auth/me and /api/auth/refresh so users do not get
 * bounced just because the short access cookie expired.
 */
export async function refreshSession(): Promise<AccessClaims | null> {
  const jar = cookies();
  const raw = jar.get(REFRESH_COOKIE)?.value;
  if (!raw) return null;

  const split = raw.split('.');
  if (split.length < 2) return null;
  const secret = split[split.length - 1];
  const refreshJwt = split.slice(0, -1).join('.');
  if (!secret || !refreshJwt) return null;

  const claims = await verifyRefreshToken(refreshJwt);
  if (!claims) return null;

  const session = await db.session.findUnique({ where: { id: claims.sid } });
  if (!session || session.revokedAt || session.expiresAt < new Date()) return null;
  if (session.tokenHash !== hashToken(secret)) return null;
  if (session.userId !== claims.sub) return null;

  const user = await db.user.findUnique({
    where: { id: session.userId },
    include: { role: true },
  });
  if (!user || user.status === 'blocked') return null;

  const perms = await loadPermissionsForRole(user.roleId);
  // Reissue both cookies (rotates the refresh secret so a stolen
  // refresh token has a smaller usable window). The DB session row
  // is replaced via setAuthCookies' insert, which is fine for M1
  // since the existing row's metadata is already in DB.
  await setAuthCookies(user.id, user.role.key, perms, {
    userAgent: session.userAgent ?? undefined,
    ip: session.ip ?? undefined,
  });
  // Revoke the old session row so it cannot be replayed.
  try {
    await db.session.update({
      where: { id: session.id },
      data: { revokedAt: new Date() },
    });
  } catch {
    // best-effort
  }

  return { sub: user.id, role: user.role.key, perms } as AccessClaims;
}

/**
 * Returns the live access claims if present, otherwise transparently
 * attempts a refresh. Use this anywhere you want "logged in if at
 * all possible".
 */
export async function getOrRefreshSessionClaims(): Promise<AccessClaims | null> {
  const claims = await getSessionClaims();
  if (claims) return claims;
  return refreshSession();
}

export async function requireSession(): Promise<AccessClaims> {
  const claims = await getOrRefreshSessionClaims();
  if (!claims) throw new Error('UNAUTHENTICATED');
  return claims;
}

export function getClientIp(): string | undefined {
  const h = headers();
  const xf = h.get('x-forwarded-for');
  if (xf) return xf.split(',')[0]?.trim();
  return h.get('x-real-ip') ?? undefined;
}

export function getUserAgent(): string | undefined {
  return headers().get('user-agent') ?? undefined;
}
