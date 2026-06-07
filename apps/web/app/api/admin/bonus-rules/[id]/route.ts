// Built by Anointed Coder.

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { z } from 'zod';
import type { BonusType, ContentStatus, Prisma } from '@prisma/client';
import { db } from '@/lib/db/client';
import { withAuth, ensurePermission, recordActivity } from '@/lib/auth/guard';
import { jsonError, jsonOk } from '@/lib/auth/errors';
import { promotionActivationError } from '@/lib/promotions/config';

const ALLOWED_TYPES: BonusType[] = ['first_deposit', 'daily', 'weekly', 'referral', 'vip', 'invite', 'reload', 'manual', 'promo'];
const ALLOWED_STATUSES: ContentStatus[] = ['active', 'hidden', 'paused'];
const PROMOTION_TYPES = ['first_deposit_bonus', 'daily_bonus', 'weekly_reward', 'referral_bonus', 'vip_reward', 'invite_friend_offer', 'other'] as const;
const TYPE_BY_PROMOTION: Record<(typeof PROMOTION_TYPES)[number], BonusType> = {
  first_deposit_bonus: 'first_deposit',
  daily_bonus: 'daily',
  weekly_reward: 'weekly',
  referral_bonus: 'referral',
  vip_reward: 'vip',
  invite_friend_offer: 'invite',
  other: 'promo',
};

// M4 Phase D: empty strings clear the column; missing keys leave it unchanged.
const optionalUrl = z
  .string()
  .trim()
  .max(500)
  .nullable()
  .optional()
  .transform((v) => (v === undefined ? undefined : (v ? v : null)));

const patchSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  nameBn: z.string().trim().max(120).nullable().optional(),
  type: z.enum(ALLOWED_TYPES as [BonusType, ...BonusType[]]).optional(),
  promotionType: z.enum(PROMOTION_TYPES).nullable().optional(),
  code: z.string().trim().min(1).max(60).nullable().optional(),
  amount: z.coerce.number().min(0).max(10_000_000).optional(),
  percentage: z.coerce.number().min(0).max(1000).optional(),
  minDeposit: z.coerce.number().min(0).max(10_000_000).optional(),
  maxBonus: z.coerce.number().min(0).max(10_000_000).optional(),
  turnoverX: z.coerce.number().min(0).max(100).optional(),
  validityDays: z.coerce.number().int().min(0).max(365).optional(),
  priority: z.coerce.number().int().min(0).max(1000).optional(),
  status: z.enum(ALLOWED_STATUSES as [ContentStatus, ...ContentStatus[]]).optional(),
  description: z.string().max(1000).nullable().optional(),
  descriptionBn: z.string().max(1000).nullable().optional(),
  bannerUrl: z.string().trim().max(500).nullable().optional(),
  startsAt: z.string().datetime().nullable().optional(),
  endsAt: z.string().datetime().nullable().optional(),
  meta: z.record(z.unknown()).nullable().optional(),
  bannerDesktopUrl: optionalUrl,
  bannerMobileUrl: optionalUrl,
  thumbnailUrl: optionalUrl,
  backgroundUrl: optionalUrl,
  termsEn: z.string().max(5000).nullable().optional(),
  termsBn: z.string().max(5000).nullable().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  return withAuth(async () => {
    const session = await ensurePermission('bonuses.write');
    const existing = await db.bonusRule.findUnique({ where: { id: params.id } });
    if (!existing) return jsonError(404, 'NOT_FOUND');

    const body = await req.json().catch(() => ({}));
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) return jsonError(400, 'VALIDATION', undefined, { issues: parsed.error.issues });
    const data = parsed.data;
    const engineType = data.promotionType ? TYPE_BY_PROMOTION[data.promotionType] : (data.type ?? existing.type);
    const next = {
      id: existing.id,
      type: engineType,
      code: data.code !== undefined ? data.code : existing.code,
      amount: data.amount ?? existing.amount,
      percentage: data.percentage ?? existing.percentage,
      minDeposit: data.minDeposit ?? existing.minDeposit,
      maxBonus: data.maxBonus ?? existing.maxBonus,
      meta: data.meta !== undefined ? data.meta : existing.meta,
    };
    const configWarning = promotionActivationError(next);
    if ((data.status ?? existing.status) === 'active' && configWarning) {
      return jsonError(409, 'PROMOTION_CONFIG_REQUIRED', configWarning);
    }

    if (data.code && data.code !== existing.code) {
      const dup = await db.bonusRule.findUnique({ where: { code: data.code } });
      if (dup && dup.id !== existing.id) {
        return jsonError(409, 'CODE_TAKEN', `A rule with code "${data.code}" already exists.`);
      }
    }

    const updated = await db.bonusRule.update({
      where: { id: params.id },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.nameBn !== undefined ? { nameBn: data.nameBn } : {}),
        ...((data.type !== undefined || data.promotionType) ? { type: engineType } : {}),
        ...(data.promotionType !== undefined ? { promotionType: data.promotionType } : {}),
        ...(data.code !== undefined ? { code: data.code ?? null } : {}),
        ...(data.amount !== undefined ? { amount: data.amount } : {}),
        ...(data.percentage !== undefined ? { percentage: data.percentage } : {}),
        ...(data.minDeposit !== undefined ? { minDeposit: data.minDeposit } : {}),
        ...(data.maxBonus !== undefined ? { maxBonus: data.maxBonus } : {}),
        ...(data.turnoverX !== undefined ? { turnoverX: data.turnoverX } : {}),
        ...(data.validityDays !== undefined ? { validityDays: data.validityDays } : {}),
        ...(data.priority !== undefined ? { priority: data.priority } : {}),
        ...(data.status !== undefined ? { status: data.status } : {}),
        ...(data.description !== undefined ? { description: data.description } : {}),
        ...(data.descriptionBn !== undefined ? { descriptionBn: data.descriptionBn } : {}),
        ...(data.bannerUrl !== undefined ? { bannerUrl: data.bannerUrl } : {}),
        ...(data.startsAt !== undefined ? { startsAt: data.startsAt ? new Date(data.startsAt) : null } : {}),
        ...(data.endsAt !== undefined ? { endsAt: data.endsAt ? new Date(data.endsAt) : null } : {}),
        ...(data.meta !== undefined ? { meta: (data.meta ?? null) as Prisma.InputJsonValue } : {}),
        ...(data.bannerDesktopUrl !== undefined ? { bannerDesktopUrl: data.bannerDesktopUrl } : {}),
        ...(data.bannerMobileUrl !== undefined ? { bannerMobileUrl: data.bannerMobileUrl } : {}),
        ...(data.thumbnailUrl !== undefined ? { thumbnailUrl: data.thumbnailUrl } : {}),
        ...(data.backgroundUrl !== undefined ? { backgroundUrl: data.backgroundUrl } : {}),
        ...(data.termsEn !== undefined ? { termsEn: data.termsEn ?? null } : {}),
        ...(data.termsBn !== undefined ? { termsBn: data.termsBn ?? null } : {}),
      },
    });

    await recordActivity({
      actorId: session.sub,
      actorRole: session.role,
      action: 'BONUS_RULE_UPDATE',
      target: updated.id,
      detail: updated.name,
    });

    return jsonOk({ rule: updated });
  });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  return withAuth(async () => {
    const session = await ensurePermission('bonuses.write');
    const existing = await db.bonusRule.findUnique({
      where: { id: params.id },
      include: { _count: { select: { userBonuses: true } } },
    });
    if (!existing) return jsonError(404, 'NOT_FOUND');

    // Soft policy: if grants exist, refuse delete to preserve audit
    // trail. Admin can flip status to 'hidden' instead.
    if (existing._count.userBonuses > 0) {
      return jsonError(409, 'RULE_IN_USE', 'Rule has issued grants. Hide it instead of deleting to preserve audit history.');
    }

    await db.bonusRule.delete({ where: { id: params.id } });

    await recordActivity({
      actorId: session.sub,
      actorRole: session.role,
      action: 'BONUS_RULE_DELETE',
      target: params.id,
      detail: existing.name,
    });

    return jsonOk({ ok: true });
  });
}
