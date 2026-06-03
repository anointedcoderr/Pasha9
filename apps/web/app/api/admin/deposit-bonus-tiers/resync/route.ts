// Built by Anointed Coder.
//
// POST /api/admin/deposit-bonus-tiers/resync
//
// Re-runs syncTierToBonusRule for every tier and prunes orphaned
// deposit_tier_* BonusRule rows. Safe to run any time the operator
// suspects a tier drifted out of sync with its BonusRule.

export const dynamic = 'force-dynamic';

import { withAuth, ensurePermission, recordActivity } from '@/lib/auth/guard';
import { getCurrentSession } from '@/lib/auth/rbac';
import { jsonError, jsonOk } from '@/lib/auth/errors';
import { resyncAllTiers } from '@/lib/bonuses/deposit-tiers';

export async function POST() {
  return withAuth(async () => {
    await ensurePermission('settings.write');
    const claims = await getCurrentSession();
    if (!claims) return jsonError(401, 'UNAUTHENTICATED');
    const out = await resyncAllTiers();
    await recordActivity({
      actorId: claims.sub,
      actorRole: claims.role,
      action: 'DEPOSIT_TIER_RESYNC',
      target: 'all',
      meta: out,
    });
    return jsonOk(out);
  });
}
