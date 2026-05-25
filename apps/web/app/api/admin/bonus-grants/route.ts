// Built by Anointed Coder.
//
// Admin list of issued bonus grants. Supports filters by status,
// userId, ruleId and a free-text user search.

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { db } from '@/lib/db/client';
import { withAuth, ensurePermission } from '@/lib/auth/guard';
import { jsonOk } from '@/lib/auth/errors';

const STATUSES = ['active', 'completed', 'expired', 'cancelled'] as const;

export async function GET(req: NextRequest) {
  return withAuth(async () => {
    await ensurePermission('bonuses.read');
    const url = new URL(req.url);
    const status = url.searchParams.get('status');
    const userId = url.searchParams.get('userId');
    const ruleId = url.searchParams.get('ruleId');
    const query = url.searchParams.get('q')?.trim().toLowerCase() ?? '';
    const take = Math.min(200, Number(url.searchParams.get('take') ?? 100));

    const where: {
      status?: string;
      userId?: string;
      bonusRuleId?: string;
      user?: { OR: Array<{ username?: { contains: string; mode: 'insensitive' } } | { phone?: { contains: string } }> };
    } = {};
    if (status && (STATUSES as readonly string[]).includes(status)) where.status = status;
    if (userId) where.userId = userId;
    if (ruleId) where.bonusRuleId = ruleId;
    if (query) {
      where.user = {
        OR: [
          { username: { contains: query, mode: 'insensitive' } },
          { phone: { contains: query } },
        ],
      };
    }

    const rows = await db.userBonus.findMany({
      where,
      orderBy: [{ claimedAt: 'desc' }],
      take,
      include: {
        user: { select: { id: true, username: true, phone: true } },
        bonusRule: { select: { id: true, name: true, type: true, turnoverX: true } },
      },
    });

    return jsonOk({
      grants: rows.map((r) => ({
        id: r.id,
        userId: r.userId,
        username: r.user.username,
        phone: r.user.phone,
        rule: {
          id: r.bonusRule.id,
          name: r.bonusRule.name,
          type: r.bonusRule.type,
          turnoverX: Number(r.bonusRule.turnoverX),
        },
        amount: Number(r.amount),
        turnoverRequired: Number(r.turnoverRequired),
        turnoverProgress: Number(r.turnoverProgress),
        status: r.status,
        sourceType: r.sourceType,
        sourceId: r.sourceId,
        note: r.note,
        claimedAt: r.claimedAt,
        expiresAt: r.expiresAt,
        releasedAt: r.releasedAt,
        cancelledAt: r.cancelledAt,
      })),
    });
  });
}
