// Built by Anointed Coder.
//
// GET /api/admin/promo-codes/[id]/redemptions
// Returns the most recent 100 redemptions for the given promo code
// so the admin can audit who claimed it.

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { db } from '@/lib/db/client';
import { withAuth, ensurePermission } from '@/lib/auth/guard';
import { jsonError, jsonOk } from '@/lib/auth/errors';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  return withAuth(async () => {
    await ensurePermission('bonuses.read');
    const existing = await db.promoCode.findUnique({ where: { id: params.id } });
    if (!existing) return jsonError(404, 'NOT_FOUND');
    const rows = await db.promoCodeRedemption.findMany({
      where: { promoCodeId: params.id },
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: { user: { select: { id: true, username: true, phone: true } } },
    });
    return jsonOk({
      redemptions: rows.map((r) => ({
        id: r.id,
        userId: r.userId,
        username: r.user.username,
        phone: r.user.phone,
        amount: Number(r.amount),
        rewardType: r.rewardType,
        bonusGrantId: r.bonusGrantId,
        walletTxId: r.walletTxId,
        status: r.status,
        createdAt: r.createdAt,
      })),
    });
  });
}
