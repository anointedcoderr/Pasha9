// Built by Anointed Coder.

export const dynamic = 'force-dynamic';

import { db } from '@/lib/db/client';
import { getOrRefreshSessionClaims } from '@/lib/auth/session';
import { jsonError, jsonOk } from '@/lib/auth/errors';

export async function GET() {
  // Transparent refresh: if the short access cookie has expired but the
  // long-lived refresh cookie still maps to a valid DB session, mint a
  // fresh access cookie before responding so the visitor never has to
  // re-authenticate during a normal session.
  const claims = await getOrRefreshSessionClaims();
  if (!claims) return jsonError(401, 'UNAUTHENTICATED');

  const user = await db.user.findUnique({
    where: { id: claims.sub },
    select: {
      id: true,
      username: true,
      phone: true,
      email: true,
      referralCode: true,
      referredById: true,
      status: true,
      blockedReason: true,
      blockedAt: true,
      language: true,
      country: true,
      lastLoginAt: true,
      phoneVerifiedAt: true,
      role: { select: { key: true, label: true } },
      wallet: { select: { balance: true, bonusBalance: true, lockedBalance: true, lottoBalance: true, currency: true } },
    },
  });

  if (!user) return jsonError(401, 'UNAUTHENTICATED');

  return jsonOk({ user });
}
