// Built by Anointed Coder.
//
// POST /api/vip/apply
//   body: { tierId?: string, notes?: string }
//
// Creates a VipApplication for the current user. Refuses if there is
// already a pending application. Pings every staff user via the admin
// notification system (same pipeline as deposit / withdrawal submits).

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db/client';
import { withAuth, recordActivity } from '@/lib/auth/guard';
import { requireActiveUser } from '@/lib/auth/rbac';
import { jsonError, jsonOk } from '@/lib/auth/errors';
import { rateLimit } from '@/lib/auth/rate-limit';
import { notifyAdmins } from '@/lib/notifications/notify';

const schema = z.object({
  tierId: z.string().trim().min(1).max(60).optional().nullable(),
  notes: z.string().trim().max(1000).optional().nullable(),
});

export async function POST(req: NextRequest) {
  return withAuth(async () => {
    const session = await requireActiveUser();
    const limit = rateLimit(`vip-apply:${session.sub}`, 3, 60_000);
    if (!limit.ok) return jsonError(429, 'RATE_LIMITED');

    const body = await req.json().catch(() => ({}));
    const parsed = schema.safeParse(body);
    if (!parsed.success) return jsonError(400, 'VALIDATION', undefined, { issues: parsed.error.issues });

    const existing = await db.vipApplication.findFirst({
      where: { userId: session.sub, status: 'pending' },
      select: { id: true },
    });
    if (existing) return jsonError(409, 'ALREADY_PENDING', 'You already have a pending VIP application.');

    let tierName = '(any tier)';
    if (parsed.data.tierId) {
      const tier = await db.vipTier.findUnique({ where: { id: parsed.data.tierId }, select: { name: true, status: true } });
      if (!tier) return jsonError(404, 'TIER_NOT_FOUND');
      if (tier.status !== 'active') return jsonError(409, 'TIER_INACTIVE');
      tierName = tier.name;
    }

    const application = await db.vipApplication.create({
      data: {
        userId: session.sub,
        tierId: parsed.data.tierId ?? null,
        notes: parsed.data.notes ?? null,
      },
    });

    await recordActivity({
      actorId: session.sub,
      actorRole: session.role,
      action: 'VIP_APPLICATION_SUBMIT',
      target: application.id,
      detail: tierName,
    });

    // Bell ping for staff
    notifyAdmins({
      kind: 'admin_affiliate_application_pending', // closest existing kind; bell shows it under /admin
      titleEn: `New VIP application: ${tierName}`,
      titleBn: `নতুন ভিআইপি আবেদন: ${tierName}`,
      bodyEn: `A player has applied for the VIP Club (${tierName}). Review at /admin/vip.`,
      bodyBn: `একজন প্লেয়ার ভিআইপি ক্লাবে আবেদন করেছেন (${tierName})।`,
      linkUrl: '/admin/vip',
      priority: 'normal',
    }).catch(() => {});

    return jsonOk({ application: { id: application.id, status: application.status, appliedAt: application.appliedAt } }, 201);
  });
}
