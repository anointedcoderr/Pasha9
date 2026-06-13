// Built by Anointed Coder.
//
// Player-facing endpoint that starts a ChaopaoPay deposit. Flow:
//
//   1. Validate amount + method (bkash/nagad)
//   2. Resolve any promotion / tier bonus (same logic the manual
//      flow uses, so a promo bonus stays consistent regardless of
//      whether the player paid via manual TX upload or via the
//      automated gateway)
//   3. Create a Deposit row with status='pending', providerKey
//      = 'chaopaopay', transactionId = a unique trx_id we generate
//   4. Call ChaopaoPay payin/create.php with that trx_id, the
//      method_code, the callback URL and a return URL
//   5. Store ChaopaoPay's transaction_id on Deposit.providerRef so
//      the webhook can match the deposit by providerKey + providerRef
//   6. Return { depositId, paymentUrl, expiresAt } to the client
//
// The client redirects the player to paymentUrl. The player completes
// the payment on bKash/Nagad. ChaopaoPay POSTs the webhook to
// /api/payments/webhook/chaopaopay. The signature is verified by the
// adapter, the service layer matches the deposit, credits the wallet,
// and ticket accrual + bonus engine run as part of the existing path.

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { randomBytes } from 'crypto';
import { db } from '@/lib/db/client';
import { requireActiveUser } from '@/lib/auth/rbac';
import { withAuth, recordActivity } from '@/lib/auth/guard';
import { jsonError, jsonOk } from '@/lib/auth/errors';
import { rateLimit } from '@/lib/auth/rate-limit';
import { pickBestTier, resolveActiveTierRule } from '@/lib/bonuses/deposit-tiers';
import { previewDepositPromotion } from '@/lib/promotions/deposit';
import { resolveClaimBehavior } from '@/lib/promotions/config';
import { createChaopaoPayIn, type ChaopaoPayMethod } from '@/lib/payments/chaopaopay-client';

const schema = z.object({
  amount: z.coerce.number().min(100).max(500_000),
  method: z.enum(['bkash', 'nagad']),
  promotionId: z.string().trim().min(1).max(60).optional().nullable(),
  promoCode: z.string().trim().min(1).max(60).optional().nullable(),
});

function generateTrxId(): string {
  // PAY-<8 random bytes hex>. ChaopaoPay accepts free-form trx_id
  // strings; we use a short prefixed random one so the operator can
  // spot a Pasha 9 transaction at a glance in the ChaopaoPay panel.
  return `PAY-${randomBytes(8).toString('hex').toUpperCase()}`;
}

function originFromRequest(req: NextRequest): string {
  // Prefer the configured public URL; fall back to the host header.
  const cfg = process.env.PUBLIC_BASE_URL?.trim();
  if (cfg) return cfg.replace(/\/+$/, '');
  const proto = req.headers.get('x-forwarded-proto') ?? 'https';
  const host = req.headers.get('host') ?? '';
  return host ? `${proto}://${host}` : '';
}

export async function POST(req: NextRequest) {
  return withAuth(async () => {
    const session = await requireActiveUser();

    const limit = rateLimit(`deposit-chaopaopay:${session.sub}`, 8, 60_000);
    if (!limit.ok) return jsonError(429, 'RATE_LIMITED');

    const body = await req.json().catch(() => ({}));
    const parsed = schema.safeParse(body);
    if (!parsed.success) return jsonError(400, 'VALIDATION', undefined, { issues: parsed.error.issues });
    const method = parsed.data.method as ChaopaoPayMethod;

    // Resolve the bonus tier / promotion exactly the same way the
    // manual flow does so a player who picks "Deposit via ChaopaoPay"
    // gets the same promised bonus as a player who picks "Manual TX
    // upload" for the same amount + same selected promotion.
    let promotionRule: Awaited<ReturnType<typeof db.bonusRule.findUnique>> = null;
    if (parsed.data.promotionId) {
      promotionRule = await db.bonusRule.findUnique({ where: { id: parsed.data.promotionId } });
      const now = new Date();
      if (!promotionRule || promotionRule.status !== 'active') return jsonError(409, 'PROMOTION_UNAVAILABLE', 'Selected promotion is no longer active.');
      if (promotionRule.startsAt && promotionRule.startsAt > now) return jsonError(409, 'PROMOTION_UNAVAILABLE', 'Selected promotion has not started.');
      if (promotionRule.endsAt && promotionRule.endsAt < now) return jsonError(409, 'PROMOTION_UNAVAILABLE', 'Selected promotion has ended.');
      if (resolveClaimBehavior(promotionRule) !== 'deposit') return jsonError(409, 'PROMOTION_ACTION_INVALID', 'Selected promotion is not deposit-backed.');
      if (parsed.data.promoCode && promotionRule.code && parsed.data.promoCode !== promotionRule.code) {
        return jsonError(409, 'PROMO_CODE_MISMATCH', 'Promo code does not match the selected promotion.');
      }
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

    // Customer name is the player's username, which the ChaopaoPay
    // dashboard displays alongside every transaction. The gateway
    // truncates this internally; we just trim and bound length here.
    const user = await db.user.findUniqueOrThrow({
      where: { id: session.sub },
      select: { username: true, email: true, phone: true },
    });

    const trxId = generateTrxId();
    const origin = originFromRequest(req);
    const callbackUrl = `${origin}/api/payments/webhook/chaopaopay`;
    const returnUrl = `${origin}/deposit/result?trx=${encodeURIComponent(trxId)}`;

    // Create the Deposit row BEFORE calling the gateway so even if the
    // gateway call fails / times out we have a record of the intent
    // the operator can investigate from /admin/deposits.
    const deposit = await db.deposit.create({
      data: {
        userId: session.sub,
        amount: parsed.data.amount,
        method: `chaopaopay_${method}`,
        transactionId: trxId,
        providerKey: 'chaopaopay',
        status: 'pending',
        bonusPercentage: preview.bonusPercentage > 0 ? new Prisma.Decimal(preview.bonusPercentage) : null,
        bonusAmount: preview.bonusAmount > 0 ? new Prisma.Decimal(preview.bonusAmount) : null,
        promotionRuleId: resolvedPromotionRule?.id ?? null,
        promotionCode: resolvedPromotionRule?.code ?? parsed.data.promoCode ?? null,
      },
    });

    let gatewayResult;
    try {
      gatewayResult = await createChaopaoPayIn({
        trxId,
        amount: parsed.data.amount,
        method,
        customerName: user.username || user.email || user.phone || 'Player',
        callbackUrl,
        returnUrl,
        customerEmail: user.email ?? null,
        customerPhone: user.phone ?? null,
      });
    } catch (err) {
      // Mark the deposit row with the gateway error so the admin can
      // see what happened. Leave it pending so the player can retry
      // or the admin can reject / manually approve.
      const msg = err instanceof Error ? err.message : String(err);
      await db.deposit.update({
        where: { id: deposit.id },
        data: {
          adminNote: `ChaopaoPay create-deposit failed: ${msg.slice(0, 400)}`,
        },
      });
      console.error('[chaopaopay] create-deposit gateway error', err);
      const code = msg.startsWith('CHAOPAOPAY_') ? msg.split(':')[0] : 'GATEWAY_ERROR';
      return jsonError(502, code, 'Payment gateway did not return a payment URL. The deposit is held; try again or use manual deposit.');
    }

    // Store ChaopaoPay's transaction_id on providerRef so the webhook
    // service layer matches by (providerKey='chaopaopay', providerRef=<their tx>).
    await db.deposit.update({
      where: { id: deposit.id },
      data: {
        providerRef: gatewayResult.transactionId,
        adminNote: `ChaopaoPay payment URL issued. Provider tx: ${gatewayResult.transactionId}. Expires: ${gatewayResult.expiresAt ?? 'unknown'}.`,
      },
    });

    await recordActivity({
      actorId: session.sub,
      actorRole: session.role,
      action: 'DEPOSIT_CHAOPAOPAY_INIT',
      target: deposit.id,
      meta: {
        amount: parsed.data.amount,
        method,
        trxId,
        providerTxId: gatewayResult.transactionId,
        promisedBonusAmount: preview.bonusAmount,
        promotionRuleId: resolvedPromotionRule?.id ?? null,
      },
    });

    return jsonOk(
      {
        depositId: deposit.id,
        trxId,
        providerTxId: gatewayResult.transactionId,
        amount: parsed.data.amount,
        method,
        currency: 'BDT',
        paymentUrl: gatewayResult.paymentUrl,
        expiresAt: gatewayResult.expiresAt,
        bonusAmount: preview.bonusAmount,
        totalCredit: preview.totalCredit,
      },
      201,
    );
  });
}
