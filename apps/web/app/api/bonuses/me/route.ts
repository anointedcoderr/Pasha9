// Built by Anointed Coder.
//
// Signed-in user's own bonus grants + summary. Drives the
// /dashboard/bonus page (active grants, turnover progress, history).

export const dynamic = 'force-dynamic';

import { db } from '@/lib/db/client';
import { withAuth } from '@/lib/auth/guard';
import { requireActiveUser } from '@/lib/auth/rbac';
import { jsonOk } from '@/lib/auth/errors';

export async function GET() {
  return withAuth(async () => {
    const session = await requireActiveUser();
    const userId = session.sub;

    const [grants, wallet] = await Promise.all([
      db.userBonus.findMany({
        where: { userId },
        orderBy: { claimedAt: 'desc' },
        take: 50,
        include: {
          bonusRule: {
            select: {
              id: true,
              name: true,
              type: true,
              description: true,
              turnoverX: true,
              validityDays: true,
            },
          },
        },
      }),
      db.wallet.findUnique({ where: { userId } }),
    ]);

    const totals = grants.reduce(
      (acc, g) => {
        const a = Number(g.amount);
        if (g.status === 'active') acc.locked += a;
        if (g.status === 'completed') acc.released += a;
        if (g.status === 'expired' || g.status === 'cancelled') acc.forfeited += a;
        return acc;
      },
      { locked: 0, released: 0, forfeited: 0 },
    );

    return jsonOk({
      wallet: wallet
        ? {
            balance: Number(wallet.balance),
            bonusBalance: Number(wallet.bonusBalance),
            lockedBalance: Number(wallet.lockedBalance),
          }
        : null,
      totals,
      grants: grants.map((g) => ({
        id: g.id,
        amount: Number(g.amount),
        turnoverRequired: Number(g.turnoverRequired),
        turnoverProgress: Number(g.turnoverProgress),
        status: g.status,
        sourceType: g.sourceType,
        claimedAt: g.claimedAt,
        expiresAt: g.expiresAt,
        releasedAt: g.releasedAt,
        cancelledAt: g.cancelledAt,
        note: g.note,
        rule: {
          id: g.bonusRule.id,
          name: g.bonusRule.name,
          type: g.bonusRule.type,
          description: g.bonusRule.description,
          turnoverX: Number(g.bonusRule.turnoverX),
          validityDays: g.bonusRule.validityDays,
        },
      })),
    });
  });
}
