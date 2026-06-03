// Built by Anointed Coder.
//
// M4 Phase D promotion claim service. POST /api/promotions/[id]/claim
// delegates here. Each BonusType gets its own typed flow:
//
//   first_deposit . NOT_MANUAL. The deposit-approval engine grants
//                   this automatically. Returns AUTO_FIRST_DEPOSIT
//                   so the public UI explains the bonus credits on
//                   the first qualifying deposit.
//   daily         . one grant per UTC day. dayBucket = 'YYYY-MM-DD'.
//   weekly        . one grant per ISO week. dayBucket = 'YYYY-Www'.
//   vip           . NOT_CONFIGURED. No VIP tier system exists yet.
//   cashback      . NOT_CONFIGURED. No loss tracking yet.
//   referral      . NOT_MANUAL. Affiliate engine handles accrual.
//                   Players claim via /api/referral/claim (future).
//   reload / promo. supported on the daily cadence (one per day).
//   invite / manual. NOT_MANUAL; admin-only.
//
// Idempotency: PromotionClaim has a unique @@unique([userId, ruleId,
// dayBucket]) so a duplicate claim collides at the database layer.
// We catch the collision and return ALREADY_CLAIMED with the
// previously-issued bonus grant id so the UI can link to it.
//
// Granting always runs through grantBonusInTx so the wallet ledger,
// turnover gate and locked balance behave identically to deposit
// bonuses.

import { Prisma } from '@prisma/client';
import { db } from '@/lib/db/client';
import { grantBonusInTx } from '@/lib/bonuses/engine';

export type ClaimResult =
  | { ok: true; status: 'granted'; bonusGrantId: string; amount: number; claimId: string; ruleName: string }
  | { ok: false; httpStatus: number; code: ClaimErrorCode; message: string; meta?: Record<string, unknown> };

export type ClaimErrorCode =
  | 'NOT_FOUND'
  | 'INACTIVE'
  | 'OUT_OF_WINDOW'
  | 'ALREADY_CLAIMED'
  | 'AUTO_FIRST_DEPOSIT'
  | 'AUTO_REFERRAL'
  | 'NOT_MANUAL'
  | 'VIP_NOT_CONFIGURED'
  | 'CASHBACK_NOT_CONFIGURED'
  | 'NOT_ELIGIBLE'
  | 'WALLET_NOT_FOUND'
  | 'INTERNAL';

function dayBucketFor(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** ISO-8601 week bucket like '2026-W22'. */
export function weeklyBucket(d: Date): string {
  // Move to nearest Thursday: current date + 4 - current day number
  // Make Sunday's day number 7 (per ISO 8601).
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNum = date.getUTCDay() === 0 ? 7 : date.getUTCDay();
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNum = Math.ceil(((date.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}

function bucketForType(type: string, now: Date): string {
  if (type === 'daily' || type === 'reload' || type === 'promo') return dayBucketFor(now);
  if (type === 'weekly') return weeklyBucket(now);
  if (type === 'first_deposit') return 'first_deposit';
  return dayBucketFor(now);
}

function flatPayout(rule: { amount: Prisma.Decimal; percentage: Prisma.Decimal; maxBonus: Prisma.Decimal }): Prisma.Decimal {
  const flat = new Prisma.Decimal(rule.amount);
  const pct = new Prisma.Decimal(rule.percentage);
  // For manual-claim bonuses (daily / weekly) we only honour the flat
  // amount. Percentage only makes sense against a deposit base which
  // the operator should configure via deposit-tier rules instead.
  let payout = flat;
  // If only a percentage was provided, treat 1% of maxBonus as the
  // flat payout so the operator can still configure these as
  // "1% of 1000 = 10 BDT" without a deposit.
  if (payout.lte(0) && pct.gt(0)) {
    const cap = new Prisma.Decimal(rule.maxBonus);
    if (cap.gt(0)) payout = cap.mul(pct).div(100);
  }
  const cap = new Prisma.Decimal(rule.maxBonus);
  if (cap.gt(0) && payout.gt(cap)) payout = cap;
  return payout;
}

export async function runPromotionClaim(input: { ruleId: string; userId: string }): Promise<ClaimResult> {
  const { ruleId, userId } = input;
  const now = new Date();

  const rule = await db.bonusRule.findUnique({ where: { id: ruleId } });
  if (!rule) return { ok: false, httpStatus: 404, code: 'NOT_FOUND', message: 'Promotion not found.' };
  if (rule.status !== 'active') return { ok: false, httpStatus: 409, code: 'INACTIVE', message: 'Promotion is not active right now.' };
  if (rule.startsAt && rule.startsAt > now) return { ok: false, httpStatus: 409, code: 'OUT_OF_WINDOW', message: 'Promotion has not started.' };
  if (rule.endsAt && rule.endsAt < now) return { ok: false, httpStatus: 409, code: 'OUT_OF_WINDOW', message: 'Promotion has ended.' };

  // Type-routed gating. BonusType in this schema covers:
  //   first_deposit | daily | weekly | referral | vip | invite | reload | manual | promo
  // There is no 'cashback' member; admin cannot create one via
  // /api/admin/bonus-rules (validation rejects it). So a cashback
  // rule cannot reach this code path. The public endpoint surfaces
  // CASHBACK_NOT_CONFIGURED as a static disabledReason if the enum
  // gains the member in a future migration.
  switch (rule.type) {
    case 'first_deposit':
      return { ok: false, httpStatus: 409, code: 'AUTO_FIRST_DEPOSIT', message: 'First-deposit bonus credits automatically after your first qualifying deposit. No manual claim is needed.' };
    case 'referral':
      return { ok: false, httpStatus: 409, code: 'AUTO_REFERRAL', message: 'Referral commission accrues automatically from your invited players. View your referral wallet for claim controls.' };
    case 'vip':
      return { ok: false, httpStatus: 409, code: 'VIP_NOT_CONFIGURED', message: 'VIP tiering is not configured yet. Once VIP levels are live this promotion will become claimable.' };
    case 'invite':
    case 'manual':
      return { ok: false, httpStatus: 409, code: 'NOT_MANUAL', message: 'This promotion is granted by an admin and cannot be self-claimed.' };
    case 'daily':
    case 'weekly':
    case 'reload':
    case 'promo':
      break;
    default:
      return { ok: false, httpStatus: 409, code: 'NOT_ELIGIBLE', message: 'Promotion type does not support a manual claim.' };
  }

  const bucket = bucketForType(rule.type, now);

  // Check wallet exists - bonus engine creates the ledger row and
  // credit will fail if no wallet exists yet.
  const wallet = await db.wallet.findUnique({ where: { userId } });
  if (!wallet) return { ok: false, httpStatus: 409, code: 'WALLET_NOT_FOUND', message: 'Wallet not found. Make a deposit first.' };

  const payout = flatPayout(rule);
  if (payout.lte(0)) {
    return { ok: false, httpStatus: 409, code: 'NOT_ELIGIBLE', message: 'Promotion has no payout configured.' };
  }

  // Race-safe: we let the @@unique([userId, ruleId, dayBucket]) on
  // PromotionClaim block duplicates. Inside the transaction we (a)
  // try to create the claim row, (b) on success run grantBonusInTx,
  // (c) update the claim row with bonusGrantId. On unique-constraint
  // failure we read the existing claim row to surface ALREADY_CLAIMED.
  try {
    const result = await db.$transaction(async (tx) => {
      const claim = await tx.promotionClaim.create({
        data: {
          userId,
          ruleId,
          dayBucket: bucket,
          status: 'granted',
        },
      });
      const grant = await grantBonusInTx(tx, {
        userId,
        rule,
        amount: payout,
        sourceType: 'promotion_claim',
        sourceId: claim.id,
        note: `Promotion claim ${rule.name}`,
      });
      if (!grant) {
        // Should not happen because we guarded payout.lte(0) above.
        throw new Error('grantBonusInTx returned null');
      }
      await tx.promotionClaim.update({
        where: { id: claim.id },
        data: { bonusGrantId: grant.grantId },
      });
      return { claimId: claim.id, grantId: grant.grantId, amount: Number(grant.amount) };
    });
    return {
      ok: true,
      status: 'granted',
      bonusGrantId: result.grantId,
      amount: result.amount,
      claimId: result.claimId,
      ruleName: rule.name,
    };
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      const prior = await db.promotionClaim.findUnique({
        where: { userId_ruleId_dayBucket: { userId, ruleId, dayBucket: bucket } },
      });
      return {
        ok: false,
        httpStatus: 409,
        code: 'ALREADY_CLAIMED',
        message: rule.type === 'weekly' ? 'You have already claimed this promotion this week.' : 'You have already claimed this promotion today.',
        meta: { previousClaimId: prior?.id ?? null, previousGrantId: prior?.bonusGrantId ?? null },
      };
    }
    console.error('[promotions/claim] grant failed', err);
    return { ok: false, httpStatus: 500, code: 'INTERNAL', message: 'Claim could not be processed.' };
  }
}
