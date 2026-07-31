// Built by Anointed Coder.
//
// Player-facing endpoint that starts a StarPay deposit. StarPay is a
// hosted-payment / QR gateway: we create an order, then redirect the
// player to the returned payUrl. On the async callback
// (/api/payments/starpay/callback) the signed notify credits the deposit.
//
// Flow:
//   1. Validate amount + method, resolve promotion / tier bonus exactly
//      like the manual + ZinIPay + ChaopaoPay flows.
//   2. Create a Deposit row (status='pending', providerKey='starpay')
//      with our mchOrderNo stored as transactionId so the callback can
//      match it back.
//   3. Call StarPay create-order with the channel productId for the
//      chosen method and our callback URL as notifyUrl.
//   4. Return { depositId, paymentUrl } - the client redirects there.

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
import { readStarPaySettings, starpayCreateOrder, starpayDepositChannel } from '@/lib/payments/starpay-client';

const schema = z.object({
  amount: z.coerce.number().min(100).max(500_000),
  method: z.enum(['combined', 'bkash', 'nagad', 'rocket']).optional().default('combined'),
  promotionId: z.string().trim().min(1).max(60).optional().nullable(),
  promoCode: z.string().trim().min(1).max(60).optional().nullable(),
});

function originFromRequest(req: NextRequest): string {
  const cfg = process.env.PUBLIC_BASE_URL?.trim() || process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (cfg) return cfg.replace(/\/+$/, '');
  const proto = req.headers.get('x-forwarded-proto') ?? 'https';
  const host = req.headers.get('host') ?? '';
  return host ? `${proto}://${host}` : '';
}

function clientIp(req: NextRequest): string {
  return (
    req.headers.get('cf-connecting-ip') ||
    req.headers.get('x-real-ip') ||
    (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() ||
    '0.0.0.0'
  );
}

export async function POST(req: NextRequest) {
  return withAuth(async () => {
    const session = await requireActiveUser();

    const limit = rateLimit(`deposit-starpay:${session.sub}`, 8, 60_000);
    if (!limit.ok) return jsonError(429, 'RATE_LIMITED');

    const body = await req.json().catch(() => ({}));
    const parsed = schema.safeParse(body);
    if (!parsed.success) return jsonError(400, 'VALIDATION', undefined, { issues: parsed.error.issues });

    const cfg = await readStarPaySettings();
    if (!cfg.enabled) return jsonError(503, 'STARPAY_DISABLED', 'StarPay is not enabled.');
    if (!cfg.mchId || !cfg.secret) return jsonError(503, 'STARPAY_NOT_CONFIGURED', 'StarPay is not configured.');

    // Same bonus/promo resolution as the other deposit paths so a StarPay
    // deposit gets the same promised bonus.
    let promotionRule: Awaited<ReturnType<typeof db.bonusRule.findUnique>> = null;
    if (parsed.data.promotionId) {
      promotionRule = await db.bonusRule.findUnique({ where: { id: parsed.data.promotionId } });
      const now = new Date();
      if (!promotionRule || promotionRule.status !== 'active') return jsonError(409, 'PROMOTION_UNAVAILABLE', 'Selected promotion is no longer active.');
      if (promotionRule.startsAt && promotionRule.startsAt > now) return jsonError(409, 'PROMOTION_UNAVAILABLE', 'Selected promotion has not started.');
      if (promotionRule.endsAt && promotionRule.endsAt < now) return jsonError(409, 'PROMOTION_UNAVAILABLE', 'Selected promotion has ended.');
      if (resolveClaimBehavior(promotionRule) !== 'deposit') return jsonError(409, 'PROMOTION_ACTION_INVALID', 'Selected promotion is not deposit-backed.');
    }

    const selectedPreview = promotionRule
      ? await previewDepositPromotion(promotionRule.id, parsed.data.amount)
      : null;
    if (promotionRule && !selectedPreview) {
      return jsonError(409, 'PROMOTION_CONFIG_ERROR', 'Selected promotion is temporarily unavailable.');
    }
    const tierPreview = selectedPreview ? null : await pickBestTier(parsed.data.amount).catch(() => null);
    const preview = selectedPreview ?? tierPreview ?? {
      tier: null, bonusPercentage: 0, bonusAmount: 0, totalCredit: parsed.data.amount,
    };

    let resolvedPromotionRule: { id: string; code: string | null } | null = promotionRule;
    if (!resolvedPromotionRule && tierPreview?.tier && tierPreview.bonusAmount > 0) {
      const matchingTier = await db.depositBonusTier.findUnique({ where: { id: tierPreview.tier.id } });
      if (matchingTier) {
        const resolved = await resolveActiveTierRule(matchingTier);
        if (resolved) resolvedPromotionRule = { id: resolved.id, code: resolved.code };
      }
    }

    const origin = originFromRequest(req);
    const notifyUrl = `${origin}/api/payments/starpay/callback`;
    const returnUrl = `${origin}/deposit/result?provider=starpay`;

    // Our unique merchant order number. Stored as the deposit's
    // transactionId so the signed callback (which echoes mchOrderNo) maps
    // back to this row.
    const mchOrderNo = `SP${Date.now()}${Math.floor(Math.random() * 1000)}`;

    const deposit = await db.deposit.create({
      data: {
        userId: session.sub,
        amount: parsed.data.amount,
        method: `starpay_${parsed.data.method}`,
        transactionId: mchOrderNo,
        providerKey: 'starpay',
        status: 'pending',
        bonusPercentage: preview.bonusPercentage > 0 ? new Prisma.Decimal(preview.bonusPercentage) : null,
        bonusAmount: preview.bonusAmount > 0 ? new Prisma.Decimal(preview.bonusAmount) : null,
        promotionRuleId: resolvedPromotionRule?.id ?? null,
        promotionCode: resolvedPromotionRule?.code ?? parsed.data.promoCode ?? null,
      },
    });

    const result = await starpayCreateOrder({
      mchOrderNo,
      amountBdt: parsed.data.amount,
      productId: starpayDepositChannel(cfg, parsed.data.method),
      clientIp: clientIp(req),
      notifyUrl,
      returnUrl,
      subject: 'Wallet deposit',
    });

    if (!result.ok) {
      await db.deposit.update({
        where: { id: deposit.id },
        data: { adminNote: `StarPay create-order failed: ${result.error.slice(0, 400)}` },
      });
      console.error('[starpay] create-deposit gateway error', result.error, result.raw);
      return jsonError(502, result.error, 'StarPay did not return a payment URL. Try again or use a different method.');
    }

    // Keep the provider order id for O(1) callback matching + reconciliation.
    if (result.payOrderId) {
      await db.deposit.update({
        where: { id: deposit.id },
        data: { providerRef: result.payOrderId, adminNote: `StarPay order ${result.payOrderId} issued.` },
      });
    }

    await recordActivity({
      actorId: session.sub,
      actorRole: session.role,
      action: 'DEPOSIT_STARPAY_INIT',
      target: deposit.id,
      meta: {
        amount: parsed.data.amount,
        method: parsed.data.method,
        mchOrderNo,
        payOrderId: result.payOrderId ?? null,
        promisedBonusAmount: preview.bonusAmount,
      },
    });

    return jsonOk(
      {
        depositId: deposit.id,
        mchOrderNo,
        payOrderId: result.payOrderId,
        amount: parsed.data.amount,
        currency: 'BDT',
        paymentUrl: result.payUrl,
        bonusAmount: preview.bonusAmount,
        totalCredit: preview.totalCredit,
      },
      201,
    );
  });
}
