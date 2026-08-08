// Built by Anointed Coder.
//
// Promo code redemption service. Wraps the wallet credit and
// PromoCodeRedemption insert in a single Prisma transaction so a
// failure on either side cannot leave the player half-credited. The
// service is also idempotent via PromoCodeRedemption.idempotencyKey
// (unique) so a frantic double-click can never double-credit.

import { Prisma } from '@prisma/client';
import { db } from '@/lib/db/client';
import { grantBonusInTx } from '@/lib/bonuses/engine';
import { applyWalletMovement, LEDGER_TYPE } from '@/lib/wallet/ledger';
import type { PromoCode } from '@prisma/client';

export type RedeemResult =
  | { ok: true; code: 'GRANTED'; amount: number; rewardType: string; turnoverX: number; redemptionId: string; bonusGrantId: string | null }
  | { ok: false; httpStatus: number; code: RedeemErrorCode; message: string };

export type RedeemErrorCode =
  | 'NOT_FOUND'
  | 'INACTIVE'
  | 'OUT_OF_WINDOW'
  | 'ALREADY_REDEEMED'
  | 'PER_USER_LIMIT'
  | 'MAX_REDEMPTIONS_REACHED'
  | 'MIN_DEPOSIT_NOT_MET'
  | 'WALLET_NOT_FOUND'
  | 'CONFIG_ERROR'
  | 'BONUS_RULE_MISSING'
  | 'INTERNAL';

const VALID_REWARDS = new Set(['bonus_grant', 'main_balance', 'bonus_balance', 'locked_balance']);

export async function redeemPromoCode(input: {
  rawCode: string;
  userId: string;
}): Promise<RedeemResult> {
  const code = input.rawCode.trim().toUpperCase();
  if (!code) {
    return { ok: false, httpStatus: 400, code: 'NOT_FOUND', message: 'Enter a promo code.' };
  }

  const now = new Date();
  const promo = await db.promoCode.findFirst({
    where: { code },
    include: { _count: { select: { redemptions: true } } },
  });
  if (!promo) {
    return { ok: false, httpStatus: 404, code: 'NOT_FOUND', message: 'Promo code not found.' };
  }
  if (!promo.isActive) {
    return { ok: false, httpStatus: 409, code: 'INACTIVE', message: 'Promo code is not active.' };
  }
  if (promo.startsAt && promo.startsAt > now) {
    return { ok: false, httpStatus: 409, code: 'OUT_OF_WINDOW', message: 'Promo code has not started yet.' };
  }
  if (promo.endsAt && promo.endsAt < now) {
    return { ok: false, httpStatus: 409, code: 'OUT_OF_WINDOW', message: 'Promo code has expired.' };
  }
  if (promo.maxRedemptions > 0 && promo._count.redemptions >= promo.maxRedemptions) {
    return { ok: false, httpStatus: 409, code: 'MAX_REDEMPTIONS_REACHED', message: 'Promo code redemption limit reached.' };
  }

  const reward = promo.rewardType;
  if (!VALID_REWARDS.has(reward)) {
    return { ok: false, httpStatus: 409, code: 'CONFIG_ERROR', message: 'Promo code reward is misconfigured.' };
  }
  const amount = new Prisma.Decimal(promo.rewardAmount ?? 0);
  if (amount.lte(0)) {
    return { ok: false, httpStatus: 409, code: 'CONFIG_ERROR', message: 'Promo code payout is not configured.' };
  }

  // Per-user redemption cap.
  const priorCount = await db.promoCodeRedemption.count({
    where: { promoCodeId: promo.id, userId: input.userId, status: 'granted' },
  });
  if (promo.perUserLimit > 0 && priorCount >= promo.perUserLimit) {
    return { ok: false, httpStatus: 409, code: 'ALREADY_REDEEMED', message: 'You have already redeemed this code.' };
  }

  // Minimum approved deposit gate.
  if (Number(promo.minDepositTotal) > 0) {
    const sum = await db.deposit.aggregate({
      where: { userId: input.userId, status: 'approved' },
      _sum: { amount: true },
    });
    const total = Number(sum._sum.amount ?? 0);
    if (total < Number(promo.minDepositTotal)) {
      return {
        ok: false,
        httpStatus: 409,
        code: 'MIN_DEPOSIT_NOT_MET',
        message: `Make an approved deposit of ${Number(promo.minDepositTotal).toLocaleString()} BDT or more before redeeming.`,
      };
    }
  }

  const wallet = await db.wallet.findUnique({ where: { userId: input.userId } });
  if (!wallet) {
    return { ok: false, httpStatus: 409, code: 'WALLET_NOT_FOUND', message: 'Wallet not found. Contact support.' };
  }

  let bonusRule: Awaited<ReturnType<typeof db.bonusRule.findUnique>> | null = null;
  if (reward === 'bonus_grant') {
    if (!promo.bonusRuleId) {
      return {
        ok: false,
        httpStatus: 409,
        code: 'BONUS_RULE_MISSING',
        message: 'Promo code is misconfigured. Please contact support.',
      };
    }
    bonusRule = await db.bonusRule.findUnique({ where: { id: promo.bonusRuleId } });
    if (!bonusRule) {
      return { ok: false, httpStatus: 409, code: 'BONUS_RULE_MISSING', message: 'Promo code is misconfigured.' };
    }
  }

  // Idempotency key spans (code, userId, redemption sequence) so a
  // multi-use code can collect multiple redemptions per user but a
  // single click cannot double-spend the wallet.
  const idempotencyKey = `${promo.id}:${input.userId}:${priorCount}`;

  try {
    const result = await db.$transaction(async (tx) => {
      const redemption = await tx.promoCodeRedemption.create({
        data: {
          promoCodeId: promo.id,
          userId: input.userId,
          amount,
          rewardType: reward,
          idempotencyKey,
          status: 'granted',
        },
      });

      let bonusGrantId: string | null = null;
      let walletTxId: string | null = null;

      if (reward === 'bonus_grant' && bonusRule) {
        const grant = await grantBonusInTx(tx, {
          userId: input.userId,
          rule: bonusRule,
          amount,
          sourceType: 'promo_code',
          sourceId: redemption.id,
          note: `Promo code ${promo.code}`,
          // The promo's own turnoverX is authoritative, not the
          // attached rule's. Without this override a promo advertising
          // 10x turnover but pointing at a 0x rule would grant a
          // freely-withdrawable bonus.
          turnoverRequiredOverride: amount.mul(new Prisma.Decimal(promo.turnoverX)),
        });
        if (!grant) throw new Error('PROMO_GRANT_EMPTY');
        bonusGrantId = grant.grantId;
      } else {
        // Direct wallet credit paths. Build a Transaction row so the
        // audit ledger has a single source of truth.
        const walletTx = await tx.transaction.create({
          data: {
            userId: input.userId,
            type: reward === 'main_balance' ? 'adjust' : 'bonus',
            status: 'completed',
            amount,
            reference: redemption.id,
            description: `Promo code ${promo.code}`,
            meta: {
              promoCodeId: promo.id,
              promoCode: promo.code,
              rewardType: reward,
              redemptionId: redemption.id,
            } as Prisma.JsonObject,
          },
        });
        walletTxId = walletTx.id;

        // Which pocket the reward lands in depends on the reward type: only
        // main_balance is spendable, the other two are held. Routing the
        // amount to the matching field keeps that distinction visible in the
        // ledger instead of every promo looking like a cash credit.
        await applyWalletMovement({
          tx,
          userId: input.userId,
          amount: reward === 'main_balance' ? amount : 0,
          bonusDelta: reward === 'bonus_balance' ? amount : 0,
          lockedDelta: reward === 'locked_balance' ? amount : 0,
          type: LEDGER_TYPE.promoCode,
          description: `Promo code ${promo.code}`,
          transactionId: walletTx.id,
          referenceId: redemption.id,
          bonusSource: 'promo_code',
          meta: {
            promoCodeId: promo.id,
            promoCode: promo.code,
            rewardType: reward,
            redemptionId: redemption.id,
          } as Prisma.JsonObject,
        });

        // main_balance credits land in Wallet.balance directly. When the
        // promo carries a turnover requirement, attach an active
        // UserBonus row so the withdrawal gate locks exactly the credited
        // amount until turnover is met. sourceType 'promo_code' is a
        // direct-balance source, so release on turnover completion is a
        // no-op: the money is already in balance and must not be credited
        // a second time. The bonus_balance / locked_balance paths keep
        // their existing direct credit and do NOT attach a lock, since
        // their funds are not in Wallet.balance.
        if (reward === 'main_balance' && Number(promo.turnoverX) > 0) {
          const lock = await tx.userBonus.create({
            data: {
              userId: input.userId,
              bonusRuleId: null,
              amount,
              status: 'active',
              turnoverRequired: amount.mul(new Prisma.Decimal(promo.turnoverX)),
              turnoverProgress: 0,
              sourceType: 'promo_code',
              sourceId: redemption.id,
              note: `Promo code ${promo.code}`,
            },
          });
          bonusGrantId = lock.id;
        }
      }

      await tx.promoCodeRedemption.update({
        where: { id: redemption.id },
        data: { bonusGrantId, walletTxId },
      });

      await tx.activityLog.create({
        data: {
          actorId: input.userId,
          actorRole: 'player',
          action: 'PROMO_CODE_REDEEM',
          target: promo.id,
          detail: promo.code,
          meta: {
            redemptionId: redemption.id,
            amount: Number(amount),
            rewardType: reward,
            turnoverX: Number(promo.turnoverX),
            bonusGrantId,
            walletTxId,
          } as Prisma.JsonObject,
        },
      });

      return { redemptionId: redemption.id, bonusGrantId };
    });

    return {
      ok: true,
      code: 'GRANTED',
      amount: Number(amount),
      rewardType: reward,
      turnoverX: Number(promo.turnoverX),
      redemptionId: result.redemptionId,
      bonusGrantId: result.bonusGrantId,
    };
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      return { ok: false, httpStatus: 409, code: 'ALREADY_REDEEMED', message: 'You have already redeemed this code.' };
    }
    console.error('[promo-codes/redeem] failed', err);
    return { ok: false, httpStatus: 500, code: 'INTERNAL', message: 'Redemption could not be completed. Please try again.' };
  }
}


export function promoCodeSummary(promo: PromoCode): string {
  const parts: string[] = [];
  parts.push(`${promo.rewardType.replace('_', ' ')} ${Number(promo.rewardAmount).toLocaleString()} BDT`);
  if (Number(promo.turnoverX) > 0) parts.push(`${promo.turnoverX}x turnover`);
  if (promo.perUserLimit > 0) parts.push(`${promo.perUserLimit} per user`);
  return parts.join(' . ');
}
