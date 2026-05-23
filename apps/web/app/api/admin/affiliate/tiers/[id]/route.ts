// Built by Anointed Coder.

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db/client';
import { withAuth, ensurePermission, recordActivity } from '@/lib/auth/guard';
import { jsonError, jsonOk } from '@/lib/auth/errors';

const updateSchema = z.object({
  name: z.string().trim().min(2).max(60).optional(),
  description: z.string().trim().max(500).optional().nullable(),
  level1Pct: z.coerce.number().min(0).max(100).optional(),
  level2Pct: z.coerce.number().min(0).max(100).optional(),
  level3Pct: z.coerce.number().min(0).max(100).optional(),
  minActiveReferrals: z.coerce.number().int().min(0).max(100000).optional(),
  minMonthlyVolume: z.coerce.number().min(0).max(1_000_000_000).optional(),
  position: z.coerce.number().int().min(0).max(99).optional(),
  status: z.enum(['active', 'hidden', 'paused']).optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  return withAuth(async () => {
    const session = await ensurePermission('affiliate.tiers.write');
    const body = await req.json().catch(() => ({}));
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) return jsonError(400, 'VALIDATION', undefined, { issues: parsed.error.issues });
    const tier = await db.commissionTier.update({ where: { id: params.id }, data: parsed.data });
    await recordActivity({
      actorId: session.sub,
      actorRole: session.role,
      action: 'COMMISSION_TIER_UPDATE',
      target: tier.id,
    });
    return jsonOk({ tier });
  });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  return withAuth(async () => {
    const session = await ensurePermission('affiliate.tiers.write');
    const usedBy = await db.user.count({ where: { affiliateTierId: params.id } });
    if (usedBy > 0) {
      return jsonError(409, 'TIER_IN_USE', `Tier is currently assigned to ${usedBy} affiliate(s). Move them to another tier first.`);
    }
    await db.commissionTier.delete({ where: { id: params.id } });
    await recordActivity({
      actorId: session.sub,
      actorRole: session.role,
      action: 'COMMISSION_TIER_DELETE',
      target: params.id,
    });
    return jsonOk({ deleted: true });
  });
}
