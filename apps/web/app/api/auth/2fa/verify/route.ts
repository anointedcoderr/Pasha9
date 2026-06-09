// Built by Anointed Coder.
//
// Complete TOTP enrollment. The user has scanned the QR via
// /api/auth/2fa/setup; they POST the first 6-digit code here. On
// success we flip totpEnabled=true, mint recovery codes and return
// them ONCE. Subsequent calls cannot re-fetch them.

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db/client';
import { withAuth, recordActivity } from '@/lib/auth/guard';
import { requireActiveUser } from '@/lib/auth/rbac';
import { rateLimit } from '@/lib/auth/rate-limit';
import { jsonError, jsonOk } from '@/lib/auth/errors';
import { verifyTotp, generateRecoveryCodes } from '@/lib/security/totp';

const schema = z.object({ code: z.string().min(4).max(10) });

export async function POST(req: NextRequest) {
  return withAuth(async () => {
    const session = await requireActiveUser();
    // 5 verification attempts per minute per user. The TOTP
    // code-space is 1,000,000 so a determined attacker with a
    // stolen session cookie could in theory grind toward the right
    // code without this cap.
    const limit = rateLimit(`2fa-verify:${session.sub}`, 5, 60_000);
    if (!limit.ok) return jsonError(429, 'RATE_LIMITED', 'Too many attempts. Wait a moment and try again.');
    const body = await req.json().catch(() => ({}));
    const parsed = schema.safeParse(body);
    if (!parsed.success) return jsonError(400, 'VALIDATION');

    const user = await db.user.findUnique({
      where: { id: session.sub },
      select: { id: true, totpSecret: true, totpEnabled: true },
    });
    if (!user) return jsonError(404, 'USER_NOT_FOUND');
    if (!user.totpSecret) return jsonError(400, 'NO_PENDING_ENROLLMENT', 'Call /api/auth/2fa/setup first.');
    if (user.totpEnabled) return jsonError(409, 'ALREADY_ENABLED');

    const ok = verifyTotp(parsed.data.code, user.totpSecret);
    if (!ok) return jsonError(400, 'INVALID_CODE');

    const { codes, hashedJson } = generateRecoveryCodes();
    await db.user.update({
      where: { id: user.id },
      data: {
        totpEnabled: true,
        totpEnrolledAt: new Date(),
        recoveryCodesHash: hashedJson,
      },
    });

    await recordActivity({
      actorId: session.sub,
      actorRole: session.role,
      action: 'TOTP_ENABLE',
      target: user.id,
    });

    return jsonOk({ enabled: true, recoveryCodes: codes });
  });
}
