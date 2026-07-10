// Built by Anointed Coder.

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { clearAuthCookies, getSessionClaims, getClientIp, getUserAgent, revokeRefreshCredential } from '@/lib/auth/session';
import { db } from '@/lib/db/client';

export async function POST(req: NextRequest) {
  const claims = await getSessionClaims();
  if (claims) {
    try {
      await db.activityLog.create({
        data: {
          actorId: claims.sub,
          actorRole: claims.role,
          action: 'USER_LOGOUT',
          target: claims.sub,
          ip: getClientIp(),
          userAgent: getUserAgent(),
        },
      });
    } catch {
      // best-effort logging
    }
  }

  // Mobile logout: a native client passes the refresh credential it
  // wants invalidated as { refresh } in the body (or an Authorization:
  // Bearer header). We revoke exactly that DB session row. The web
  // cookie-clear + cookie refresh revoke below is untouched. Reading the
  // body is best-effort: web logout sends no body and simply skips this.
  let mobileRefresh: string | null = null;
  try {
    const body = await req.json();
    if (body && typeof body.refresh === 'string') {
      mobileRefresh = body.refresh.trim() || null;
    }
  } catch {
    // No JSON body (web logout): nothing to revoke here.
  }
  if (!mobileRefresh) {
    const auth = req.headers.get('authorization');
    if (auth && auth.toLowerCase().startsWith('bearer ')) {
      mobileRefresh = auth.slice(7).trim() || null;
    }
  }
  if (mobileRefresh) await revokeRefreshCredential(mobileRefresh);

  await clearAuthCookies({ revoke: true });
  return NextResponse.json({ ok: true });
}
