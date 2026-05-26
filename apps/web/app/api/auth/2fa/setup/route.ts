// Built by Anointed Coder.
//
// Start TOTP enrollment for the signed-in user. Stores the encrypted
// secret on the User row but leaves totpEnabled=false until the user
// successfully verifies a code via /api/auth/2fa/verify. Returns the
// otpauth URL + a QR data URL so the dashboard can render an
// authenticator-app friendly QR.

export const dynamic = 'force-dynamic';

import { db } from '@/lib/db/client';
import { withAuth } from '@/lib/auth/guard';
import { requireActiveUser } from '@/lib/auth/rbac';
import { jsonError, jsonOk } from '@/lib/auth/errors';
import { generatePendingEnrollment } from '@/lib/security/totp';
import QRCode from 'qrcode';

export async function POST() {
  return withAuth(async () => {
    const session = await requireActiveUser();
    const user = await db.user.findUnique({
      where: { id: session.sub },
      select: { id: true, username: true, totpEnabled: true },
    });
    if (!user) return jsonError(404, 'USER_NOT_FOUND');
    if (user.totpEnabled) return jsonError(409, 'TOTP_ALREADY_ENABLED', '2FA is already enabled. Disable it first to re-enroll.');

    const { encryptedSecret, otpauthUrl } = generatePendingEnrollment(user.username);
    await db.user.update({
      where: { id: user.id },
      data: { totpSecret: encryptedSecret, totpEnrolledAt: null, totpEnabled: false, recoveryCodesHash: null },
    });

    const qrDataUrl = await QRCode.toDataURL(otpauthUrl, { width: 220, margin: 1 });
    return jsonOk({ otpauthUrl, qrDataUrl });
  });
}
