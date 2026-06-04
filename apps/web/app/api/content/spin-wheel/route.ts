// Built by Anointed Coder.
//
// Public spin wheel description. Two modes:
//
//   GET /api/content/spin-wheel
//     Returns all active tiers grouped with their active segments
//     (+ legacy null-tier segments under a synthetic 'legacy' entry
//     for back-compat with the original flat wheel). Plus the global
//     SpinConfig.
//
//   GET /api/content/spin-wheel?tierKey=lucky
//     Returns a single tier with that tier's active segments.
//
// Weight is never exposed publicly.

export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextRequest } from 'next/server';
import { db } from '@/lib/db/client';
import { jsonOk, jsonError } from '@/lib/auth/errors';
import { loadSpinConfig } from '@/lib/rewards/config';

function publicSegment(s: { id: string; label: string; color: string; position: number; payoutType: string; payoutAmount: number; turnoverX: { toString(): string } | number }) {
  return {
    id: s.id,
    label: s.label,
    color: s.color,
    position: s.position,
    payoutType: s.payoutType,
    payoutAmount: s.payoutAmount,
    turnoverX: typeof s.turnoverX === 'number' ? s.turnoverX : Number(s.turnoverX),
  };
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const tierKey = url.searchParams.get('tierKey');
  const config = await loadSpinConfig();

  if (tierKey) {
    const tier = await db.spinWheelTier.findUnique({
      where: { key: tierKey },
      include: {
        segments: { where: { isActive: true }, orderBy: { position: 'asc' } },
      },
    });
    if (!tier || !tier.isActive) return jsonError(404, 'TIER_NOT_FOUND');
    return jsonOk({
      config,
      tier: {
        id: tier.id,
        key: tier.key,
        nameEn: tier.nameEn,
        nameBn: tier.nameBn,
        descriptionEn: tier.descriptionEn,
        descriptionBn: tier.descriptionBn,
        costPerSpin: tier.costPerSpin,
        freeSpinsPerDay: tier.freeSpinsPerDay,
        color: tier.color,
        iconUrl: tier.iconUrl,
        position: tier.position,
      },
      segments: tier.segments.map(publicSegment),
    });
  }

  const [tiers, legacySegments] = await Promise.all([
    db.spinWheelTier.findMany({
      where: { isActive: true },
      orderBy: { position: 'asc' },
      include: { segments: { where: { isActive: true }, orderBy: { position: 'asc' } } },
    }),
    db.spinSegment.findMany({ where: { isActive: true, tierId: null }, orderBy: { position: 'asc' } }),
  ]);

  // Concatenated flat segments for any legacy client that still reads
  // the old `segments` field (back-compat: removed after the new
  // /rewards page lands).
  const flatSegments = [
    ...tiers.flatMap((t) => t.segments.map(publicSegment)),
    ...legacySegments.map(publicSegment),
  ];

  return jsonOk({
    config,
    tiers: tiers.map((t) => ({
      id: t.id,
      key: t.key,
      nameEn: t.nameEn,
      nameBn: t.nameBn,
      descriptionEn: t.descriptionEn,
      descriptionBn: t.descriptionBn,
      costPerSpin: t.costPerSpin,
      freeSpinsPerDay: t.freeSpinsPerDay,
      color: t.color,
      iconUrl: t.iconUrl,
      position: t.position,
      segments: t.segments.map(publicSegment),
    })),
    legacySegments: legacySegments.map(publicSegment),
    segments: flatSegments,
  });
}
