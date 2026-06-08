// Built by Anointed Coder.
//
// PATCH  /api/admin/promo-codes/[id]   update fields
// DELETE /api/admin/promo-codes/[id]   delete (only if no redemptions)

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { db } from '@/lib/db/client';
import { withAuth, ensurePermission, recordActivity } from '@/lib/auth/guard';
import { jsonError, jsonOk } from '@/lib/auth/errors';

const REWARD_TYPES = ['bonus_grant', 'main_balance', 'bonus_balance', 'locked_balance'] as const;

const patchSchema = z.object({
  titleEn: z.string().trim().min(1).max(120).optional(),
  titleBn: z.string().trim().max(120).nullable().optional(),
  descriptionEn: z.string().trim().max(2000).nullable().optional(),
  descriptionBn: z.string().trim().max(2000).nullable().optional(),
  rewardType: z.enum(REWARD_TYPES).optional(),
  rewardAmount: z.coerce.number().min(0).max(10_000_000).optional(),
  turnoverX: z.coerce.number().min(0).max(100).optional(),
  maxRedemptions: z.coerce.number().int().min(0).max(1_000_000).optional(),
  perUserLimit: z.coerce.number().int().min(0).max(1000).optional(),
  minDepositTotal: z.coerce.number().min(0).max(10_000_000).optional(),
  startsAt: z.string().datetime().nullable().optional(),
  endsAt: z.string().datetime().nullable().optional(),
  isActive: z.boolean().optional(),
  bonusRuleId: z.string().trim().min(1).max(60).nullable().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  return withAuth(async () => {
    const session = await ensurePermission('bonuses.write');
    const existing = await db.promoCode.findUnique({ where: { id: params.id } });
    if (!existing) return jsonError(404, 'NOT_FOUND');
    const body = await req.json().catch(() => ({}));
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) return jsonError(400, 'VALIDATION', undefined, { issues: parsed.error.issues });
    const d = parsed.data;

    if (d.bonusRuleId) {
      const rule = await db.bonusRule.findUnique({ where: { id: d.bonusRuleId } });
      if (!rule) return jsonError(400, 'VALIDATION', 'Bonus Rule not found.');
    }

    const updated = await db.promoCode.update({
      where: { id: params.id },
      data: {
        ...(d.titleEn !== undefined ? { titleEn: d.titleEn } : {}),
        ...(d.titleBn !== undefined ? { titleBn: d.titleBn } : {}),
        ...(d.descriptionEn !== undefined ? { descriptionEn: d.descriptionEn } : {}),
        ...(d.descriptionBn !== undefined ? { descriptionBn: d.descriptionBn } : {}),
        ...(d.rewardType !== undefined ? { rewardType: d.rewardType } : {}),
        ...(d.rewardAmount !== undefined ? { rewardAmount: new Prisma.Decimal(d.rewardAmount) } : {}),
        ...(d.turnoverX !== undefined ? { turnoverX: new Prisma.Decimal(d.turnoverX) } : {}),
        ...(d.maxRedemptions !== undefined ? { maxRedemptions: d.maxRedemptions } : {}),
        ...(d.perUserLimit !== undefined ? { perUserLimit: d.perUserLimit } : {}),
        ...(d.minDepositTotal !== undefined ? { minDepositTotal: new Prisma.Decimal(d.minDepositTotal) } : {}),
        ...(d.startsAt !== undefined ? { startsAt: d.startsAt ? new Date(d.startsAt) : null } : {}),
        ...(d.endsAt !== undefined ? { endsAt: d.endsAt ? new Date(d.endsAt) : null } : {}),
        ...(d.isActive !== undefined ? { isActive: d.isActive } : {}),
        ...(d.bonusRuleId !== undefined ? { bonusRuleId: d.bonusRuleId } : {}),
      },
    });

    await recordActivity({
      actorId: session.sub,
      actorRole: session.role,
      action: 'PROMO_CODE_UPDATE',
      target: updated.id,
      detail: updated.code,
      meta: d as Prisma.JsonObject,
    });

    return jsonOk({ promoCode: updated });
  });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  return withAuth(async () => {
    const session = await ensurePermission('bonuses.write');
    const existing = await db.promoCode.findUnique({
      where: { id: params.id },
      include: { _count: { select: { redemptions: true } } },
    });
    if (!existing) return jsonError(404, 'NOT_FOUND');
    if (existing._count.redemptions > 0) {
      return jsonError(409, 'IN_USE', 'Promo code has redemptions. Disable it instead of deleting to preserve audit history.');
    }
    await db.promoCode.delete({ where: { id: params.id } });
    await recordActivity({
      actorId: session.sub,
      actorRole: session.role,
      action: 'PROMO_CODE_DELETE',
      target: params.id,
      detail: existing.code,
    });
    return jsonOk({ ok: true });
  });
}
