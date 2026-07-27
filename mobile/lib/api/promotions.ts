// Built by Anointed Coder.
//
// Typed API functions + react-query hooks for the live Pasha9 promotions
// surface: the public promo list, the typed claim endpoint, and promo-code
// redemption. Every function is thin: shape the request, call the shared
// client, return a typed payload. The { ok } envelope unwrap and the 401
// refresh live in lib/api/client.ts.
//
// Backend contracts (read-only reference):
//   GET  /api/content/promotions
//        -> { promotions: [{ id, name, category, effective, bannerUrl,
//             thumbnailUrl, termsEn, claimAction, claimUrl, claimed,
//             disabledReason, requiredDepositAmount, depositRequired, ... }] }
//        Public read. When the caller is signed in the per-visitor claim
//        state (claimed / claimedToday / claimedThisWeek) is populated.
//   POST /api/promotions/[id]/claim
//        -> credit branch:   { action, ruleName, bonusGrantId, amount, claimId }
//        -> redirect branch: { action: 'redirect', ruleName, url }
//        Money-gated + rate-limited; throws the shared ApiError on rejection.
//   POST /api/promo-codes/redeem  { code }
//        -> { ok, amount, rewardType, turnoverX, redemptionId, bonusGrantId }

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from './client';

// ---------------------------------------------------------------------------
// Query keys + balance invalidation targets
// ---------------------------------------------------------------------------

export const promotionsQueryKey = ['promotions', 'list'] as const;

const balanceKey = ['wallet', 'balance'] as const;
const bonusesKey = ['wallet', 'bonuses'] as const;

// ---------------------------------------------------------------------------
// Promotions list
// ---------------------------------------------------------------------------

/** How the claim CTA should behave for the current visitor. */
export type PromotionClaimAction = 'credit' | 'deposit' | 'redirect' | 'disabled';

/** One live promotion surfaced to the app. */
export interface Promotion {
  id: string;
  name: string;
  nameBn: string | null;
  type: string;
  category: string;
  code: string | null;
  percentage: number;
  amount: number;
  minDeposit: number;
  maxBonus: number;
  turnoverX: number;
  validityDays: number;
  description: string | null;
  descriptionBn: string | null;
  effective: string;
  bannerUrl: string | null;
  bannerMobileUrl: string | null;
  thumbnailUrl: string | null;
  backgroundUrl: string | null;
  termsEn: string | null;
  termsBn: string | null;
  claimed: boolean | null;
  claimedToday: boolean | null;
  claimedThisWeek: boolean | null;
  disabledReason: string | null;
  claimAction: PromotionClaimAction;
  claimUrl: string | null;
  requiredDepositAmount: number;
  depositRequired: boolean;
}

interface PromotionsResponse {
  ok: true;
  promotions?: Array<Record<string, unknown>>;
}

function str(v: unknown): string | null {
  return typeof v === 'string' && v.length > 0 ? v : null;
}
function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}
function boolOrNull(v: unknown): boolean | null {
  return typeof v === 'boolean' ? v : null;
}

function normalizeClaimAction(v: unknown): PromotionClaimAction {
  return v === 'deposit' || v === 'redirect' || v === 'disabled' ? v : 'credit';
}

function mapPromotion(r: Record<string, unknown>): Promotion {
  return {
    id: String(r.id ?? ''),
    name: typeof r.name === 'string' ? r.name : String(r.id ?? ''),
    nameBn: str(r.nameBn),
    type: typeof r.type === 'string' ? r.type : 'other',
    category: typeof r.category === 'string' ? r.category : 'other',
    code: str(r.code),
    percentage: num(r.percentage),
    amount: num(r.amount),
    minDeposit: num(r.minDeposit),
    maxBonus: num(r.maxBonus),
    turnoverX: num(r.turnoverX),
    validityDays: num(r.validityDays),
    description: str(r.description),
    descriptionBn: str(r.descriptionBn),
    effective: typeof r.effective === 'string' ? r.effective : '',
    bannerUrl: str(r.bannerUrl),
    bannerMobileUrl: str(r.bannerMobileUrl),
    thumbnailUrl: str(r.thumbnailUrl),
    backgroundUrl: str(r.backgroundUrl),
    termsEn: str(r.termsEn),
    termsBn: str(r.termsBn),
    claimed: boolOrNull(r.claimed),
    claimedToday: boolOrNull(r.claimedToday),
    claimedThisWeek: boolOrNull(r.claimedThisWeek),
    disabledReason: str(r.disabledReason),
    claimAction: normalizeClaimAction(r.claimAction),
    claimUrl: str(r.claimUrl),
    requiredDepositAmount: num(r.requiredDepositAmount),
    depositRequired: Boolean(r.depositRequired),
  };
}

/**
 * GET /api/content/promotions. Public list, but sent authed so the backend
 * fills the per-visitor claim state (claimed flags) when a session exists.
 */
export async function getPromotions(): Promise<Promotion[]> {
  const res = await api.get<PromotionsResponse>('/api/content/promotions');
  const rows = Array.isArray(res.promotions) ? res.promotions : [];
  return rows.filter((r) => typeof r.id === 'string' && r.id.length > 0).map(mapPromotion);
}

export function usePromotions() {
  return useQuery({ queryKey: promotionsQueryKey, queryFn: getPromotions });
}

// ---------------------------------------------------------------------------
// Promotion banners (GET /api/content/promotions/banners)
// ---------------------------------------------------------------------------

/** One promotion banner slide. imageUrl is a raw backend path; resolve with
 *  absoluteMediaUrl before rendering. */
export interface PromotionBanner {
  id: string;
  title: string;
  titleBn: string | null;
  subtitle: string;
  subtitleBn: string | null;
  imageUrl: string;
  ctaUrl: string | null;
}

export async function getPromotionBanners(): Promise<PromotionBanner[]> {
  const res = await api.get<{ ok: true; banners?: Array<Record<string, unknown>> }>(
    '/api/content/promotions/banners',
  );
  const rows = Array.isArray(res.banners) ? res.banners : [];
  return rows
    .map((r) => ({
      id: String(r.id ?? ''),
      title: typeof r.titleEn === 'string' ? r.titleEn : '',
      titleBn: str(r.titleBn),
      subtitle: typeof r.subtitleEn === 'string' ? r.subtitleEn : '',
      subtitleBn: str(r.subtitleBn),
      imageUrl: typeof r.imageUrl === 'string' ? r.imageUrl : '',
      ctaUrl: str(r.ctaUrl),
    }))
    .filter((b) => b.id.length > 0 && b.imageUrl.length > 0);
}

export function usePromotionBanners() {
  return useQuery({ queryKey: ['promotions', 'banners'], queryFn: getPromotionBanners, staleTime: 60_000 });
}

// ---------------------------------------------------------------------------
// Claim
// ---------------------------------------------------------------------------

/** The typed claim result. `action: 'redirect'` carries a `url` to open. */
export interface ClaimResult {
  action: string;
  ruleName: string | null;
  amount: number | null;
  bonusGrantId: string | null;
  claimId: string | null;
  url: string | null;
}

/**
 * POST /api/promotions/[id]/claim. Handles both branches: the credit branch
 * returns an amount + bonusGrantId; the redirect branch returns action
 * 'redirect' with a `url` the caller opens in an in-app browser. Throws the
 * shared ApiError on rejection so the screen can surface ApiError.message.
 */
export async function claimPromotion(ruleId: string): Promise<ClaimResult> {
  const res = await api.post<{
    ok: true;
    action?: string;
    ruleName?: string;
    amount?: number | null;
    bonusGrantId?: string | null;
    claimId?: string | null;
    url?: string | null;
  }>(`/api/promotions/${encodeURIComponent(ruleId)}/claim`);
  return {
    action: typeof res.action === 'string' ? res.action : 'credit',
    ruleName: str(res.ruleName),
    amount: typeof res.amount === 'number' ? res.amount : null,
    bonusGrantId: str(res.bonusGrantId),
    claimId: str(res.claimId),
    url: str(res.url),
  };
}

/**
 * Claim mutation. On any success it refreshes the wallet balance + bonuses and
 * the promotions list (so claimed flags flip). The synchronous double-submit
 * guard lives in the screen (a useRef checked before mutateAsync) because the
 * disabled prop only updates on the next render.
 */
export function useClaimPromotion() {
  const queryClient = useQueryClient();
  return useMutation<ClaimResult, unknown, string>({
    mutationFn: (ruleId: string) => claimPromotion(ruleId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: balanceKey });
      queryClient.invalidateQueries({ queryKey: bonusesKey });
      queryClient.invalidateQueries({ queryKey: promotionsQueryKey });
    },
  });
}

// ---------------------------------------------------------------------------
// Promo-code redeem
// ---------------------------------------------------------------------------

export interface RedeemResult {
  amount: number;
  rewardType: string | null;
  turnoverX: number | null;
  redemptionId: string | null;
  bonusGrantId: string | null;
}

/**
 * POST /api/promo-codes/redeem. Trims + upcases nothing on the client (the
 * server normalizes); we only trim to avoid an empty submit. Throws ApiError
 * on an invalid / already-used / expired code.
 */
export async function redeemPromoCode(code: string): Promise<RedeemResult> {
  const res = await api.post<{
    ok: true;
    amount?: number;
    rewardType?: string | null;
    turnoverX?: number | null;
    redemptionId?: string | null;
    bonusGrantId?: string | null;
  }>('/api/promo-codes/redeem', { code: code.trim() });
  return {
    amount: num(res.amount),
    rewardType: str(res.rewardType),
    turnoverX: typeof res.turnoverX === 'number' ? res.turnoverX : null,
    redemptionId: str(res.redemptionId),
    bonusGrantId: str(res.bonusGrantId),
  };
}

export function useRedeemPromoCode() {
  const queryClient = useQueryClient();
  return useMutation<RedeemResult, unknown, string>({
    mutationFn: (code: string) => redeemPromoCode(code),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: balanceKey });
      queryClient.invalidateQueries({ queryKey: bonusesKey });
      queryClient.invalidateQueries({ queryKey: promotionsQueryKey });
    },
  });
}
