// Built by Anointed Coder.

import { db } from '@/lib/db/client';
import { getSessionClaims } from '@/lib/auth/session';
import { jsonError, jsonOk } from '@/lib/auth/errors';

export async function GET() {
  const claims = await getSessionClaims();
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
      language: true,
      country: true,
      lastLoginAt: true,
      phoneVerifiedAt: true,
      role: { select: { key: true, label: true } },
      wallet: { select: { balance: true, bonusBalance: true, lockedBalance: true, currency: true } },
    },
  });

  if (!user) return jsonError(401, 'UNAUTHENTICATED');

  return jsonOk({ user });
}
