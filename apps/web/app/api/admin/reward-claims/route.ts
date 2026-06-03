// Built by Anointed Coder.
//
// GET   /api/admin/reward-claims                list pending + recent claims
// PATCH /api/admin/reward-claims                body { id, status, notes? }
//   On status='rejected' coins are refunded to Wallet.bonusBalance.

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db/client';
import { withAuth, ensurePermission, recordActivity } from '@/lib/auth/guard';
import { jsonError, jsonOk } from '@/lib/auth/errors';

const patchSchema = z.object({
  id: z.string().min(1),
  status: z.enum(['approved', 'rejected', 'done', 'cancelled']),
  notes: z.string().max(2000).optional(),
});

export async function GET(req: NextRequest) {
  return withAuth(async () => {
    await ensurePermission('rewards.write');
    const url = new URL(req.url);
    const statusFilter = url.searchParams.get('status');
    const where = statusFilter ? { status: statusFilter } : {};
    const claims = await db.rewardClaim.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }],
      take: 200,
      include: { user: { select: { username: true, phone: true } } },
    });
    return jsonOk({
      claims: claims.map((c) => ({
        id: c.id,
        userId: c.userId,
        username: c.user?.username ?? null,
        phone: c.user?.phone ?? null,
        itemId: c.itemId,
        itemTitle: c.itemTitle,
        rewardType: c.rewardType,
        costPaid: c.costPaid,
        status: c.status,
        payload: c.payload,
        notes: c.notes,
        createdAt: c.createdAt,
        processedAt: c.processedAt,
      })),
    });
  });
}

export async function PATCH(req: NextRequest) {
  return withAuth(async () => {
    const session = await ensurePermission('rewards.write');
    const body = await req.json().catch(() => ({}));
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) return jsonError(400, 'VALIDATION', undefined, { issues: parsed.error.issues });

    const claim = await db.rewardClaim.findUnique({ where: { id: parsed.data.id } });
    if (!claim) return jsonError(404, 'NOT_FOUND');
    if (claim.status !== 'pending' && claim.status !== 'approved') return jsonError(409, 'INVALID_STATE', `Claim is already ${claim.status}.`);

    const next = await db.$transaction(async (tx) => {
      const updated = await tx.rewardClaim.update({
        where: { id: claim.id },
        data: {
          status: parsed.data.status,
          notes: parsed.data.notes ?? null,
          processedAt: new Date(),
          processedBy: session.sub,
        },
      });
      // Refund coins on rejection / cancellation so the user does not
      // lose their balance to a request the operator declined.
      if (parsed.data.status === 'rejected' || parsed.data.status === 'cancelled') {
        await tx.wallet.upsert({
          where: { userId: claim.userId },
          update: { bonusBalance: { increment: claim.costPaid } },
          create: { userId: claim.userId, balance: 0, bonusBalance: claim.costPaid, lockedBalance: 0, currency: 'BDT' },
        });
      }
      return updated;
    });

    await recordActivity({
      actorId: session.sub,
      actorRole: session.role,
      action: 'REWARD_CLAIM_PATCH',
      target: claim.id,
      meta: { status: parsed.data.status, refunded: parsed.data.status === 'rejected' || parsed.data.status === 'cancelled' },
    });

    return jsonOk({ claim: next });
  });
}
