// Built by Anointed Coder.
//
// PATCH  /api/admin/deposit-bonus-tiers/[id]
// DELETE /api/admin/deposit-bonus-tiers/[id]
//
// PATCH re-runs syncTierToBonusRule so the BonusRule row stays in
// lockstep with the tier. DELETE drops the matching BonusRule via
// removeTierBonusRule when no player history exists; otherwise it
// archives (tier disabled + rule hidden) so grant history survives.

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAuth, ensurePermission, recordActivity } from '@/lib/auth/guard';
import { getCurrentSession } from '@/lib/auth/rbac';
import { jsonError, jsonOk } from '@/lib/auth/errors';
import { db } from '@/lib/db/client';
import { syncTierToBonusRule, removeTierBonusRule } from '@/lib/bonuses/deposit-tiers';

// The /admin/deposit-bonus-tiers page is gated by 'bonuses.write' in
// admin-permission-map.ts, but this API used to require only
// 'settings.write'. An operator holding bonuses.write could open the
// page yet every save/delete answered 403 FORBIDDEN, which the old UI
// swallowed. Accept either permission so the page gate and the API
// gate agree.
async function ensureTierPermission() {
  try {
    return await ensurePermission('bonuses.write');
  } catch {
    return ensurePermission('settings.write');
  }
}

const patchSchema = z.object({
  minDeposit: z.coerce.number().min(0).max(10_000_000).optional(),
  percentage: z.coerce.number().int().min(0).max(100).optional(),
  // Per-grant wager multiplier (see DepositBonusTier model comment).
  turnoverX: z.coerce.number().min(0).max(50).optional(),
  // Per-user claim limit mirrored into the managed BonusRule.
  claimPeriod: z.enum(['unlimited', 'account', 'day', 'week', 'month']).optional(),
  claimLimit: z.coerce.number().int().min(0).max(1000).optional(),
  isActive: z.boolean().optional(),
  position: z.number().int().min(0).max(9999).optional(),
  titleEn: z.string().trim().max(120).optional().nullable(),
  titleBn: z.string().trim().max(120).optional().nullable(),
  descriptionEn: z.string().trim().max(2000).optional().nullable(),
  descriptionBn: z.string().trim().max(2000).optional().nullable(),
  bannerUrl: z.string().trim().max(500).optional().nullable(),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  return withAuth(async () => {
    await ensureTierPermission();
    const claims = await getCurrentSession();
    if (!claims) return jsonError(401, 'UNAUTHENTICATED');

    const body = await req.json().catch(() => ({}));
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) return jsonError(400, 'VALIDATION', undefined, { issues: parsed.error.issues });

    const existing = await db.depositBonusTier.findUnique({ where: { id: params.id } });
    if (!existing) return jsonError(404, 'NOT_FOUND');

    const updated = await db.depositBonusTier.update({ where: { id: params.id }, data: parsed.data });
    try {
      await syncTierToBonusRule(updated);
    } catch (err) {
      console.error('[deposit-bonus-tiers] sync failed', err);
    }

    await recordActivity({
      actorId: claims.sub,
      actorRole: claims.role,
      action: 'DEPOSIT_TIER_PATCH',
      target: params.id,
      meta: { changes: parsed.data },
    });

    return jsonOk({ tier: updated });
  });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  return withAuth(async () => {
    await ensureTierPermission();
    const claims = await getCurrentSession();
    if (!claims) return jsonError(401, 'UNAUTHENTICATED');

    const existing = await db.depositBonusTier.findUnique({ where: { id: params.id } });
    if (!existing) return jsonError(404, 'NOT_FOUND');

    // Each tier materialises into a managed BonusRule. If players
    // already received grants (or claim records) under that rule, or
    // any deposit captured the rule as its promotion context (a
    // claimed promotion creates a PENDING deposit before any grant
    // exists, so deposits are counted in every status), a hard delete
    // would orphan that history. Archive instead: deactivate the tier
    // and hide the managed rule. Money rows are never touched.
    const managedRule = await db.bonusRule.findUnique({
      where: { code: `deposit_tier_${params.id}` },
      include: { _count: { select: { userBonuses: true, promotionClaims: true } } },
    });
    const depositRefs = managedRule
      ? await db.deposit.count({ where: { promotionRuleId: managedRule.id } })
      : 0;
    const historyCount = managedRule
      ? managedRule._count.userBonuses + managedRule._count.promotionClaims + depositRefs
      : 0;

    if (historyCount > 0) {
      await db.depositBonusTier.update({ where: { id: params.id }, data: { isActive: false } });
      await db.bonusRule.update({ where: { id: managedRule!.id }, data: { status: 'hidden' } });
      await recordActivity({
        actorId: claims.sub,
        actorRole: claims.role,
        action: 'DEPOSIT_TIER_ARCHIVE',
        target: params.id,
        meta: { minDeposit: Number(existing.minDeposit), percentage: existing.percentage, grants: historyCount },
      });
      return jsonOk({
        ok: true,
        archived: true,
        message: 'Players already received this tier bonus, so it was disabled instead of deleted to keep the money history. খেলোয়াড়রা ইতিমধ্যে এই টিয়ারের বোনাস পেয়েছে, তাই টাকার হিসাব রক্ষা করতে এটি মুছে না ফেলে নিষ্ক্রিয় করা হয়েছে।',
      });
    }

    await db.depositBonusTier.delete({ where: { id: params.id } });
    try {
      await removeTierBonusRule(params.id);
    } catch (err) {
      console.error('[deposit-bonus-tiers] removeTierBonusRule failed', err);
    }

    await recordActivity({
      actorId: claims.sub,
      actorRole: claims.role,
      action: 'DEPOSIT_TIER_DELETE',
      target: params.id,
      meta: { minDeposit: Number(existing.minDeposit), percentage: existing.percentage },
    });

    return jsonOk({ ok: true, archived: false });
  });
}
