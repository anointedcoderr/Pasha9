// Built by Anointed Coder.

export const dynamic = 'force-dynamic';

import { db } from '@/lib/db/client';
import { jsonOk } from '@/lib/auth/errors';

export async function GET() {
  const tiers = await db.commissionTier.findMany({
    where: { status: 'active' },
    orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
    select: {
      id: true,
      name: true,
      description: true,
      level1Pct: true,
      level2Pct: true,
      level3Pct: true,
      minActiveReferrals: true,
      minMonthlyVolume: true,
    },
  });
  return jsonOk({ tiers });
}
