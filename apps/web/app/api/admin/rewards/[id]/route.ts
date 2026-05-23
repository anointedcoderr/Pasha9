// Built by Anointed Coder.

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db/client';
import { withAuth, ensurePermission, recordActivity } from '@/lib/auth/guard';
import { jsonError, jsonOk } from '@/lib/auth/errors';

const updateSchema = z.object({
  title: z.string().min(2).max(120).optional(),
  description: z.string().max(500).optional().nullable(),
  cost: z.coerce.number().int().min(0).max(100_000_000).optional(),
  category: z.enum(['recharge', 'spin', 'bet', 'physical', 'misc']).optional(),
  accent: z.enum(['yellow', 'blue', 'red', 'green']).optional(),
  position: z.coerce.number().int().min(0).max(99).optional(),
  status: z.enum(['active', 'hidden', 'paused']).optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  return withAuth(async () => {
    const session = await ensurePermission('rewards.write');
    const body = await req.json().catch(() => ({}));
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) return jsonError(400, 'VALIDATION', undefined, { issues: parsed.error.issues });
    const item = await db.rewardItem.update({ where: { id: params.id }, data: parsed.data });
    await recordActivity({ actorId: session.sub, actorRole: session.role, action: 'REWARD_UPDATE', target: item.id });
    return jsonOk({ item });
  });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  return withAuth(async () => {
    const session = await ensurePermission('rewards.write');
    await db.rewardItem.delete({ where: { id: params.id } });
    await recordActivity({ actorId: session.sub, actorRole: session.role, action: 'REWARD_DELETE', target: params.id });
    return jsonOk({ deleted: true });
  });
}
