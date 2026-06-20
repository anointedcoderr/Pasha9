// Built by Anointed Coder.
//
// GET /api/vip/status - current user's tier + pending application flag.

export const dynamic = 'force-dynamic';

import { db } from '@/lib/db/client';
import { withAuth } from '@/lib/auth/guard';
import { requireUser } from '@/lib/auth/rbac';
import { jsonOk } from '@/lib/auth/errors';

export async function GET() {
  return withAuth(async () => {
    const session = await requireUser();
    const user = await db.user.findUnique({
      where: { id: session.sub },
      select: {
        vipTierId: true,
        vipTier: true,
        vipApplications: {
          where: { status: 'pending' },
          orderBy: { appliedAt: 'desc' },
          take: 1,
          select: { id: true, tierId: true, appliedAt: true, notes: true },
        },
      },
    });
    if (!user) return jsonOk({ tier: null, pendingApplication: null });
    const tier = user.vipTier;
    return jsonOk({
      tier: tier
        ? {
            id: tier.id,
            name: tier.name,
            nameBn: tier.nameBn,
            description: tier.description,
            descriptionBn: tier.descriptionBn,
            cashbackRatePercent: tier.cashbackRatePercent == null ? null : Number(tier.cashbackRatePercent),
            withdrawalMaxAmount: tier.withdrawalMaxAmount == null ? null : Number(tier.withdrawalMaxAmount),
            perksEn: tier.perksEn,
            perksBn: tier.perksBn,
            iconUrl: tier.iconUrl,
            badgeColor: tier.badgeColor,
          }
        : null,
      pendingApplication: user.vipApplications[0] ?? null,
    });
  });
}
