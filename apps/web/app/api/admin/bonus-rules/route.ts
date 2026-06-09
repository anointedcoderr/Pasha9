// Built by Anointed Coder.
//
// Admin CRUD over BonusRule rows. Replaces the M1 mock that lived in
// the /admin/bonuses page. Rules are read by the engine on every
// deposit approve and surfaced to users on /promotions + the
// /dashboard/bonus rule explainer.

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { z } from 'zod';
import type { BonusType, ContentStatus, Prisma } from '@prisma/client';
import { db } from '@/lib/db/client';
import { withAuth, ensurePermission, recordActivity } from '@/lib/auth/guard';
import { jsonError, jsonOk } from '@/lib/auth/errors';
import { promotionActivationError, promotionConfigWarning } from '@/lib/promotions/config';

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

// M4 Phase D: promotion presentation assets. Banner / terms columns
// are optional on every existing rule; clearing a field is allowed
// by accepting null + ''.
const optionalUrl = z
  .string()
  .trim()
  .max(500)
  .nullable()
  .optional()
  .transform((v) => (v ? v : null));

const createSchema = z.object({
  name: z.string().trim().min(1).max(120),
  nameBn: z.string().trim().max(120).optional().nullable(),
  type: z.enum(ALLOWED_TYPES as [BonusType, ...BonusType[]]),
  promotionType: z.enum(PROMOTION_TYPES).optional().nullable(),
  code: z.string().trim().min(1).max(60).optional().nullable(),
  amount: z.coerce.number().min(0).max(10_000_000).default(0),
  percentage: z.coerce.number().min(0).max(1000).default(0),
  minDeposit: z.coerce.number().min(0).max(10_000_000).default(0),
  maxBonus: z.coerce.number().min(0).max(10_000_000).default(0),
  turnoverX: z.coerce.number().min(0).max(100).default(0),
  validityDays: z.coerce.number().int().min(0).max(365).default(30),
  priority: z.coerce.number().int().min(0).max(1000).default(0),
  status: z.enum(ALLOWED_STATUSES as [ContentStatus, ...ContentStatus[]]).default('active'),
  description: z.string().max(1000).optional().nullable(),
  descriptionBn: z.string().max(1000).optional().nullable(),
  bannerUrl: z.string().trim().max(500).optional().nullable(),
  startsAt: z.string().datetime().optional().nullable(),
  endsAt: z.string().datetime().optional().nullable(),
  meta: z.record(z.unknown()).optional().nullable(),
  bannerDesktopUrl: optionalUrl,
  bannerMobileUrl: optionalUrl,
  thumbnailUrl: optionalUrl,
  backgroundUrl: optionalUrl,
  termsEn: z.string().max(5000).nullable().optional().transform((v) => (v ? v : null)),
  termsBn: z.string().max(5000).nullable().optional().transform((v) => (v ? v : null)),
});

function serialize(r: Awaited<ReturnType<typeof db.bonusRule.findMany>>[number]) {
  return {
    id: r.id,
    name: r.name,
    nameBn: r.nameBn,
    type: r.type,
    promotionType: r.promotionType,
    code: r.code,
    amount: Number(r.amount),
    percentage: Number(r.percentage),
    minDeposit: Number(r.minDeposit),
    maxBonus: Number(r.maxBonus),
    turnoverX: Number(r.turnoverX),
    validityDays: r.validityDays,
    priority: r.priority,
    status: r.status,
    description: r.description,
    descriptionBn: r.descriptionBn,
    bannerUrl: r.bannerUrl,
    startsAt: r.startsAt,
    endsAt: r.endsAt,
    meta: r.meta,
    bannerDesktopUrl: r.bannerDesktopUrl,
    bannerMobileUrl: r.bannerMobileUrl,
    thumbnailUrl: r.thumbnailUrl,
    backgroundUrl: r.backgroundUrl,
    termsEn: r.termsEn,
    termsBn: r.termsBn,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    configWarning: promotionConfigWarning(r),
  };
}

export async function GET(req: NextRequest) {
  return withAuth(async () => {
    await ensurePermission('bonuses.read');
    const url = new URL(req.url);
    const typeParam = url.searchParams.get('type');
    const statusParam = url.searchParams.get('status');

    const where: { type?: BonusType; status?: ContentStatus } = {};
    if (typeParam && ALLOWED_TYPES.includes(typeParam as BonusType)) {
      where.type = typeParam as BonusType;
    }
    if (statusParam && ALLOWED_STATUSES.includes(statusParam as ContentStatus)) {
      where.status = statusParam as ContentStatus;
    }

    const rows = await db.bonusRule.findMany({
      where,
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
      // Hard cap so this admin endpoint cannot spiral into a
      // multi-megabyte payload as the bonus catalogue grows.
      take: 500,
      include: {
        _count: { select: { userBonuses: true, promotionClaims: true } },
      },
    });
    return jsonOk({
      rules: rows.map((r) => ({
        ...serialize(r),
        grantCount: r._count.userBonuses,
        claimCount: r._count.promotionClaims,
      })),
    });
  });
}

export async function POST(req: NextRequest) {
  return withAuth(async () => {
    const session = await ensurePermission('bonuses.write');
    const body = await req.json().catch(() => ({}));
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) return jsonError(400, 'VALIDATION', undefined, { issues: parsed.error.issues });
    const data = parsed.data;
    const engineType = data.promotionType ? TYPE_BY_PROMOTION[data.promotionType] : data.type;
    const configWarning = promotionActivationError({
      id: 'new',
      type: engineType,
      code: data.code ?? null,
      amount: data.amount,
      percentage: data.percentage,
      minDeposit: data.minDeposit,
      maxBonus: data.maxBonus,
      meta: data.meta,
    });
    if (data.status === 'active' && configWarning) {
      return jsonError(409, 'PROMOTION_CONFIG_REQUIRED', configWarning);
    }

    if (data.code) {
      const dup = await db.bonusRule.findUnique({ where: { code: data.code } });
      if (dup) return jsonError(409, 'CODE_TAKEN', `A rule with code "${data.code}" already exists.`);
    }

    const created = await db.bonusRule.create({
      data: {
        name: data.name,
        nameBn: data.nameBn ?? null,
        type: engineType,
        promotionType: data.promotionType ?? null,
        code: data.code ?? null,
        amount: data.amount,
        percentage: data.percentage,
        minDeposit: data.minDeposit,
        maxBonus: data.maxBonus,
        turnoverX: data.turnoverX,
        validityDays: data.validityDays,
        priority: data.priority,
        status: data.status,
        description: data.description ?? null,
        descriptionBn: data.descriptionBn ?? null,
        bannerUrl: data.bannerUrl ?? null,
        startsAt: data.startsAt ? new Date(data.startsAt) : null,
        endsAt: data.endsAt ? new Date(data.endsAt) : null,
        meta: (data.meta ?? null) as Prisma.InputJsonValue,
        bannerDesktopUrl: data.bannerDesktopUrl,
        bannerMobileUrl: data.bannerMobileUrl,
        thumbnailUrl: data.thumbnailUrl,
        backgroundUrl: data.backgroundUrl,
        termsEn: data.termsEn,
        termsBn: data.termsBn,
      },
    });

    await recordActivity({
      actorId: session.sub,
      actorRole: session.role,
      action: 'BONUS_RULE_CREATE',
      target: created.id,
      detail: created.name,
    });

    return jsonOk({ rule: serialize(created) }, 201);
  });
}
