// Built by Anointed Coder.

export const dynamic = 'force-dynamic';

import { db } from '@/lib/db/client';
import { getOrRefreshSessionClaims } from '@/lib/auth/session';
import { loadEffectivePermissions } from '@/lib/auth/rbac';
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
      avatarUrl: true,
      referralCode: true,
      referredById: true,
      status: true,
      blockedReason: true,
      blockedAt: true,
      language: true,
      country: true,
      lastLoginAt: true,
      phoneVerifiedAt: true,
      totpEnabled: true,
      role: { select: { key: true, label: true } },
      wallet: { select: { balance: true, bonusBalance: true, lockedBalance: true, lottoBalance: true, currency: true } },
    },
  });

  if (!user) return jsonError(401, 'UNAUTHENTICATED');

  // Surface effective permissions for staff users so the admin shell
  // can filter the sidebar + drawer + page access. Players never get
  // an admin role so the load is cheap and skipped for them. Super
  // admins receive an empty array because they bypass every gate.
  let permissions: string[] = [];
  if (user.role?.key === 'admin' || user.role?.key === 'staff') {
    try {
      permissions = await loadEffectivePermissions(user.id);
    } catch (err) {
      console.error('[auth/me] loadEffectivePermissions failed', err);
    }
  }

  return jsonOk({ user, permissions });
}
