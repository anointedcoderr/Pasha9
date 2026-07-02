// Built by Anointed Coder.
//
// PATCH  /api/admin/cashback/[id]   edit fields
// DELETE /api/admin/cashback/[id]   hard delete when no payouts exist,
//                                   otherwise archive (deactivate) so
//                                   payout history is preserved

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
    const existing = await db.cashbackCampaign.findUnique({ where: { id: params.id } });
    if (!existing) return jsonError(404, 'NOT_FOUND');
    // Payout history must never be deleted. When payouts exist the
    // campaign is archived (deactivated) instead of hard deleted, so
    // the money trail stays intact and the operator still sees a
    // clear result from the Delete click.
    //
    // The check and the delete must be one statement: the nightly
    // cashback cron can insert a payout between a count and a delete,
    // and CashbackPayout rows cascade on campaign delete. deleteMany
    // with a payouts none filter deletes only when no payout exists
    // at delete time; count 0 means a payout appeared, so archive.
    const res = await db.cashbackCampaign.deleteMany({
      where: { id: params.id, payouts: { none: {} } },
    });
    if (res.count === 0) {
      if (existing.isActive) {
        await db.cashbackCampaign.update({ where: { id: params.id }, data: { isActive: false } });
      }
      await recordActivity({
        actorId: session.sub,
        actorRole: session.role,
        action: 'CASHBACK_CAMPAIGN_ARCHIVE',
        target: params.id,
        detail: existing.nameEn,
      });
      return jsonOk({
        ok: true,
        archived: true,
        message: 'Players already received payouts from this campaign, so it was deactivated instead of deleted to keep the money history. খেলোয়াড়রা ইতিমধ্যে এই ক্যাম্পেইন থেকে ক্যাশব্যাক পেয়েছে, তাই টাকার হিসাব রক্ষা করতে এটি মুছে না ফেলে নিষ্ক্রিয় করা হয়েছে।',
      });
    }
    await recordActivity({
      actorId: session.sub,
      actorRole: session.role,
      action: 'CASHBACK_CAMPAIGN_DELETE',
      target: params.id,
      detail: existing.nameEn,
    });
    return jsonOk({ ok: true, archived: false });
  });
}
