// Built by Anointed Coder.
//
// GET  /api/admin/deposit-bonus-tiers   list rows
// POST /api/admin/deposit-bonus-tiers   create a tier and materialise
//                                       the matching BonusRule
//
// On create the tier is mirrored to a BonusRule (type='reload',
// code='deposit_tier_<id>') via syncTierToBonusRule so the existing
// applyDepositBonuses engine grants the bonus on approval.

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAuth, ensurePermission, recordActivity } from '@/lib/auth/guard';
import { getCurrentSession } from '@/lib/auth/rbac';
import { jsonError, jsonOk } from '@/lib/auth/errors';
import { db } from '@/lib/db/client';
import { syncTierToBonusRule } from '@/lib/bonuses/deposit-tiers';

const createSchema = z.object({
  minDeposit: z.coerce.number().min(0).max(10_000_000),
  percentage: z.coerce.number().int().min(0).max(100),
  isActive: z.boolean().optional(),
  position: z.number().int().min(0).max(9999).optional(),
  titleEn: z.string().trim().max(120).optional().nullable(),
  titleBn: z.string().trim().max(120).optional().nullable(),
  descriptionEn: z.string().trim().max(2000).optional().nullable(),
  descriptionBn: z.string().trim().max(2000).optional().nullable(),
  bannerUrl: z.string().trim().max(500).optional().nullable(),
});

export async function GET() {
  return withAuth(async () => {
    await ensurePermission('settings.write');
    const rows = await db.depositBonusTier.findMany({
      orderBy: [{ minDeposit: 'asc' }, { position: 'asc' }],
    });
    return jsonOk({
      tiers: rows.map((t) => ({
        id: t.id,
        minDeposit: Number(t.minDeposit),
        percentage: t.percentage,
        isActive: t.isActive,
        position: t.position,
        titleEn: t.titleEn,
        titleBn: t.titleBn,
        descriptionEn: t.descriptionEn,
        descriptionBn: t.descriptionBn,
        bannerUrl: t.bannerUrl,
        updatedAt: t.updatedAt,
      })),
    });
  });
}

export async function POST(req: NextRequest) {
  return withAuth(async () => {
    await ensurePermission('settings.write');
    const claims = await getCurrentSession();
    if (!claims) return jsonError(401, 'UNAUTHENTICATED');

    const body = await req.json().catch(() => ({}));
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) return jsonError(400, 'VALIDATION', undefined, { issues: parsed.error.issues });

    const tier = await db.depositBonusTier.create({
      data: {
        minDeposit: parsed.data.minDeposit,
        percentage: parsed.data.percentage,
        isActive: parsed.data.isActive ?? true,
        position: parsed.data.position ?? 0,
        titleEn: parsed.data.titleEn ?? null,
        titleBn: parsed.data.titleBn ?? null,
        descriptionEn: parsed.data.descriptionEn ?? null,
        descriptionBn: parsed.data.descriptionBn ?? null,
        bannerUrl: parsed.data.bannerUrl ?? null,
      },
    });

    try {
      await syncTierToBonusRule(tier);
    } catch (err) {
      console.error('[deposit-bonus-tiers] sync failed', err);
    }

    await recordActivity({
      actorId: claims.sub,
      actorRole: claims.role,
      action: 'DEPOSIT_TIER_CREATE',
      target: tier.id,
      meta: { minDeposit: Number(tier.minDeposit), percentage: tier.percentage, isActive: tier.isActive },
    });

    return jsonOk({ tier }, 201);
  });
}
