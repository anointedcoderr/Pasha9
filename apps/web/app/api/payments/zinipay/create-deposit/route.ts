// Built by Anointed Coder.
//
// Player-facing endpoint that starts a ZinIPay deposit. ZinIPay is a
// hosted-payment-page gateway: the player chooses bKash/Nagad/Rocket
// on ZinIPay's screen, so we just need to create the invoice and
// redirect.
//
// Flow:
//   1. Validate amount, resolve any promotion / tier bonus exactly the
//      same way the manual + ChaopaoPay flows do
//   2. Create a Deposit row with status='pending', providerKey='zinipay'
//   3. Call POST /v1/payment/create on ZinIPay with metadata pointing
//      back at the deposit row so the verify call can find it
//   4. Store the ZinIPay invoice URL fragment on Deposit.providerRef
//      (so the webhook can match by providerKey + providerRef)
//   5. Return { depositId, paymentUrl } - the client redirects there
//
// On webhook completion, /api/payments/webhook/zinipay calls
// /v1/payment/verify with the invoice_id and credits the deposit when
// the gateway returns status='COMPLETED'.

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
import { zinipayCreate } from '@/lib/payments/zinipay-client';

const schema = z.object({
  amount: z.coerce.number().min(100).max(500_000),
  promotionId: z.string().trim().min(1).max(60).optional().nullable(),
  promoCode: z.string().trim().min(1).max(60).optional().nullable(),
});

function originFromRequest(req: NextRequest): string {
  const cfg = process.env.PUBLIC_BASE_URL?.trim();
  if (cfg) return cfg.replace(/\/+$/, '');
  const proto = req.headers.get('x-forwarded-proto') ?? 'https';
  const host = req.headers.get('host') ?? '';
  return host ? `${proto}://${host}` : '';
}

// Extracts the invoice id from a ZinIPay payment_url. The hosted page
// URL looks like https://secure.zinipay.com/payment/INVOICE_ID - we
// strip everything before the last slash so the webhook handler can
// match by Deposit.providerRef = invoice_id.
function extractInvoiceId(paymentUrl: string): string | null {
  try {
    const u = new URL(paymentUrl);
    const parts = u.pathname.split('/').filter(Boolean);
    return parts[parts.length - 1] ?? null;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  return withAuth(async () => {
    const session = await requireActiveUser();

    const limit = rateLimit(`deposit-zinipay:${session.sub}`, 8, 60_000);
    if (!limit.ok) return jsonError(429, 'RATE_LIMITED');

    const body = await req.json().catch(() => ({}));
    const parsed = schema.safeParse(body);
    if (!parsed.success) return jsonError(400, 'VALIDATION', undefined, { issues: parsed.error.issues });

    // Same bonus/promo resolution as the other deposit paths so a
    // ZinIPay deposit gets the same promised bonus.
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

    const user = await db.user.findUniqueOrThrow({
      where: { id: session.sub },
      select: { username: true, email: true },
    });

    const origin = originFromRequest(req);
    const webhookUrl = `${origin}/api/payments/webhook/zinipay`;
    const redirectUrl = `${origin}/deposit/result?provider=zinipay`;
    const cancelUrl = `${origin}/deposit?cancelled=zinipay`;

    const deposit = await db.deposit.create({
      data: {
        userId: session.sub,
        amount: parsed.data.amount,
        method: 'zinipay',
        transactionId: `ZNP-PENDING-${Date.now()}`,
        providerKey: 'zinipay',
        status: 'pending',
        bonusPercentage: preview.bonusPercentage > 0 ? new Prisma.Decimal(preview.bonusPercentage) : null,
        bonusAmount: preview.bonusAmount > 0 ? new Prisma.Decimal(preview.bonusAmount) : null,
        promotionRuleId: resolvedPromotionRule?.id ?? null,
        promotionCode: resolvedPromotionRule?.code ?? parsed.data.promoCode ?? null,
      },
    });

    const result = await zinipayCreate({
      amount: parsed.data.amount,
      redirectUrl,
      cancelUrl,
      webhookUrl,
      customerName: user.username,
      customerEmail: user.email ?? undefined,
      metadata: { depositId: deposit.id, userId: session.sub },
    });

    if (!result.ok) {
      await db.deposit.update({
        where: { id: deposit.id },
        data: { adminNote: `ZinIPay create-payment failed: ${result.error.slice(0, 400)}` },
      });
      console.error('[zinipay] create-deposit gateway error', result.error, result.raw);
      return jsonError(502, result.error, 'ZinIPay did not return a payment URL. Try again or use a different method.');
    }

    const invoiceId = extractInvoiceId(result.paymentUrl);
    if (invoiceId) {
      // providerRef = invoice id so the webhook handler can match the
      // gateway's invoice_id back to this Deposit row in O(1).
      await db.deposit.update({
        where: { id: deposit.id },
        data: {
          providerRef: invoiceId,
          transactionId: invoiceId,
          adminNote: `ZinIPay invoice ${invoiceId} issued.`,
        },
      });
    }

    await recordActivity({
      actorId: session.sub,
      actorRole: session.role,
      action: 'DEPOSIT_ZINIPAY_INIT',
      target: deposit.id,
      meta: {
        amount: parsed.data.amount,
        invoiceId: invoiceId ?? null,
        promisedBonusAmount: preview.bonusAmount,
      },
    });

    return jsonOk(
      {
        depositId: deposit.id,
        invoiceId,
        amount: parsed.data.amount,
        currency: 'BDT',
        paymentUrl: result.paymentUrl,
        bonusAmount: preview.bonusAmount,
        totalCredit: preview.totalCredit,
      },
      201,
    );
  });
}
