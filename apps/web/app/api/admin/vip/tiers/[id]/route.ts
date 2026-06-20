// Built by Anointed Coder.
//
// PATCH  /api/admin/vip/tiers/[id] - edit tier
// DELETE /api/admin/vip/tiers/[id] - delete tier (only if no users assigned)

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db/client';
import { withAuth, ensurePermission, recordActivity } from '@/lib/auth/guard';
import { jsonError, jsonOk } from '@/lib/auth/errors';

const updateSchema = z.object({
  name: z.string().trim().min(1).max(60).optional(),
  nameBn: z.string().trim().max(60).optional().nullable(),
  position: z.coerce.number().int().min(0).max(99).optional(),
  description: z.string().trim().max(1000).optional().nullable(),
  descriptionBn: z.string().trim().max(1000).optional().nullable(),
  cashbackRatePercent: z.coerce.number().min(0).max(100).optional().nullable(),
  withdrawalMaxAmount: z.coerce.number().min(0).max(100_000_000).optional().nullable(),
  payoutPriority: z.coerce.number().int().min(0).max(99).optional(),
  perksEn: z.string().trim().max(2000).optional().nullable(),
  perksBn: z.string().trim().max(2000).optional().nullable(),
  iconUrl: z.string().trim().max(500).optional().nullable(),
  badgeColor: z.string().trim().max(20).optional().nullable(),
  status: z.enum(['active', 'hidden']).optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  return withAuth(async () => {
    const session = await ensurePermission('settings.write');
    const body = await req.json().catch(() => ({}));
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) return jsonError(400, 'VALIDATION', undefined, { issues: parsed.error.issues });
    const tier = await db.vipTier.update({ where: { id: params.id }, data: parsed.data });
    await recordActivity({
      actorId: session.sub,
      actorRole: session.role,
      action: 'VIP_TIER_UPDATE',
      target: tier.id,
    });
    return jsonOk({ tier });
  });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  return withAuth(async () => {
    const session = await ensurePermission('settings.write');
    const count = await db.user.count({ where: { vipTierId: params.id } });
    if (count > 0) {
      return jsonError(409, 'TIER_IN_USE', `Cannot delete: ${count} user(s) are still assigned to this tier. Move them off first.`);
    }
    await db.vipTier.delete({ where: { id: params.id } });
    await recordActivity({
      actorId: session.sub,
      actorRole: session.role,
      action: 'VIP_TIER_DELETE',
      target: params.id,
    });
    return jsonOk({ deleted: true });
  });
}
