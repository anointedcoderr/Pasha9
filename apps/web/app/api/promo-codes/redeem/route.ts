// Built by Anointed Coder.
//
// POST /api/promo-codes/redeem  { code: "WELCOME10" }

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAuth, recordActivity } from '@/lib/auth/guard';
import { requireActiveUser } from '@/lib/auth/rbac';
import { jsonError, jsonOk } from '@/lib/auth/errors';
import { rateLimit } from '@/lib/auth/rate-limit';
import { redeemPromoCode } from '@/lib/promo-codes/redeem';
import { notifyPromoCodeGranted } from '@/lib/notifications/notify';

const bodySchema = z.object({
  code: z.string().trim().min(2).max(40),
});

export async function POST(req: NextRequest) {
  return withAuth(async () => {
    const session = await requireActiveUser();

    const limit = rateLimit(`promo-redeem:${session.sub}`, 10, 10 * 60_000);
    if (!limit.ok) return jsonError(429, 'RATE_LIMITED');

    const body = await req.json().catch(() => ({}));
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) return jsonError(400, 'VALIDATION', 'Enter a valid promo code.');

    const result = await redeemPromoCode({ rawCode: parsed.data.code, userId: session.sub });

    if (!result.ok) {
      await recordActivity({
        actorId: session.sub,
        actorRole: session.role,
        action: 'PROMO_CODE_REJECT',
        target: parsed.data.code.trim().toUpperCase(),
        meta: { code: result.code, message: result.message },
      });
      return jsonError(result.httpStatus, result.code, result.message);
    }

    notifyPromoCodeGranted({
      userId: session.sub,
      code: parsed.data.code.trim().toUpperCase(),
      rewardLabel: String(result.rewardType ?? 'reward'),
      amount: Number(result.amount ?? 0),
    }).catch((err) => console.error('[promo-redeem] notify failed', err));

    return jsonOk({
      ok: true,
      amount: result.amount,
      rewardType: result.rewardType,
      turnoverX: result.turnoverX,
      redemptionId: result.redemptionId,
      bonusGrantId: result.bonusGrantId,
    });
  });
}
