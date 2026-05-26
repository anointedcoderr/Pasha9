// Built by Anointed Coder.
//
// Disable 2FA for the signed-in user. Requires a current TOTP code
// (or a recovery code) so a stolen session alone cannot turn off the
// second factor. Clears all 2FA state on success.

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db/client';
import { withAuth, recordActivity } from '@/lib/auth/guard';
import { requireActiveUser } from '@/lib/auth/rbac';
import { jsonError, jsonOk } from '@/lib/auth/errors';
import { verifyTotp, consumeRecoveryCode } from '@/lib/security/totp';

const schema = z.object({ code: z.string().min(4).max(20) });

export async function POST(req: NextRequest) {
  return withAuth(async () => {
    const session = await requireActiveUser();
    const body = await req.json().catch(() => ({}));
    const parsed = schema.safeParse(body);
    if (!parsed.success) return jsonError(400, 'VALIDATION');

    const user = await db.user.findUnique({
      where: { id: session.sub },
      select: { id: true, totpSecret: true, totpEnabled: true, recoveryCodesHash: true },
    });
    if (!user || !user.totpEnabled || !user.totpSecret) {
      return jsonError(400, 'NOT_ENABLED');
    }

    const ok = verifyTotp(parsed.data.code, user.totpSecret)
      || consumeRecoveryCode(parsed.data.code, user.recoveryCodesHash) !== null;
    if (!ok) return jsonError(400, 'INVALID_CODE');

    await db.user.update({
      where: { id: user.id },
      data: {
        totpEnabled: false,
        totpSecret: null,
        totpEnrolledAt: null,
        recoveryCodesHash: null,
      },
    });

    await recordActivity({
      actorId: session.sub,
      actorRole: session.role,
      action: 'TOTP_DISABLE',
      target: user.id,
    });

    return jsonOk({ disabled: true });
  });
}
