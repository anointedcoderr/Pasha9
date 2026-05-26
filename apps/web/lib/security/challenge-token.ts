// Built by Anointed Coder.
//
// Short-lived signed JWT that carries the "password verified, awaiting
// 2FA" intent between the password step and the 2FA challenge step.
// Lives ~5 minutes so an attacker who only steals the challenge
// token has no useful window.

import { SignJWT, jwtVerify } from 'jose';
import { createHash } from 'node:crypto';

const TTL_SECONDS = 5 * 60;

function key(): Uint8Array {
  const secret = process.env.JWT_SECRET ?? 'pasha9-dev-secret-do-not-use';
  return createHash('sha256').update(secret + ':2fa-challenge').digest();
}

export interface ChallengeClaims {
  sub: string;
  surface: 'user' | 'admin';
}

export async function signChallengeToken(claims: ChallengeClaims): Promise<string> {
  return new SignJWT({ surface: claims.surface })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(claims.sub)
    .setIssuedAt()
    .setExpirationTime(`${TTL_SECONDS}s`)
    .sign(key());
}

export async function verifyChallengeToken(token: string): Promise<ChallengeClaims | null> {
  try {
    const { payload } = await jwtVerify(token, key());
    const surface = payload.surface === 'admin' ? 'admin' : 'user';
    if (typeof payload.sub !== 'string') return null;
    return { sub: payload.sub, surface };
  } catch {
    return null;
  }
}
