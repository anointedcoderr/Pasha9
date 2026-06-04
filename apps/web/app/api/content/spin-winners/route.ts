// Built by Anointed Coder.
//
// GET /api/content/spin-winners[?tierKey=lucky]
//
// Returns recent SpinResult rows with a payout > 0, joined to User
// for a masked username. Optionally scoped to a single tier. Empty
// array when no winners yet - never seeds fake entries.

export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextRequest } from 'next/server';
import { db } from '@/lib/db/client';
import { jsonOk } from '@/lib/auth/errors';

function maskUsername(name: string | null): string {
  if (!name) return 'Player';
  const trimmed = name.trim();
  if (trimmed.length <= 3) return trimmed[0] + '***';
  return `${trimmed.slice(0, 2)}***${trimmed.slice(-1)}`;
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const tierKey = url.searchParams.get('tierKey');

  let tierFilter: { tierId: string } | undefined;
  if (tierKey) {
    const tier = await db.spinWheelTier.findUnique({ where: { key: tierKey }, select: { id: true } });
    if (tier) tierFilter = { tierId: tier.id };
  }

  const results = await db.spinResult.findMany({
    where: { payoutAmount: { gt: 0 }, ...(tierFilter ?? {}) },
    orderBy: { createdAt: 'desc' },
    take: 30,
    include: {
      user: { select: { username: true } },
      tier: { select: { key: true, nameEn: true, nameBn: true } },
    },
  });

  return jsonOk({
    winners: results.map((r) => ({
      id: r.id,
      maskedName: maskUsername(r.user?.username ?? null),
      segmentLabel: r.segmentLabel,
      payoutType: r.payoutType,
      payoutAmount: r.payoutAmount,
      tierKey: r.tier?.key ?? null,
      tierNameEn: r.tier?.nameEn ?? null,
      tierNameBn: r.tier?.nameBn ?? null,
      createdAt: r.createdAt,
    })),
  });
}
