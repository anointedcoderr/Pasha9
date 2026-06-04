// Built by Anointed Coder.
//
// POST /api/admin/spin-segments/seed
//
// Idempotently materialises the 3-tier wheel ladder (Lucky / Grand /
// Supreme) with their per-tier segment wedges from DEFAULT_TIERS +
// DEFAULT_TIER_SEGMENTS in lib/rewards/config. Re-running is safe:
//   - tiers upsert by key (no overwrite of operator edits)
//   - per-tier segments only create when that tier has zero segments
//   - tier-less legacy SpinSegment rows (from the original flat-seed)
//     are migrated to the lucky tier so existing operators see no
//     behavioural change

export const dynamic = 'force-dynamic';

import { db } from '@/lib/db/client';
import { withAuth, ensurePermission, recordActivity } from '@/lib/auth/guard';
import { jsonOk } from '@/lib/auth/errors';
import { DEFAULT_TIERS, DEFAULT_TIER_SEGMENTS } from '@/lib/rewards/config';

export async function POST() {
  return withAuth(async () => {
    const session = await ensurePermission('rewards.write');

    let tiersCreated = 0;
    let segmentsCreated = 0;
    let legacyBackfilled = 0;

    // 1. Upsert tiers.
    const tierByKey: Record<string, string> = {};
    for (const spec of DEFAULT_TIERS) {
      const existing = await db.spinWheelTier.findUnique({ where: { key: spec.key } });
      if (existing) {
        tierByKey[spec.key] = existing.id;
        continue;
      }
      const created = await db.spinWheelTier.create({
        data: {
          key: spec.key,
          nameEn: spec.nameEn,
          nameBn: spec.nameBn,
          descriptionEn: spec.descriptionEn,
          descriptionBn: spec.descriptionBn,
          costPerSpin: spec.costPerSpin,
          freeSpinsPerDay: spec.freeSpinsPerDay,
          color: spec.color,
          position: spec.position,
          isActive: true,
        },
      });
      tierByKey[spec.key] = created.id;
      tiersCreated += 1;
    }

    // 2. Backfill legacy untiered segments to the lucky tier so the
    //    public UI still shows them under the default Lucky wheel.
    const luckyId = tierByKey.lucky;
    if (luckyId) {
      const back = await db.spinSegment.updateMany({
        where: { tierId: null },
        data: { tierId: luckyId },
      });
      legacyBackfilled = back.count;
    }

    // 3. Seed per-tier segments only when that tier has zero.
    for (const spec of DEFAULT_TIERS) {
      const tierId = tierByKey[spec.key];
      if (!tierId) continue;
      const have = await db.spinSegment.count({ where: { tierId } });
      if (have > 0) continue;
      const wedges = DEFAULT_TIER_SEGMENTS[spec.key];
      for (const w of wedges) {
        await db.spinSegment.create({
          data: {
            label: w.label,
            color: w.color,
            weight: w.weight,
            payoutType: w.payoutType,
            payoutAmount: w.payoutAmount,
            turnoverX: w.turnoverX,
            position: w.position,
            isActive: true,
            tierId,
          },
        });
        segmentsCreated += 1;
      }
    }

    await recordActivity({
      actorId: session.sub,
      actorRole: session.role,
      action: 'SPIN_TIERS_SEED',
      target: 'spin_wheel',
      meta: { tiersCreated, segmentsCreated, legacyBackfilled },
    });

    return jsonOk({
      ok: true,
      tiersCreated,
      segmentsCreated,
      legacyBackfilled,
      alreadySeeded: tiersCreated === 0 && segmentsCreated === 0 && legacyBackfilled === 0,
    });
  });
}
