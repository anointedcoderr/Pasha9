// Built by Anointed Coder.
// Session helpers: cookie management, refresh token tracking in DB, login flow side-effects.

import { cookies, headers } from 'next/headers';
import { createHash, randomBytes } from 'node:crypto';
import { db } from '@/lib/db/client';
import { signAccessToken, signRefreshToken, verifyAccessToken, type AccessClaims } from './jwt';

export const ACCESS_COOKIE = 'pasha9_session';
export const REFRESH_COOKIE = 'pasha9_refresh';

const ACCESS_MAX_AGE_SECONDS = 15 * 60; // 15 minutes
const REFRESH_MAX_AGE_SECONDS = 7 * 24 * 60 * 60; // 7 days

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

export async function requireSession(): Promise<AccessClaims> {
  const claims = await getSessionClaims();
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
