// Built by Anointed Coder.
//
// POST /api/rewards/[id]/claim
//
// Creates a RewardClaim row for an admin to process. Validates that
// the user has enough coins (Wallet.bonusBalance) and freezes the
// cost on the claim row. Coins are deducted immediately so the
// player cannot claim the same reward twice from a single balance;
// admin can refund coins by rejecting the claim.
//
// Body shape depends on RewardItem.rewardType:
//   recharge -> { operator: 'gp'|'robi'|'bl'|'airtel'|'teletalk', phone }
//   physical -> { fullName, phone, address, notes? }
//   digital  -> {} (no extra fields required)

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db/client';
import { withAuth, ensureUser, recordActivity } from '@/lib/auth/guard';
import { jsonError, jsonOk } from '@/lib/auth/errors';
import { Prisma } from '@prisma/client';
import { loadCheckInConfig } from '@/lib/rewards/config';

const rechargeSchema = z.object({
  operator: z.enum(['gp', 'robi', 'bl', 'airtel', 'teletalk']),
  phone: z.string().trim().min(10).max(15).regex(/^0?1\d{9}$/, 'Invalid Bangladeshi mobile number'),
});

const physicalSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  phone: z.string().trim().min(10).max(15),
  address: z.string().trim().min(5).max(500),
  notes: z.string().trim().max(500).optional(),
});

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  return withAuth(async () => {
    const session = await ensureUser();
    const userId = session.sub;

    const item = await db.rewardItem.findUnique({ where: { id: params.id } });
    if (!item || item.status !== 'active') return jsonError(404, 'REWARD_NOT_FOUND');

    const wallet = await db.wallet.findUnique({ where: { userId }, select: { bonusBalance: true } });
    const coins = wallet ? Math.floor(Number(wallet.bonusBalance)) : 0;
    if (coins < item.cost) {
      const config = await loadCheckInConfig();
      return jsonError(400, 'INSUFFICIENT_COINS', config.insufficientCoinsTextEn, {
        coinsHave: coins,
        coinsNeeded: item.cost,
        coinsShort: item.cost - coins,
      });
    }

    const body = await req.json().catch(() => ({}));
    let payload: Prisma.InputJsonValue = {};
    if (item.rewardType === 'recharge') {
      const parsed = rechargeSchema.safeParse(body);
      if (!parsed.success) return jsonError(400, 'VALIDATION', 'Operator + phone required.', { issues: parsed.error.issues });
      payload = parsed.data;
    } else if (item.rewardType === 'physical') {
      const parsed = physicalSchema.safeParse(body);
      if (!parsed.success) return jsonError(400, 'VALIDATION', 'Delivery details required.', { issues: parsed.error.issues });
      payload = parsed.data;
    }

    const claim = await db.$transaction(async (tx) => {
      await tx.wallet.update({ where: { userId }, data: { bonusBalance: { decrement: item.cost } } });
      return tx.rewardClaim.create({
        data: {
          userId,
          itemId: item.id,
          itemTitle: item.title,
          rewardType: item.rewardType,
          costPaid: item.cost,
          status: 'pending',
          payload,
        },
      });
    });

    await recordActivity({
      actorId: userId,
      actorRole: session.role,
      action: 'REWARD_CLAIM',
      target: claim.id,
      meta: { itemId: item.id, cost: item.cost },
    });

    return jsonOk({ claim }, 201);
  });
}
