// Built by Anointed Coder.
//
// Single source of truth for creating a PromoCode. Both the admin
// promo-codes POST route and the Telegram giveaway flow call
// createPromoCode so the validation rules (unique code, bonus_grant
// requires a real Bonus Rule) and the exact stored field shape can
// never drift apart. Keeping this in one place means a giveaway can
// never sneak past a rule the admin form enforces.

import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { customAlphabet } from 'nanoid';
import { db } from '@/lib/db/client';
import type { PromoCode } from '@prisma/client';

export const PROMO_REWARD_TYPES = [
  'bonus_grant',
  'main_balance',
  'bonus_balance',
  'locked_balance',
] as const;

export type PromoRewardType = (typeof PROMO_REWARD_TYPES)[number];

// Shared zod schema for the admin promo-codes POST body. Exported so the
// route parses the wire payload with the exact same rules the helper
// assumes downstream.
export const promoCreateSchema = z.object({
  code: z
    .string()
    .trim()
    .min(2)
    .max(40)
    .regex(/^[A-Z0-9_-]+$/i, 'Code may only contain letters, digits, dashes and underscores.'),
  titleEn: z.string().trim().min(1).max(120),
  titleBn: z.string().trim().max(120).optional().nullable(),
  descriptionEn: z.string().trim().max(2000).optional().nullable(),
  descriptionBn: z.string().trim().max(2000).optional().nullable(),
  rewardType: z.enum(PROMO_REWARD_TYPES),
  rewardAmount: z.coerce.number().min(0).max(10_000_000),
  turnoverX: z.coerce.number().min(0).max(100).default(0),
  maxRedemptions: z.coerce.number().int().min(0).max(1_000_000).default(0),
  perUserLimit: z.coerce.number().int().min(0).max(1000).default(1),
  minDepositTotal: z.coerce.number().min(0).max(10_000_000).default(0),
  startsAt: z.string().datetime().optional().nullable(),
  endsAt: z.string().datetime().optional().nullable(),
  isActive: z.boolean().optional().default(true),
  bonusRuleId: z.string().trim().min(1).max(60).optional().nullable(),
});

// Canonical creation input. Numbers are plain (converted to Decimal
// here) and dates may be ISO strings or Date objects.
export interface CreatePromoCodeInput {
  code: string;
  titleEn: string;
  titleBn?: string | null;
  descriptionEn?: string | null;
  descriptionBn?: string | null;
  rewardType: PromoRewardType;
  rewardAmount: number;
  turnoverX?: number;
  maxRedemptions?: number;
  perUserLimit?: number;
  minDepositTotal?: number;
  startsAt?: string | Date | null;
  endsAt?: string | Date | null;
  isActive?: boolean;
  bonusRuleId?: string | null;
}

export type CreatePromoCodeResult =
  | { ok: true; promoCode: PromoCode }
  | { ok: false; httpStatus: number; code: string; message: string };

function toDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  return value instanceof Date ? value : new Date(value);
}

// Unambiguous, URL-safe alphabet (same set the referral codes use) so a
// broadcast code is easy to read aloud and copy without O/0 or I/1 mixups.
const codeAlphabet = '23456789ABCDEFGHJKMNPQRSTVWXYZ';
const generateCode = customAlphabet(codeAlphabet, 8);

// Allocates a PromoCode string that is not already taken. Used when a
// giveaway is created without an explicit code.
export async function generateUniquePromoCode(prefix = '', maxAttempts = 8): Promise<string> {
  const clean = prefix.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '');
  for (let i = 0; i < maxAttempts; i++) {
    const candidate = `${clean}${generateCode()}`;
    const exists = await db.promoCode.findUnique({ where: { code: candidate }, select: { id: true } });
    if (!exists) return candidate;
  }
  throw new Error('Could not allocate a unique promo code after several attempts.');
}

// Creates the PromoCode row after enforcing the shared rules. Returns a
// typed result rather than throwing so both HTTP callers can map the
// failure to a clean status without a try/catch dance.
export async function createPromoCode(input: CreatePromoCodeInput): Promise<CreatePromoCodeResult> {
  const code = input.code.trim().toUpperCase();

  const existing = await db.promoCode.findUnique({ where: { code } });
  if (existing) {
    return { ok: false, httpStatus: 409, code: 'CODE_TAKEN', message: `Promo code "${code}" already exists.` };
  }

  if (input.rewardType === 'bonus_grant') {
    if (!input.bonusRuleId) {
      return { ok: false, httpStatus: 400, code: 'VALIDATION', message: 'bonus_grant rewards require a Bonus Rule selection.' };
    }
    const rule = await db.bonusRule.findUnique({ where: { id: input.bonusRuleId } });
    if (!rule) {
      return { ok: false, httpStatus: 400, code: 'VALIDATION', message: 'Selected Bonus Rule was not found.' };
    }
  }

  const created = await db.promoCode.create({
    data: {
      code,
      titleEn: input.titleEn,
      titleBn: input.titleBn ?? null,
      descriptionEn: input.descriptionEn ?? null,
      descriptionBn: input.descriptionBn ?? null,
      rewardType: input.rewardType,
      rewardAmount: new Prisma.Decimal(input.rewardAmount),
      turnoverX: new Prisma.Decimal(input.turnoverX ?? 0),
      maxRedemptions: input.maxRedemptions ?? 0,
      perUserLimit: input.perUserLimit ?? 1,
      minDepositTotal: new Prisma.Decimal(input.minDepositTotal ?? 0),
      startsAt: toDate(input.startsAt),
      endsAt: toDate(input.endsAt),
      isActive: input.isActive ?? true,
      bonusRuleId: input.rewardType === 'bonus_grant' ? input.bonusRuleId ?? null : null,
    },
  });

  return { ok: true, promoCode: created };
}

// Plain-JSON view of a PromoCode with Decimal columns coerced to numbers.
export function serializePromoCode(r: PromoCode & { _count?: { redemptions: number } }) {
  return {
    id: r.id,
    code: r.code,
    titleEn: r.titleEn,
    titleBn: r.titleBn,
    descriptionEn: r.descriptionEn,
    descriptionBn: r.descriptionBn,
    rewardType: r.rewardType,
    rewardAmount: Number(r.rewardAmount),
    turnoverX: Number(r.turnoverX),
    maxRedemptions: r.maxRedemptions,
    perUserLimit: r.perUserLimit,
    minDepositTotal: Number(r.minDepositTotal),
    startsAt: r.startsAt,
    endsAt: r.endsAt,
    isActive: r.isActive,
    bonusRuleId: r.bonusRuleId,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    redemptionCount: r._count?.redemptions ?? 0,
  };
}
