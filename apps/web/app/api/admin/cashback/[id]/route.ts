// Built by Anointed Coder.
//
// PATCH  /api/admin/cashback/[id]   edit fields
// DELETE /api/admin/cashback/[id]   delete (only when no payouts)

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { db } from '@/lib/db/client';
import { withAuth, ensurePermission, recordActivity } from '@/lib/auth/guard';
import { jsonError, jsonOk } from '@/lib/auth/errors';

const patchSchema = z.object({
  nameEn: z.string().trim().min(1).max(120).optional(),
  nameBn: z.string().trim().max(120).nullable().optional(),
  source: z.enum(['net_loss', 'wager_amount']).optional(),
  percentage: z.coerce.number().min(0).max(100).optional(),
  maxCashback: z.coerce.number().min(0).max(10_000_000).optional(),
  turnoverX: z.coerce.number().min(0).max(100).optional(),
  cadence: z.enum(['daily', 'weekly', 'monthly']).optional(),
  startsAt: z.string().datetime().nullable().optional(),
  endsAt: z.string().datetime().nullable().optional(),
  isActive: z.boolean().optional(),
  scopeType: z.enum(['all', 'match']).optional(),
  scopeKeys: z.array(z.string().trim().min(1).max(40)).max(40).optional(),
  bonusRuleId: z.string().trim().min(1).max(60).nullable().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  return withAuth(async () => {
    const session = await ensurePermission('bonuses.write');
    const existing = await db.cashbackCampaign.findUnique({ where: { id: params.id } });
    if (!existing) return jsonError(404, 'NOT_FOUND');
    const body = await req.json().catch(() => ({}));
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) return jsonError(400, 'VALIDATION', undefined, { issues: parsed.error.issues });
    const d = parsed.data;

    if (d.bonusRuleId) {
      const rule = await db.bonusRule.findUnique({ where: { id: d.bonusRuleId } });
      if (!rule) return jsonError(400, 'VALIDATION', 'Bonus Rule not found.');
    }
    if (d.scopeType === 'match' && Array.isArray(d.scopeKeys) && d.scopeKeys.length === 0) {
      return jsonError(400, 'VALIDATION', 'Select at least one scope key when scope is set to Match.');
    }

    const updated = await db.cashbackCampaign.update({
      where: { id: params.id },
      data: {
        ...(d.nameEn !== undefined ? { nameEn: d.nameEn } : {}),
        ...(d.nameBn !== undefined ? { nameBn: d.nameBn } : {}),
        ...(d.source !== undefined ? { source: d.source } : {}),
        ...(d.percentage !== undefined ? { percentage: new Prisma.Decimal(d.percentage) } : {}),
        ...(d.maxCashback !== undefined ? { maxCashback: new Prisma.Decimal(d.maxCashback) } : {}),
        ...(d.turnoverX !== undefined ? { turnoverX: new Prisma.Decimal(d.turnoverX) } : {}),
        ...(d.cadence !== undefined ? { cadence: d.cadence } : {}),
        ...(d.startsAt !== undefined ? { startsAt: d.startsAt ? new Date(d.startsAt) : null } : {}),
        ...(d.endsAt !== undefined ? { endsAt: d.endsAt ? new Date(d.endsAt) : null } : {}),
        ...(d.isActive !== undefined ? { isActive: d.isActive } : {}),
        ...(d.scopeType !== undefined ? { scopeType: d.scopeType } : {}),
        ...(d.scopeKeys !== undefined ? { scopeKeys: d.scopeKeys } : {}),
        ...(d.bonusRuleId !== undefined ? { bonusRuleId: d.bonusRuleId } : {}),
      },
    });

    await recordActivity({
      actorId: session.sub,
      actorRole: session.role,
      action: 'CASHBACK_CAMPAIGN_UPDATE',
      target: updated.id,
      detail: updated.nameEn,
    });

    return jsonOk({ campaign: updated });
  });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  return withAuth(async () => {
    const session = await ensurePermission('bonuses.write');
    const existing = await db.cashbackCampaign.findUnique({
      where: { id: params.id },
      include: { _count: { select: { payouts: true } } },
    });
    if (!existing) return jsonError(404, 'NOT_FOUND');
    if (existing._count.payouts > 0) {
      return jsonError(409, 'IN_USE', 'Campaign has issued payouts. Deactivate it instead of deleting to preserve audit history.');
    }
    await db.cashbackCampaign.delete({ where: { id: params.id } });
    await recordActivity({
      actorId: session.sub,
      actorRole: session.role,
      action: 'CASHBACK_CAMPAIGN_DELETE',
      target: params.id,
      detail: existing.nameEn,
    });
    return jsonOk({ ok: true });
  });
}
