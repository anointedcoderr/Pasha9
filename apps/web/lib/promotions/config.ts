// Built by Anointed Coder.
//
// Promotion-specific configuration lives inside BonusRule.meta.promotion.
// This keeps existing BonusRule rows intact while allowing the admin
// promotion editor to configure claim routing and eligibility.

export type PromotionClaimBehavior = 'auto' | 'direct' | 'deposit' | 'redirect' | 'disabled';

export interface PromotionConfig {
  claimBehavior: PromotionClaimBehavior;
  depositRequired: boolean;
  requiredDepositAmount: number;
  targetUrl: string | null;
  minApprovedDepositCount: number;
  minApprovedDepositTotal: number;
}

export interface PromotionRuleShape {
  id: string;
  type: string;
  code: string | null;
  amount: unknown;
  percentage: unknown;
  minDeposit: unknown;
  maxBonus: unknown;
  meta: unknown;
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function nonNegativeNumber(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export function getPromotionConfig(meta: unknown): PromotionConfig {
  const root = objectValue(meta);
  const config = objectValue(root.promotion);
  const behavior = typeof config.claimBehavior === 'string' ? config.claimBehavior : 'auto';
  const claimBehavior: PromotionClaimBehavior =
    behavior === 'direct' || behavior === 'deposit' || behavior === 'redirect' || behavior === 'disabled'
      ? behavior
      : 'auto';

  return {
    claimBehavior,
    depositRequired: config.depositRequired === true,
    requiredDepositAmount: nonNegativeNumber(config.requiredDepositAmount),
    targetUrl: typeof config.targetUrl === 'string' && config.targetUrl.trim() ? config.targetUrl.trim() : null,
    minApprovedDepositCount: Math.floor(nonNegativeNumber(config.minApprovedDepositCount)),
    minApprovedDepositTotal: nonNegativeNumber(config.minApprovedDepositTotal),
  };
}

export function resolveClaimBehavior(rule: PromotionRuleShape): Exclude<PromotionClaimBehavior, 'auto'> {
  const config = getPromotionConfig(rule.meta);
  if (config.claimBehavior !== 'auto') return config.claimBehavior;

  switch (rule.type) {
    case 'first_deposit':
    case 'reload':
      return 'deposit';
    case 'daily':
      return config.depositRequired ? 'deposit' : 'direct';
    case 'weekly':
      return 'direct';
    case 'referral':
    case 'vip':
    case 'invite':
      return 'redirect';
    case 'manual':
    case 'promo':
    default:
      return 'disabled';
  }
}

export function promotionDepositAmount(rule: PromotionRuleShape): number {
  const config = getPromotionConfig(rule.meta);
  return Math.max(0, config.requiredDepositAmount, Number(rule.minDeposit));
}

export function promotionTargetUrl(rule: PromotionRuleShape): string | null {
  const configured = getPromotionConfig(rule.meta).targetUrl;
  if (configured && (configured.startsWith('/') || /^https?:\/\//i.test(configured))) return configured;
  if (rule.type === 'referral' || rule.type === 'invite') return '/referral';
  if (rule.type === 'vip') return '/vip';
  return null;
}

export function buildPromotionDepositUrl(rule: PromotionRuleShape): string {
  const params = new URLSearchParams({
    promotionId: rule.id,
    source: 'promotion',
  });
  const amount = promotionDepositAmount(rule);
  if (amount > 0) params.set('amount', String(amount));
  if (rule.code) params.set('promoCode', rule.code);
  return `/deposit?${params.toString()}`;
}

export function promotionConfigWarning(rule: PromotionRuleShape): string | null {
  const behavior = resolveClaimBehavior(rule);
  const amount = Number(rule.amount);
  const percentage = Number(rule.percentage);
  const maxBonus = Number(rule.maxBonus);
  const depositAmount = promotionDepositAmount(rule);

  if (behavior === 'disabled') {
    return 'Claim action is disabled. Configure an action before publishing.';
  }
  if (behavior === 'redirect' && !promotionTargetUrl(rule)) {
    return 'Redirect target is missing.';
  }
  if (behavior === 'deposit') {
    if (depositAmount <= 0) return 'Deposit amount or minimum deposit is missing.';
    if (amount <= 0 && percentage <= 0) return 'Deposit promotion payout is missing.';
  }
  if (behavior === 'direct' && amount <= 0 && !(percentage > 0 && maxBonus > 0)) {
    return 'Direct claim payout is missing. Set a flat amount or percentage with a max bonus.';
  }
  return null;
}

export function promotionActivationError(rule: PromotionRuleShape): string | null {
  return resolveClaimBehavior(rule) === 'disabled' ? null : promotionConfigWarning(rule);
}

export function mergePromotionMeta(
  current: unknown,
  config: Partial<PromotionConfig>,
): Record<string, unknown> {
  const root = objectValue(current);
  const previous = objectValue(root.promotion);
  return {
    ...root,
    promotion: {
      ...previous,
      ...config,
    },
  };
}
