// Built by Anointed Coder.
//
// Standalone refresh endpoint. POST hits refreshSession() which
// validates the pasha9_refresh cookie against the DB session row,
// mints a new access cookie (and rotates the refresh secret), and
// returns the basic user claims. Useful for clients that want to
// renew without going through /api/auth/me.

export const dynamic = 'force-dynamic';

import { refreshSession } from '@/lib/auth/session';
import { jsonError, jsonOk } from '@/lib/auth/errors';

export async function POST() {
  const claims = await refreshSession();
  if (!claims) return jsonError(401, 'UNAUTHENTICATED');
  return jsonOk({ ok: true, sub: claims.sub, role: claims.role });
}
