// Built by Anointed Coder.
//
// POST /api/admin/giveaways   create a multi-use giveaway PromoCode and
//                             best-effort broadcast the code to the
//                             configured Telegram group.
//
// Permission: bonuses.write (same as the promo-codes POST it wraps). No
// wallet is touched here; players redeem the code on the promotions page
// through the unchanged redeem path.

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAuth, ensurePermission, recordActivity } from '@/lib/auth/guard';
import { jsonError, jsonOk } from '@/lib/auth/errors';
import { PROMO_REWARD_TYPES } from '@/lib/promo-codes/create';
import { createGiveaway } from '@/lib/giveaways/create';

const createSchema = z
  .object({
    code: z
      .string()
      .trim()
      .min(2)
      .max(40)
      .regex(/^[A-Z0-9_-]+$/i, 'Code may only contain letters, digits, dashes and underscores.')
      .optional()
      .nullable(),
    rewardType: z.enum(PROMO_REWARD_TYPES).default('main_balance'),
    amount: z.coerce.number().positive().max(10_000_000),
    turnoverX: z.coerce.number().min(0).max(100).default(0),
    // A giveaway is inherently multi-use: require at least one redemption slot.
    maxRedemptions: z.coerce.number().int().min(1).max(1_000_000),
    // Every broadcast code MUST carry a per-user cap of at least 1 so one
    // Telegram member cannot sweep every redemption slot. min(0) previously
    // allowed an uncapped (0 = unlimited) per-user limit, letting a single
    // account drain the whole giveaway.
    perUserLimit: z.coerce.number().int().min(1).max(1000).default(1),
    endsAt: z.string().datetime().optional().nullable(),
    bonusRuleId: z.string().trim().min(1).max(60).optional().nullable(),
    broadcast: z.boolean().optional().default(true),
  })
  .refine((v) => v.rewardType !== 'bonus_grant' || !!v.bonusRuleId, {
    message: 'bonus_grant rewards require a Bonus Rule selection.',
    path: ['bonusRuleId'],
  });

export async function POST(req: NextRequest) {
  return withAuth(async () => {
    const session = await ensurePermission('bonuses.write');
    const body = await req.json().catch(() => ({}));
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) return jsonError(400, 'VALIDATION', undefined, { issues: parsed.error.issues });
    const data = parsed.data;

    const result = await createGiveaway({
      code: data.code ?? undefined,
      rewardType: data.rewardType,
      amount: data.amount,
      turnoverX: data.turnoverX,
      maxRedemptions: data.maxRedemptions,
      perUserLimit: data.perUserLimit,
      endsAt: data.endsAt ?? null,
      bonusRuleId: data.bonusRuleId ?? null,
      broadcast: data.broadcast,
      actorId: session.sub,
    });

    if (!result.ok) return jsonError(result.httpStatus, result.code, result.message);

    await recordActivity({
      actorId: session.sub,
      actorRole: session.role,
      action: 'GIVEAWAY_CREATE',
      target: result.promoCode.id,
      detail: result.promoCode.code,
      meta: {
        rewardType: result.promoCode.rewardType,
        rewardAmount: result.promoCode.rewardAmount,
        maxRedemptions: result.promoCode.maxRedemptions,
        broadcast: result.broadcast,
      },
    });

    return jsonOk({ promoCode: result.promoCode, broadcast: result.broadcast }, 201);
  });
}
