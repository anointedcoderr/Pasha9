// Built by Anointed Coder.
//
// Per-user detail for the admin user details drawer. Returns the full
// profile, wallet, role, referred-by snapshot, and lifetime deposit /
// withdrawal aggregates so support can review an account in one
// glance.

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db/client';
import { withAuth, ensurePermission, recordActivity } from '@/lib/auth/guard';
import { jsonError, jsonOk } from '@/lib/auth/errors';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  return withAuth(async () => {
    await ensurePermission('users.read');
    const user = await db.user.findUnique({
      where: { id: params.id },
      include: {
        role: { select: { key: true, label: true } },
        wallet: { select: { balance: true, bonusBalance: true, lockedBalance: true, lottoBalance: true, currency: true } },
        referredBy: { select: { id: true, username: true, referralCode: true } },
      },
    });
    if (!user) return jsonError(404, 'NOT_FOUND');

    const [depositSum, withdrawSum, depositsApprovedCount, withdrawalsApprovedCount, lotteryTickets, lotteryWinnings, lastLoginCount] =
      await Promise.all([
        db.deposit.aggregate({ where: { userId: user.id, status: 'approved' }, _sum: { amount: true } }),
        db.withdrawal.aggregate({ where: { userId: user.id, status: 'approved' }, _sum: { amount: true } }),
        db.deposit.count({ where: { userId: user.id, status: 'approved' } }),
        db.withdrawal.count({ where: { userId: user.id, status: 'approved' } }),
        db.lotteryTicket.count({ where: { userId: user.id } }),
        db.lotteryWinning.count({ where: { userId: user.id } }),
        db.session.count({ where: { userId: user.id } }),
      ]);

    return jsonOk({
      user: {
        id: user.id,
        username: user.username,
        phone: user.phone,
        email: user.email,
        role: user.role,
        status: user.status,
        country: user.country,
        language: user.language,
        referralCode: user.referralCode,
        referredBy: user.referredBy,
        isAffiliate: user.isAffiliate,
        lastLoginAt: user.lastLoginAt,
        lastLoginIp: user.lastLoginIp,
        phoneVerifiedAt: user.phoneVerifiedAt,
        createdAt: user.createdAt,
        wallet: {
          balance: Number(user.wallet?.balance ?? 0),
          bonusBalance: Number(user.wallet?.bonusBalance ?? 0),
          lockedBalance: Number(user.wallet?.lockedBalance ?? 0),
          lottoBalance: Number(user.wallet?.lottoBalance ?? 0),
          currency: user.wallet?.currency ?? 'BDT',
        },
        totals: {
          deposit: Number(depositSum._sum.amount ?? 0),
          withdraw: Number(withdrawSum._sum.amount ?? 0),
          depositsApprovedCount,
          withdrawalsApprovedCount,
          lotteryTickets,
          lotteryWinnings,
          sessionCount: lastLoginCount,
        },
      },
    });
  });
}

const patchSchema = z.object({
  status: z.enum(['active', 'blocked', 'pending']).optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  return withAuth(async () => {
    const session = await ensurePermission('users.update');
    const body = await req.json().catch(() => ({}));
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) return jsonError(400, 'VALIDATION', undefined, { issues: parsed.error.issues });

    const updated = await db.user.update({
      where: { id: params.id },
      data: parsed.data,
      select: { id: true, status: true, username: true },
    });

    await recordActivity({
      actorId: session.sub,
      actorRole: session.role,
      action: parsed.data.status === 'blocked' ? 'USER_BLOCK' : 'USER_UPDATE',
      target: updated.id,
      detail: parsed.data.status,
    });

    return jsonOk({ user: updated });
  });
}
