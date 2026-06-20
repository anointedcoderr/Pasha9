// Built by Anointed Coder.
//
// POST /api/admin/vip/applications/[id]
//   body: { action: 'approve' | 'reject', tierId?: string, reviewNote?: string }
//
// On approve: sets user.vipTierId = tierId (defaults to the requested
// tier if not provided), application.status='approved', notifies the
// player via the existing notification + RewardCelebration pipeline.
// On reject: marks application.status='rejected', notifies the player.

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db/client';
import { withAuth, ensurePermission, recordActivity } from '@/lib/auth/guard';
import { jsonError, jsonOk } from '@/lib/auth/errors';
import { notifyUser } from '@/lib/notifications/notify';

const bodySchema = z.object({
  action: z.enum(['approve', 'reject']),
  tierId: z.string().trim().min(1).max(60).optional().nullable(),
  reviewNote: z.string().trim().max(500).optional().nullable(),
});

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  return withAuth(async () => {
    const session = await ensurePermission('users.read');
    const body = await req.json().catch(() => ({}));
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) return jsonError(400, 'VALIDATION', undefined, { issues: parsed.error.issues });

    const app = await db.vipApplication.findUnique({
      where: { id: params.id },
      include: { user: { select: { id: true, username: true } } },
    });
    if (!app) return jsonError(404, 'APPLICATION_NOT_FOUND');
    if (app.status !== 'pending') {
      return jsonError(409, 'ALREADY_REVIEWED', `Application is already ${app.status}.`);
    }

    const now = new Date();

    if (parsed.data.action === 'approve') {
      const tierId = parsed.data.tierId ?? app.tierId;
      if (!tierId) {
        return jsonError(400, 'TIER_REQUIRED', 'Provide a tierId to approve into.');
      }
      const tier = await db.vipTier.findUnique({ where: { id: tierId } });
      if (!tier) return jsonError(404, 'TIER_NOT_FOUND');

      await db.$transaction(async (tx) => {
        await tx.vipApplication.update({
          where: { id: app.id },
          data: {
            status: 'approved',
            tierId,
            reviewerId: session.sub,
            reviewedAt: now,
            reviewNote: parsed.data.reviewNote ?? null,
          },
        });
        await tx.user.update({ where: { id: app.userId }, data: { vipTierId: tierId } });
      });

      await recordActivity({
        actorId: session.sub,
        actorRole: session.role,
        action: 'VIP_APPLICATION_APPROVE',
        target: app.id,
        detail: tier.name,
        meta: { userId: app.userId, tierId, tierName: tier.name },
      });

      notifyUser({
        userId: app.userId,
        kind: 'reward_coin_grant',
        titleEn: `VIP approved: ${tier.name}`,
        titleBn: `ভিআইপি অনুমোদিত: ${tier.name}`,
        bodyEn: `Your VIP Club application has been approved. You are now ${tier.name}. Open /vip to see your new perks.`,
        bodyBn: `আপনার ভিআইপি ক্লাব আবেদন অনুমোদিত হয়েছে। আপনি এখন ${tier.name}। নতুন পার্ক দেখতে /vip খুলুন।`,
        linkUrl: '/vip',
        priority: 'high',
      }).catch(() => {});

      return jsonOk({ ok: true, status: 'approved', tierId, tierName: tier.name });
    }

    // reject
    await db.vipApplication.update({
      where: { id: app.id },
      data: {
        status: 'rejected',
        reviewerId: session.sub,
        reviewedAt: now,
        reviewNote: parsed.data.reviewNote ?? null,
      },
    });

    await recordActivity({
      actorId: session.sub,
      actorRole: session.role,
      action: 'VIP_APPLICATION_REJECT',
      target: app.id,
      meta: { userId: app.userId, reason: parsed.data.reviewNote ?? null },
    });

    notifyUser({
      userId: app.userId,
      kind: 'system',
      titleEn: 'VIP application not approved',
      titleBn: 'ভিআইপি আবেদন অনুমোদিত হয়নি',
      bodyEn: parsed.data.reviewNote
        ? `Your VIP application was not approved. Reason: ${parsed.data.reviewNote}. You can re-apply once you meet the criteria.`
        : 'Your VIP application was not approved. You can re-apply once you meet the criteria.',
      bodyBn: parsed.data.reviewNote
        ? `আপনার ভিআইপি আবেদন অনুমোদিত হয়নি। কারণ: ${parsed.data.reviewNote}।`
        : 'আপনার ভিআইপি আবেদন অনুমোদিত হয়নি।',
      linkUrl: '/vip',
      priority: 'normal',
    }).catch(() => {});

    return jsonOk({ ok: true, status: 'rejected' });
  });
}
