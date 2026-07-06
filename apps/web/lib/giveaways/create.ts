// Built by Anointed Coder.
//
// Telegram group giveaway flow. A giveaway is nothing more than a
// multi-use PromoCode (created through the SAME rules the admin promo
// form uses, via lib/promo-codes/create) plus a best-effort broadcast of
// the code to the operator's configured Telegram group. Players redeem it
// on the promotions page through the unchanged redeem path, so no new
// money logic lives here - this file never touches a wallet.
//
// Money-safety: the Telegram broadcast is strictly best-effort. It runs
// AFTER the PromoCode row is committed, is wrapped so it can never throw,
// and its outcome is reported as { ok } / { skipped } - a failed or
// disabled Telegram channel never fails the giveaway creation.

import {
  createPromoCode,
  generateUniquePromoCode,
  serializePromoCode,
  type PromoRewardType,
} from '@/lib/promo-codes/create';
import {
  sendTelegramAlert,
  escapeTelegramHtml,
  publicSiteBaseUrl,
  type TelegramSendResult,
} from '@/lib/telegram/notify';

export interface CreateGiveawayInput {
  // Optional explicit code; a random unambiguous code is generated when omitted.
  code?: string | null;
  rewardType: PromoRewardType;
  amount: number;
  turnoverX?: number;
  maxRedemptions: number;
  perUserLimit?: number;
  endsAt?: string | Date | null;
  // Required when rewardType is bonus_grant (mirrors the promo rule).
  bonusRuleId?: string | null;
  broadcast: boolean;
  // Actor is recorded by the API route; kept here so callers pass a full context.
  actorId: string;
}

export type CreateGiveawayResult =
  | {
      ok: true;
      promoCode: ReturnType<typeof serializePromoCode>;
      broadcast: TelegramSendResult;
    }
  | { ok: false; httpStatus: number; code: string; message: string };

function rewardTypeLabel(rewardType: PromoRewardType): { en: string; bn: string } {
  switch (rewardType) {
    case 'main_balance':
      return { en: 'cash bonus', bn: 'ক্যাশ বোনাস' };
    case 'bonus_grant':
    case 'bonus_balance':
      return { en: 'bonus', bn: 'বোনাস' };
    case 'locked_balance':
      return { en: 'locked bonus', bn: 'লকড বোনাস' };
    default:
      return { en: 'reward', bn: 'পুরস্কার' };
  }
}

// Friendly, player-facing bilingual message for the Telegram group. Every
// dynamic value is HTML-escaped for Telegram HTML parse mode.
function buildGiveawayMessage(input: {
  code: string;
  amount: number;
  rewardType: PromoRewardType;
  maxRedemptions: number;
}): string {
  const label = rewardTypeLabel(input.rewardType);
  const amount = escapeTelegramHtml(input.amount.toLocaleString());
  const code = escapeTelegramHtml(input.code);
  const promoUrl = `${publicSiteBaseUrl()}/promotions`;
  const lines = [
    '🎁 <b>ফ্রি গিফট কোড / Free Gift Code</b>',
    `পুরস্কার / Reward: <b>${amount} BDT ${escapeTelegramHtml(label.bn)} / ${escapeTelegramHtml(label.en)}</b>`,
    `কোড / Code: <b>${code}</b>`,
    '',
    `এখনই রিডিম করুন প্রোমোশন পেজে / Redeem it now on the Promotions page:`,
    promoUrl,
    '',
    `⚡ সীমিত সংখ্যক / Limited to the first ${escapeTelegramHtml(input.maxRedemptions.toLocaleString())} players.`,
  ];
  return lines.join('\n');
}

// Creates the giveaway PromoCode and, when requested, broadcasts the code
// to the configured Telegram group. Returns a typed result; the broadcast
// outcome is always reported and never fatal.
export async function createGiveaway(input: CreateGiveawayInput): Promise<CreateGiveawayResult> {
  const code = input.code && input.code.trim() ? input.code.trim().toUpperCase() : await generateUniquePromoCode('PASHA');

  const result = await createPromoCode({
    code,
    // Giveaways carry no bespoke copy; a clear default title keeps the
    // admin promo list and the player promotions page readable.
    titleEn: 'Telegram Giveaway',
    titleBn: 'টেলিগ্রাম গিভওয়ে',
    descriptionEn: 'Limited-time gift code shared in our Telegram group.',
    descriptionBn: 'আমাদের টেলিগ্রাম গ্রুপে শেয়ার করা সীমিত সময়ের গিফট কোড।',
    rewardType: input.rewardType,
    rewardAmount: input.amount,
    turnoverX: input.turnoverX ?? 0,
    maxRedemptions: input.maxRedemptions,
    perUserLimit: input.perUserLimit ?? 1,
    minDepositTotal: 0,
    startsAt: null,
    endsAt: input.endsAt ?? null,
    isActive: true,
    bonusRuleId: input.bonusRuleId ?? null,
  });

  if (!result.ok) return result;

  const promoCode = result.promoCode;

  // Broadcast is best-effort and post-commit. sendTelegramAlert already
  // catches everything and never throws, but we guard again so a giveaway
  // is always reported as created even on an unexpected fault.
  let broadcast: TelegramSendResult = { ok: false, skipped: true, error: 'Broadcast not requested.' };
  if (input.broadcast) {
    try {
      const text = buildGiveawayMessage({
        code: promoCode.code,
        amount: Number(promoCode.rewardAmount),
        rewardType: input.rewardType,
        maxRedemptions: promoCode.maxRedemptions,
      });
      broadcast = await sendTelegramAlert(text);
    } catch (err) {
      broadcast = { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  return { ok: true, promoCode: serializePromoCode(promoCode), broadcast };
}
