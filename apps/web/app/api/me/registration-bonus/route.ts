// Built by Anointed Coder.
//
// GET /api/me/registration-bonus
//
// The signed-in player's own registration bonus progress: how much is held,
// how much they still need to deposit to unlock it, and the maximum they can
// keep. Feeds the popup that tells them what to do next.
//
// Returns { bonus: null } when the player has no registration bonus, which is
// the normal case for anyone who registered before the feature was switched
// on. The client treats null as "show nothing".

export const dynamic = 'force-dynamic';

import { withAuth } from '@/lib/auth/guard';
import { requireActiveUser } from '@/lib/auth/rbac';
import { jsonOk } from '@/lib/auth/errors';
import { getRegistrationBonusStatus } from '@/lib/bonuses/registration';

export async function GET() {
  return withAuth(async () => {
    const session = await requireActiveUser();
    return jsonOk({ bonus: await getRegistrationBonusStatus(session.sub) });
  });
}
