// Built by Anointed Coder.
//
// GET  /api/admin/vip/tiers - list all VIP tiers (active + hidden)
// POST /api/admin/vip/tiers - create a tier

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db/client';
import { withAuth, ensurePermission, recordActivity } from '@/lib/auth/guard';
import { jsonError, jsonOk } from '@/lib/auth/errors';

const tierSchema = z.object({
  name: z.string().trim().min(1).max(60),
  nameBn: z.string().trim().max(60).optional().nullable(),
  position: z.coerce.number().int().min(0).max(99).default(0),
  description: z.string().trim().max(1000).optional().nullable(),
  descriptionBn: z.string().trim().max(1000).optional().nullable(),
  cashbackRatePercent: z.coerce.number().min(0).max(100).optional().nullable(),
  withdrawalMaxAmount: z.coerce.number().min(0).max(100_000_000).optional().nullable(),
  payoutPriority: z.coerce.number().int().min(0).max(99).default(0),
  perksEn: z.string().trim().max(2000).optional().nullable(),
  perksBn: z.string().trim().max(2000).optional().nullable(),
  iconUrl: z.string().trim().max(500).optional().nullable(),
  badgeColor: z.string().trim().max(20).optional().nullable(),
  status: z.enum(['active', 'hidden']).default('active'),
});

export async function GET() {
  return withAuth(async () => {
    await ensurePermission('settings.write');
    const rows = await db.vipTier.findMany({
      orderBy: [{ position: 'asc' }, { name: 'asc' }],
      include: { _count: { select: { users: true, applications: true } } },
    });
    return jsonOk({
      tiers: rows.map((t) => ({
        id: t.id,
        name: t.name,
        nameBn: t.nameBn,
        position: t.position,
        description: t.description,
        descriptionBn: t.descriptionBn,
        cashbackRatePercent: t.cashbackRatePercent == null ? null : Number(t.cashbackRatePercent),
        withdrawalMaxAmount: t.withdrawalMaxAmount == null ? null : Number(t.withdrawalMaxAmount),
        payoutPriority: t.payoutPriority,
        perksEn: t.perksEn,
        perksBn: t.perksBn,
        iconUrl: t.iconUrl,
        badgeColor: t.badgeColor,
        status: t.status,
        userCount: t._count.users,
        applicationCount: t._count.applications,
      })),
    });
  });
}

export async function POST(req: NextRequest) {
  return withAuth(async () => {
    const session = await ensurePermission('settings.write');
    const body = await req.json().catch(() => ({}));
    const parsed = tierSchema.safeParse(body);
    if (!parsed.success) return jsonError(400, 'VALIDATION', undefined, { issues: parsed.error.issues });
    const tier = await db.vipTier.create({ data: parsed.data });
    await recordActivity({
      actorId: session.sub,
      actorRole: session.role,
      action: 'VIP_TIER_CREATE',
      target: tier.id,
      detail: tier.name,
    });
    return jsonOk({ tier }, 201);
  });
}
