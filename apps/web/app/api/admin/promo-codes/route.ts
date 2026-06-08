// Built by Anointed Coder.
//
// GET  /api/admin/promo-codes        list codes with redemption counts
// POST /api/admin/promo-codes        create one

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { db } from '@/lib/db/client';
import { withAuth, ensurePermission, recordActivity } from '@/lib/auth/guard';
import { jsonError, jsonOk } from '@/lib/auth/errors';

const REWARD_TYPES = ['bonus_grant', 'main_balance', 'bonus_balance', 'locked_balance'] as const;

const createSchema = z.object({
  code: z.string().trim().min(2).max(40).regex(/^[A-Z0-9_-]+$/i, 'Code may only contain letters, digits, dashes and underscores.'),
  titleEn: z.string().trim().min(1).max(120),
  titleBn: z.string().trim().max(120).optional().nullable(),
  descriptionEn: z.string().trim().max(2000).optional().nullable(),
  descriptionBn: z.string().trim().max(2000).optional().nullable(),
  rewardType: z.enum(REWARD_TYPES),
  rewardAmount: z.coerce.number().min(0).max(10_000_000),
  turnoverX: z.coerce.number().min(0).max(100).default(0),
  maxRedemptions: z.coerce.number().int().min(0).max(1_000_000).default(0),
  perUserLimit: z.coerce.number().int().min(0).max(1000).default(1),
  minDepositTotal: z.coerce.number().min(0).max(10_000_000).default(0),
  startsAt: z.string().datetime().optional().nullable(),
  endsAt: z.string().datetime().optional().nullable(),
  isActive: z.boolean().optional().default(true),
  bonusRuleId: z.string().trim().min(1).max(60).optional().nullable(),
});

function serialize(r: Awaited<ReturnType<typeof db.promoCode.findMany>>[number] & { _count?: { redemptions: number } }) {
  return {
    id: r.id,
    code: r.code,
    titleEn: r.titleEn,
    titleBn: r.titleBn,
    descriptionEn: r.descriptionEn,
    descriptionBn: r.descriptionBn,
    rewardType: r.rewardType,
    rewardAmount: Number(r.rewardAmount),
    turnoverX: Number(r.turnoverX),
    maxRedemptions: r.maxRedemptions,
    perUserLimit: r.perUserLimit,
    minDepositTotal: Number(r.minDepositTotal),
    startsAt: r.startsAt,
    endsAt: r.endsAt,
    isActive: r.isActive,
    bonusRuleId: r.bonusRuleId,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    redemptionCount: r._count?.redemptions ?? 0,
  };
}

export async function GET() {
  return withAuth(async () => {
    await ensurePermission('bonuses.read');
    const rows = await db.promoCode.findMany({
      orderBy: [{ isActive: 'desc' }, { createdAt: 'desc' }],
      include: { _count: { select: { redemptions: true } } },
    });
    return jsonOk({ codes: rows.map(serialize) });
  });
}

export async function POST(req: NextRequest) {
  return withAuth(async () => {
    const session = await ensurePermission('bonuses.write');
    const body = await req.json().catch(() => ({}));
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) return jsonError(400, 'VALIDATION', undefined, { issues: parsed.error.issues });
    const data = parsed.data;
    const code = data.code.trim().toUpperCase();

    const existing = await db.promoCode.findUnique({ where: { code } });
    if (existing) return jsonError(409, 'CODE_TAKEN', `Promo code "${code}" already exists.`);

    if (data.rewardType === 'bonus_grant') {
      if (!data.bonusRuleId) {
        return jsonError(400, 'VALIDATION', 'bonus_grant rewards require a Bonus Rule selection.');
      }
      const rule = await db.bonusRule.findUnique({ where: { id: data.bonusRuleId } });
      if (!rule) return jsonError(400, 'VALIDATION', 'Selected Bonus Rule was not found.');
    }

    const created = await db.promoCode.create({
      data: {
        code,
        titleEn: data.titleEn,
        titleBn: data.titleBn ?? null,
        descriptionEn: data.descriptionEn ?? null,
        descriptionBn: data.descriptionBn ?? null,
        rewardType: data.rewardType,
        rewardAmount: new Prisma.Decimal(data.rewardAmount),
        turnoverX: new Prisma.Decimal(data.turnoverX),
        maxRedemptions: data.maxRedemptions,
        perUserLimit: data.perUserLimit,
        minDepositTotal: new Prisma.Decimal(data.minDepositTotal),
        startsAt: data.startsAt ? new Date(data.startsAt) : null,
        endsAt: data.endsAt ? new Date(data.endsAt) : null,
        isActive: data.isActive,
        bonusRuleId: data.rewardType === 'bonus_grant' ? data.bonusRuleId ?? null : null,
      },
    });

    await recordActivity({
      actorId: session.sub,
      actorRole: session.role,
      action: 'PROMO_CODE_CREATE',
      target: created.id,
      detail: created.code,
    });

    return jsonOk({ promoCode: serialize(created) }, 201);
  });
}
