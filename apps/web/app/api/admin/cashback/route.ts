// Built by Anointed Coder.
//
// GET  /api/admin/cashback   list campaigns + payout totals
// POST /api/admin/cashback   create a campaign

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { db } from '@/lib/db/client';
import { withAuth, ensurePermission, recordActivity } from '@/lib/auth/guard';
import { jsonError, jsonOk } from '@/lib/auth/errors';

const createSchema = z.object({
  nameEn: z.string().trim().min(1).max(120),
  nameBn: z.string().trim().max(120).optional().nullable(),
  source: z.enum(['net_loss', 'wager_amount']),
  percentage: z.coerce.number().min(0).max(100),
  maxCashback: z.coerce.number().min(0).max(10_000_000).default(0),
  turnoverX: z.coerce.number().min(0).max(100).default(0),
  cadence: z.enum(['daily', 'weekly', 'monthly']).default('weekly'),
  startsAt: z.string().datetime().optional().nullable(),
  endsAt: z.string().datetime().optional().nullable(),
  isActive: z.boolean().optional().default(true),
  bonusRuleId: z.string().trim().min(1).max(60).optional().nullable(),
});

function serialize(c: Awaited<ReturnType<typeof db.cashbackCampaign.findMany>>[number] & { _count?: { payouts: number } }) {
  return {
    id: c.id,
    nameEn: c.nameEn,
    nameBn: c.nameBn,
    source: c.source,
    percentage: Number(c.percentage),
    maxCashback: Number(c.maxCashback),
    turnoverX: Number(c.turnoverX),
    cadence: c.cadence,
    startsAt: c.startsAt,
    endsAt: c.endsAt,
    isActive: c.isActive,
    bonusRuleId: c.bonusRuleId,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
    payoutCount: c._count?.payouts ?? 0,
  };
}

export async function GET() {
  return withAuth(async () => {
    await ensurePermission('bonuses.read');
    const rows = await db.cashbackCampaign.findMany({
      orderBy: [{ isActive: 'desc' }, { createdAt: 'desc' }],
      include: { _count: { select: { payouts: true } } },
    });
    return jsonOk({ campaigns: rows.map(serialize) });
  });
}

export async function POST(req: NextRequest) {
  return withAuth(async () => {
    const session = await ensurePermission('bonuses.write');
    const body = await req.json().catch(() => ({}));
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) return jsonError(400, 'VALIDATION', undefined, { issues: parsed.error.issues });
    const data = parsed.data;

    if (data.turnoverX > 0 && !data.bonusRuleId) {
      return jsonError(400, 'VALIDATION', 'A Bonus Rule is required when turnoverX > 0 so the credited cashback can carry a turnover lock.');
    }
    if (data.bonusRuleId) {
      const rule = await db.bonusRule.findUnique({ where: { id: data.bonusRuleId } });
      if (!rule) return jsonError(400, 'VALIDATION', 'Bonus Rule not found.');
    }

    const created = await db.cashbackCampaign.create({
      data: {
        nameEn: data.nameEn,
        nameBn: data.nameBn ?? null,
        source: data.source,
        percentage: new Prisma.Decimal(data.percentage),
        maxCashback: new Prisma.Decimal(data.maxCashback),
        turnoverX: new Prisma.Decimal(data.turnoverX),
        cadence: data.cadence,
        startsAt: data.startsAt ? new Date(data.startsAt) : null,
        endsAt: data.endsAt ? new Date(data.endsAt) : null,
        isActive: data.isActive,
        bonusRuleId: data.bonusRuleId ?? null,
      },
    });

    await recordActivity({
      actorId: session.sub,
      actorRole: session.role,
      action: 'CASHBACK_CAMPAIGN_CREATE',
      target: created.id,
      detail: created.nameEn,
    });

    return jsonOk({ campaign: serialize(created) }, 201);
  });
}
