// Built by Anointed Coder.
//
// Mobile token refresh. A native client presents its refresh credential
// (the "<refreshJwt>.<secret>" string it received at login) either in
// the JSON body as { refresh } or as an "Authorization: Bearer <token>"
// header. We validate it against the DB-tracked session using the exact
// same refresh security logic as the web cookie path, rotate it, and
// return a fresh { ok:true, token, refresh, expiresIn } pair. Invalid,
// expired, revoked, or blocked credentials get a 401. This does not
// touch cookies, so the web session flow is unaffected.

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { refreshMobileSession } from '@/lib/auth/session';
import { jsonError, jsonOk } from '@/lib/auth/errors';

function readBearer(req: NextRequest): string | null {
  const auth = req.headers.get('authorization');
  if (auth && auth.toLowerCase().startsWith('bearer ')) {
    const token = auth.slice(7).trim();
    if (token) return token;
  }
  return null;
}

export async function POST(req: NextRequest) {
  let raw: string | null = null;

  try {
    const body = await req.json();
    if (body && typeof body.refresh === 'string') {
      raw = body.refresh.trim() || null;
    }
  } catch {
    // No / invalid JSON body: fall through to the Bearer header.
  }

  if (!raw) raw = readBearer(req);
  if (!raw) return jsonError(401, 'UNAUTHENTICATED');

  const result = await refreshMobileSession(raw);
  if (!result) return jsonError(401, 'UNAUTHENTICATED');

  return jsonOk({
    token: result.token,
    refresh: result.refresh,
    expiresIn: result.expiresIn,
  });
}
