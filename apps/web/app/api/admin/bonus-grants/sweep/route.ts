// Built by Anointed Coder.
//
// Admin-triggered expiry sweep. Runs the engine pass that forfeits
// every active grant past its expiresAt deadline. Safe to call any
// number of times - rows past expiry are individually transactioned.

export const dynamic = 'force-dynamic';

import { withAuth, ensurePermission, recordActivity } from '@/lib/auth/guard';
import { jsonOk } from '@/lib/auth/errors';
import { sweepExpiredGrants } from '@/lib/bonuses/engine';

export async function POST() {
  return withAuth(async () => {
    const session = await ensurePermission('bonuses.write');
    const result = await sweepExpiredGrants();
    await recordActivity({
      actorId: session.sub,
      actorRole: session.role,
      action: 'BONUS_EXPIRY_SWEEP',
      meta: { expired: result.expired },
    });
    return jsonOk(result);
  });
}
