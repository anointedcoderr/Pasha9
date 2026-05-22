// Built by Anointed Coder.

import { NextResponse } from 'next/server';
import { clearAuthCookies, getSessionClaims, getClientIp, getUserAgent } from '@/lib/auth/session';
import { db } from '@/lib/db/client';

export async function POST() {
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
  await clearAuthCookies({ revoke: true });
  return NextResponse.json({ ok: true });
}
