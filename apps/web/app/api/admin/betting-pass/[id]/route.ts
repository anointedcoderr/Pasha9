// Built by Anointed Coder.
//
// PATCH  /api/admin/betting-pass/[id]   edit a tier rule
// DELETE /api/admin/betting-pass/[id]   remove a tier rule
//
// Deleting a rule cascades through BettingPassClaim (Prisma onDelete).
// In practice the operator should toggle isActive=false instead of
// deleting once players have started claiming.

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAuth, ensurePermission, recordActivity } from '@/lib/auth/guard';
import { jsonOk, jsonError } from '@/lib/auth/errors';
import { db } from '@/lib/db/client';

const patchSchema = z.object({
  tier: z.number().int().min(0).max(100).optional(),
  nameEn: z.string().trim().min(1).max(80).optional(),
  nameBn: z.string().trim().max(80).optional().nullable(),
  descriptionEn: z.string().trim().max(400).optional().nullable(),
  descriptionBn: z.string().trim().max(400).optional().nullable(),
  iconUrl: z.string().trim().max(500).optional().nullable(),
  pointsRequired: z.number().int().min(0).max(10_000_000).optional(),
  rewardKind: z.enum(['coins', 'bonus', 'freebet', 'physical']).optional(),
  rewardAmount: z.number().min(0).max(10_000_000).optional(),
  turnoverX: z.number().min(0).max(50).optional(),
  bonusRuleId: z.string().trim().max(60).optional().nullable(),
  isActive: z.boolean().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  return withAuth(async () => {
    const session = await ensurePermission('rewards.write');
    const body = await req.json().catch(() => ({}));
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) return jsonError(400, 'VALIDATION', undefined, { issues: parsed.error.issues });

    const existing = await db.bettingPassRule.findUnique({ where: { id: params.id } });
    if (!existing) return jsonError(404, 'NOT_FOUND');

    if (parsed.data.tier != null && parsed.data.tier !== existing.tier) {
      const dup = await db.bettingPassRule.findUnique({ where: { tier: parsed.data.tier } });
      if (dup) return jsonError(409, 'DUPLICATE_TIER', `Tier ${parsed.data.tier} already exists.`);
    }

    const updated = await db.bettingPassRule.update({
      where: { id: params.id },
      data: parsed.data,
    });

    await recordActivity({
      actorId: session.sub,
      actorRole: session.role,
      action: 'BETTING_PASS_RULE_PATCH',
      target: params.id,
      meta: { changes: parsed.data },
    });

    return jsonOk({ rule: updated });
  });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  return withAuth(async () => {
    const session = await ensurePermission('rewards.write');

    const existing = await db.bettingPassRule.findUnique({ where: { id: params.id } });
    if (!existing) return jsonError(404, 'NOT_FOUND');

    await db.bettingPassRule.delete({ where: { id: params.id } });

    await recordActivity({
      actorId: session.sub,
      actorRole: session.role,
      action: 'BETTING_PASS_RULE_DELETE',
      target: params.id,
      meta: { tier: existing.tier, name: existing.nameEn },
    });

    return jsonOk({ ok: true });
  });
}
