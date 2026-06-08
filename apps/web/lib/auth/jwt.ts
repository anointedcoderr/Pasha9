// Built by Anointed Coder.
// JWT helpers using the `jose` library (Edge-runtime safe, no Node crypto deps).
//
// Access token: short-lived, carried in the pasha9_session cookie.
// Refresh token: longer-lived, carried in the pasha9_refresh cookie and tracked in DB.

import { SignJWT, jwtVerify, type JWTPayload } from 'jose';

// Access token lasts 24h and refresh extends to 90 days so a normal
// session survives browser restarts and multi-day gaps without a
// re-login. Logout still clears both cookies, an admin block still
// revokes the refresh session, and the transparent refresh path in
// /api/auth/me + /api/auth/refresh keeps minting fresh access tokens
// from the long-lived refresh cookie. Both still overridable via env.
const ACCESS_TTL = process.env.JWT_ACCESS_TTL ?? '24h';
const REFRESH_TTL = process.env.JWT_REFRESH_TTL ?? '90d';

function secretBytes(envKey: string): Uint8Array {
  const value = process.env[envKey];
  if (!value || value.length < 16) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(`${envKey} must be set to a value of at least 16 characters in production`);
    }
    return new TextEncoder().encode('pasha9-dev-secret-do-not-use-in-prod-pasha9');
  }
  return new TextEncoder().encode(value);
}

export interface AccessClaims extends JWTPayload {
  sub: string;
  role: string;
  perms?: string[];
}

export interface RefreshClaims extends JWTPayload {
  sub: string;
  sid: string; // session row id
}

export async function signAccessToken(claims: AccessClaims): Promise<string> {
  return new SignJWT(claims)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(ACCESS_TTL)
    .setIssuer('pasha9')
    .setAudience('pasha9-web')
    .sign(secretBytes('JWT_ACCESS_SECRET'));
}

export async function signRefreshToken(claims: RefreshClaims): Promise<string> {
  return new SignJWT(claims)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(REFRESH_TTL)
    .setIssuer('pasha9')
    .setAudience('pasha9-refresh')
    .sign(secretBytes('JWT_REFRESH_SECRET'));
}

export async function verifyAccessToken(token: string): Promise<AccessClaims | null> {
  try {
    const { payload } = await jwtVerify(token, secretBytes('JWT_ACCESS_SECRET'), {
      issuer: 'pasha9',
      audience: 'pasha9-web',
    });
    return payload as AccessClaims;
  } catch {
    return null;
  }
}

export async function verifyRefreshToken(token: string): Promise<RefreshClaims | null> {
  try {
    const { payload } = await jwtVerify(token, secretBytes('JWT_REFRESH_SECRET'), {
      issuer: 'pasha9',
      audience: 'pasha9-refresh',
    });
    return payload as RefreshClaims;
  } catch {
    return null;
  }
}
