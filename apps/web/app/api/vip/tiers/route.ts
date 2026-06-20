// Built by Anointed Coder.
//
// GET /api/vip/tiers - public list of active VIP tiers + their perks.
// Used by /vip page to render the tier ladder.

export const dynamic = 'force-dynamic';

import { db } from '@/lib/db/client';
import { jsonOk } from '@/lib/auth/errors';

export async function GET() {
  const rows = await db.vipTier.findMany({
    where: { status: 'active' },
    orderBy: [{ position: 'asc' }, { name: 'asc' }],
  });
  return jsonOk({
    tiers: rows.map((t) => ({
      id: t.id,
      name: t.name,
      nameBn: t.nameBn,
      position: t.position,
      description: t.description,
      descriptionBn: t.descriptionBn,
      cashbackRatePercent: t.cashbackRatePercent == null ? null : Number(t.cashbackRatePercent),
      withdrawalMaxAmount: t.withdrawalMaxAmount == null ? null : Number(t.withdrawalMaxAmount),
      perksEn: t.perksEn,
      perksBn: t.perksBn,
      iconUrl: t.iconUrl,
      badgeColor: t.badgeColor,
    })),
  });
}
