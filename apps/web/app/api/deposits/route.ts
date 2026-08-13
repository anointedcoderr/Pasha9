// Built by Anointed Coder.
//
// User-facing deposit submission. Body:
//   { amount, method, transactionId, proofUrl? }
// Writes a Deposit row with status=pending. The admin queue at
// /admin/deposits picks it up; approval credits the wallet and runs
// the lottery + bonus + affiliate hooks (see
// /api/admin/deposits/[id]/approve).
//
// M4 Phase C additions:
//   - Computes the deposit-bonus-tier preview at submit time and
//     snapshots bonusPercentage + bonusAmount on the row so the
//     admin can see what the player was promised even if the tier
//     definitions change between submit and approval.
//   - proofUrl is now validated to start with /uploads/ so the form
//     cannot inject an off-site URL into the admin review.

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { db } from '@/lib/db/client';
import { requireActiveUser } from '@/lib/auth/rbac';
import { withAuth, recordActivity } from '@/lib/auth/guard';
import { jsonError, jsonOk } from '@/lib/auth/errors';
import { rateLimit } from '@/lib/auth/rate-limit';
import { pickBestTier, resolveActiveTierRule } from '@/lib/bonuses/deposit-tiers';
import { previewDepositPromotion } from '@/lib/promotions/deposit';
import { resolveClaimBehavior } from '@/lib/promotions/config';
import { notifyAdminsDepositPending } from '@/lib/notifications/notify';

const schema = z.object({
  amount: z.coerce.number().min(100).max(500_000),
  method: z.string().trim().min(1).max(60),
  transactionId: z.string().trim().min(6).max(64),
  proofUrl: z
    .string()
    .trim()
    .max(500)
    .optional()
    .nullable()
    .refine((v) => v == null || v === '' || v.startsWith('/uploads/'), {
      message: 'proofUrl must be a path served from /uploads/',
    }),
  promotionId: z.string().trim().min(1).max(60).optional().nullable(),
  promoCode: z.string().trim().min(1).max(60).optional().nullable(),
});

export async function POST(req: NextRequest) {
  return withAuth(async () => {
    const session = await requireActiveUser();

    const limit = rateLimit(`deposit-submit:${session.sub}`, 5, 60_000);
    if (!limit.ok) return jsonError(429, 'RATE_LIMITED');

    const body = await req.json().catch(() => ({}));
    const parsed = schema.safeParse(body);
    if (!parsed.success) return jsonError(400, 'VALIDATION', undefined, { issues: parsed.error.issues });

    // The schema's 100-500,000 range is a blanket safety net only. The real
    // limit an operator sets per channel in Payment Methods (minDeposit /
    // maxDeposit on PaymentMethod) was never actually read here - it was
    // shown on the deposit form as a hint, but nothing server-side stopped a
    // request that skipped or under/overshot it, which is trivially
    // bypassable by posting to this endpoint directly. Enforced here now,
    // against the real configured channel, not the generic fallback.
    const channel = await db.paymentMethod.findUnique({
      where: { name: parsed.data.method },
      select: { minDeposit: true, maxDeposit: true, depositEnabled: true, status: true },
    });
    if (channel) {
      if (!channel.depositEnabled || channel.status !== 'active') {
        return jsonError(409, 'METHOD_UNAVAILABLE', 'This deposit method is not currently available.');
      }
      const min = channel.minDeposit != null ? Number(channel.minDeposit) : null;
      const max = channel.maxDeposit != null ? Number(channel.maxDeposit) : null;
      if (min != null && parsed.data.amount < min) {
        return jsonError(400, 'AMOUNT_TOO_LOW', `Minimum deposit for this method is ${min}.`);
      }
      if (max != null && parsed.data.amount > max) {
        return jsonError(400, 'AMOUNT_TOO_HIGH', `Maximum deposit for this method is ${max}.`);
      }
    }
    // No matching row (a renamed or removed method slipping through on a
    // stale client) falls through to the schema's generic range rather than
    // blocking every deposit - a missing lookup should never be stricter
    // than simply not having a per-channel override configured.

    let promotionRule: Awaited<ReturnType<typeof db.bonusRule.findUnique>> = null;
    if (parsed.data.promotionId) {
      promotionRule = await db.bonusRule.findUnique({ where: { id: parsed.data.promotionId } });
      const now = new Date();
      if (!promotionRule || promotionRule.status !== 'active') {
        return jsonError(409, 'PROMOTION_UNAVAILABLE', 'The selected promotion is no longer active.');
      }
      if (promotionRule.startsAt && promotionRule.startsAt > now) {
        return jsonError(409, 'PROMOTION_UNAVAILABLE', 'The selected promotion has not started yet.');
      }
      if (promotionRule.endsAt && promotionRule.endsAt < now) {
        return jsonError(409, 'PROMOTION_UNAVAILABLE', 'The selected promotion has ended.');
      }
      if (resolveClaimBehavior(promotionRule) !== 'deposit') {
        return jsonError(409, 'PROMOTION_ACTION_INVALID', 'The selected promotion is not claimed through deposit.');
      }
      if (parsed.data.promoCode && promotionRule.code && parsed.data.promoCode !== promotionRule.code) {
        return jsonError(409, 'PROMO_CODE_MISMATCH', 'The promotion code does not match the selected promotion.');
      }
    }

    const selectedPreview = promotionRule
      ? await previewDepositPromotion(promotionRule.id, parsed.data.amount)
      : null;
    if (promotionRule && !selectedPreview) {
      return jsonError(409, 'PROMOTION_CONFIG_ERROR', 'The selected promotion is temporarily unavailable.');
    }
    const tierPreview = selectedPreview ? null : await pickBestTier(parsed.data.amount).catch(() => null);
    const preview = selectedPreview ?? tierPreview ?? {
      tier: null, bonusPercentage: 0, bonusAmount: 0, totalCredit: parsed.data.amount,
    };

    // Tier-backed bonuses are synced into BonusRule with
    // code='deposit_tier_<tierId>' by syncTierToBonusRule. When the
    // visitor hits /deposit without an explicit promotionId but a
    // matching tier returns a positive bonus, snap the corresponding
    // BonusRule onto the deposit row so the admin approve route can
    // re-use the same applySelectedDepositPromotion code path the
    // explicit promotion flow uses. Before this snap the approve
    // route fell through to applyDepositBonuses() which iterates the
    // first_deposit / reload / promo rules but did not find the
    // tier-synced rule by name, leaving the player un-credited.
    //
    // The lookup is now via resolveActiveTierRule which self-heals
    // if the tier-synced rule is missing or inactive: it calls
    // syncTierToBonusRule inline and re-reads. Without this the
    // submit row saved promotionRuleId=NULL whenever the sync had
    // drifted (rule deleted out of band, or tier created before
    // the sync code shipped), which silently killed the bonus
    // grant at approval time.
    let resolvedPromotionRule: { id: string; code: string | null } | null = promotionRule;
    if (!resolvedPromotionRule && tierPreview?.tier && tierPreview.bonusAmount > 0) {
      const matchingTier = await db.depositBonusTier.findUnique({ where: { id: tierPreview.tier.id } });
      if (matchingTier) {
        const resolved = await resolveActiveTierRule(matchingTier);
        if (resolved) {
          resolvedPromotionRule = { id: resolved.id, code: resolved.code };
        }
      }
    }

    const deposit = await db.deposit.create({
      data: {
        userId: session.sub,
        amount: parsed.data.amount,
        method: parsed.data.method,
        transactionId: parsed.data.transactionId,
        proofUrl: parsed.data.proofUrl ?? null,
        status: 'pending',
        bonusPercentage: preview.bonusPercentage > 0 ? new Prisma.Decimal(preview.bonusPercentage) : null,
        bonusAmount: preview.bonusAmount > 0 ? new Prisma.Decimal(preview.bonusAmount) : null,
        promotionRuleId: resolvedPromotionRule?.id ?? null,
        promotionCode: resolvedPromotionRule?.code ?? parsed.data.promoCode ?? null,
      },
    });

    await recordActivity({
      actorId: session.sub,
      actorRole: session.role,
      action: 'DEPOSIT_SUBMIT',
      target: deposit.id,
      meta: {
        amount: Number(parsed.data.amount),
        method: parsed.data.method,
        transactionId: parsed.data.transactionId,
        hasProof: Boolean(parsed.data.proofUrl),
        promisedBonusPercentage: preview.bonusPercentage,
        promisedBonusAmount: preview.bonusAmount,
        promisedTotalCredit: preview.totalCredit,
        promotionRuleId: resolvedPromotionRule?.id ?? null,
        promotionCode: resolvedPromotionRule?.code ?? parsed.data.promoCode ?? null,
      },
    });

    // Ping every staff user. Fire-and-forget; a notify failure must
    // never fail the user-facing deposit submission.
    notifyAdminsDepositPending({
      depositId: deposit.id,
      amount: Number(parsed.data.amount),
      method: parsed.data.method,
      userId: session.sub,
    }).catch((err) => console.error('[deposits] admin notify failed', err));

    return jsonOk(
      {
        deposit: {
          id: deposit.id,
          amount: Number(deposit.amount),
          method: deposit.method,
          transactionId: deposit.transactionId,
          status: deposit.status,
          createdAt: deposit.createdAt,
          bonusPercentage: deposit.bonusPercentage == null ? 0 : Number(deposit.bonusPercentage),
          bonusAmount: deposit.bonusAmount == null ? 0 : Number(deposit.bonusAmount),
          totalCredit: Number(deposit.amount) + (deposit.bonusAmount == null ? 0 : Number(deposit.bonusAmount)),
          proofUrl: deposit.proofUrl,
          promotionRuleId: deposit.promotionRuleId,
          promotionCode: deposit.promotionCode,
        },
      },
      201,
    );
  });
}
