// Built by Anointed Coder.
//
// Betting Pass (Phase 5, engagement): typed fetch functions AND their
// react-query hooks for the live Pasha9 season pass surface. Kept in one
// feature file so the screen imports a single module. The shared client
// (lib/api/client.ts) already attaches the bearer, unwraps the { ok }
// envelope, and throws ApiError, so each function here only shapes the
// request and types what it reads.
//
// Backend contracts (read-only reference, apps/web):
//   GET  /api/betting-pass/me
//        -> { enabled, seasonKey, pointsPerBdtDeposit, pointsPerBdtBet,
//             progress{ pointsTotal, pointsFromDeposit, pointsFromBet,
//                       currentTier, currentTierName, nextTierName,
//                       pointsToNextTier, nextTierRequirement },
//             ladder[{ id, tier, nameEn, nameBn, descriptionEn, descriptionBn,
//                      iconUrl, pointsRequired, rewardKind, rewardAmount,
//                      turnoverX, unlocked, claimed, claimable }],
//             claims[{ id, ruleId, tier, rewardKind, rewardAmount, status,
//                      createdAt }] }
//   POST /api/betting-pass/claim/[id]
//        -> { claimId, rewardKind, rewardAmount, pointsSpent, pointsTotalAfter,
//             currentTier, walletBalances, bonusGrantId, turnoverRequired }
//        Money-gated: credits bonus / locked / bonusBalance server-side and
//        refuses with 403 TIER_LOCKED|INSUFFICIENT_POINTS, 409 ALREADY_CLAIMED
//        | RULE_INACTIVE, 404 RULE_NOT_FOUND, 429 RATE_LIMITED.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './client';
import { useAuth } from '@/store/auth';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type RewardKind = 'coins' | 'freebet' | 'bonus' | 'physical' | string;

/** One tier row on the season ladder, with the player's unlock/claim state. */
export interface BettingPassTier {
  id: string;
  tier: number;
  nameEn: string;
  nameBn: string | null;
  descriptionEn: string | null;
  descriptionBn: string | null;
  iconUrl: string | null;
  pointsRequired: number;
  rewardKind: RewardKind;
  rewardAmount: number;
  turnoverX: number;
  unlocked: boolean;
  claimed: boolean;
  claimable: boolean;
}

export interface BettingPassProgress {
  pointsTotal: number;
  pointsFromDeposit: number;
  pointsFromBet: number;
  currentTier: number;
  currentTierName: string | null;
  nextTierName: string | null;
  pointsToNextTier: number;
  nextTierRequirement: number | null;
}

export interface BettingPassClaim {
  id: string;
  ruleId: string;
  tier: number;
  rewardKind: RewardKind;
  rewardAmount: number;
  status: string;
  createdAt: string;
}

export interface BettingPassMe {
  enabled: boolean;
  seasonKey: string;
  pointsPerBdtDeposit: number;
  pointsPerBdtBet: number;
  progress: BettingPassProgress;
  ladder: BettingPassTier[];
  claims: BettingPassClaim[];
}

interface BettingPassMeResponse {
  ok: true;
  enabled?: boolean;
  seasonKey?: string;
  pointsPerBdtDeposit?: number;
  pointsPerBdtBet?: number;
  progress?: Partial<BettingPassProgress> | null;
  ladder?: Array<Partial<BettingPassTier>> | null;
  claims?: Array<Partial<BettingPassClaim>> | null;
}

const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : Number(v) || 0);
const str = (v: unknown): string => (typeof v === 'string' ? v : '');
const strOrNull = (v: unknown): string | null => (typeof v === 'string' && v.length > 0 ? v : null);

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

/**
 * GET /api/betting-pass/me. The signed-in player's season progress plus the
 * operator's configured ladder, with unlock/claim state resolved server-side.
 * Normalises every numeric field so the UI always has numbers to render.
 */
export async function getBettingPassMe(): Promise<BettingPassMe> {
  const res = await api.get<BettingPassMeResponse>('/api/betting-pass/me');

  const p = res.progress ?? {};
  const progress: BettingPassProgress = {
    pointsTotal: num(p.pointsTotal),
    pointsFromDeposit: num(p.pointsFromDeposit),
    pointsFromBet: num(p.pointsFromBet),
    currentTier: num(p.currentTier),
    currentTierName: strOrNull(p.currentTierName),
    nextTierName: strOrNull(p.nextTierName),
    pointsToNextTier: num(p.pointsToNextTier),
    nextTierRequirement: p.nextTierRequirement == null ? null : num(p.nextTierRequirement),
  };

  const ladder: BettingPassTier[] = Array.isArray(res.ladder)
    ? res.ladder
        .filter((r) => typeof r.id === 'string' && r.id.length > 0)
        .map((r) => ({
          id: String(r.id),
          tier: num(r.tier),
          nameEn: str(r.nameEn) || `Tier ${num(r.tier)}`,
          nameBn: strOrNull(r.nameBn),
          descriptionEn: strOrNull(r.descriptionEn),
          descriptionBn: strOrNull(r.descriptionBn),
          iconUrl: strOrNull(r.iconUrl),
          pointsRequired: num(r.pointsRequired),
          rewardKind: str(r.rewardKind) || 'reward',
          rewardAmount: num(r.rewardAmount),
          turnoverX: num(r.turnoverX),
          unlocked: Boolean(r.unlocked),
          claimed: Boolean(r.claimed),
          claimable: Boolean(r.claimable),
        }))
    : [];

  const claims: BettingPassClaim[] = Array.isArray(res.claims)
    ? res.claims
        .filter((c) => typeof c.id === 'string' && c.id.length > 0)
        .map((c) => ({
          id: String(c.id),
          ruleId: str(c.ruleId),
          tier: num(c.tier),
          rewardKind: str(c.rewardKind) || 'reward',
          rewardAmount: num(c.rewardAmount),
          status: str(c.status) || 'pending',
          createdAt: str(c.createdAt),
        }))
    : [];

  return {
    enabled: Boolean(res.enabled),
    seasonKey: str(res.seasonKey) || 'season',
    pointsPerBdtDeposit: num(res.pointsPerBdtDeposit),
    pointsPerBdtBet: num(res.pointsPerBdtBet),
    progress,
    ladder,
    claims,
  };
}

// ---------------------------------------------------------------------------
// Claim
// ---------------------------------------------------------------------------

export interface ClaimTierResult {
  claimId: string;
  rewardKind: RewardKind;
  rewardAmount: number;
  pointsSpent: number;
  pointsTotalAfter: number;
  currentTier: number;
  bonusGrantId: string | null;
  turnoverRequired: number;
}

interface ClaimTierResponse {
  ok: true;
  claimId?: string;
  rewardKind?: string;
  rewardAmount?: number;
  pointsSpent?: number;
  pointsTotalAfter?: number;
  currentTier?: number;
  bonusGrantId?: string | null;
  turnoverRequired?: number;
}

/**
 * POST /api/betting-pass/claim/[id]. Claims one unlocked tier. Real money
 * movement: coins credit bonusBalance, freebet/bonus credit lockedBalance (a
 * bonus also grants turnover). Throws the shared ApiError on failure so the
 * screen can surface message and branch on:
 *   403 TIER_LOCKED | INSUFFICIENT_POINTS
 *   409 ALREADY_CLAIMED | RULE_INACTIVE
 *   404 RULE_NOT_FOUND   429 RATE_LIMITED
 */
export async function claimBettingPassTier(ruleId: string): Promise<ClaimTierResult> {
  const res = await api.post<ClaimTierResponse>(
    `/api/betting-pass/claim/${encodeURIComponent(ruleId)}`,
  );
  return {
    claimId: str(res.claimId),
    rewardKind: str(res.rewardKind) || 'reward',
    rewardAmount: num(res.rewardAmount),
    pointsSpent: num(res.pointsSpent),
    pointsTotalAfter: num(res.pointsTotalAfter),
    currentTier: num(res.currentTier),
    bonusGrantId: strOrNull(res.bonusGrantId),
    turnoverRequired: num(res.turnoverRequired),
  };
}

// ---------------------------------------------------------------------------
// Query keys + hooks
// ---------------------------------------------------------------------------

export const bettingPassMeQueryKey = ['betting-pass', 'me'] as const;

/** Live season pass state. Gated on auth (the endpoint requires a session). */
export function useBettingPassMe() {
  const { status } = useAuth();
  return useQuery<BettingPassMe>({
    queryKey: bettingPassMeQueryKey,
    queryFn: getBettingPassMe,
    enabled: status === 'authed',
    staleTime: 15_000,
  });
}

// ---------------------------------------------------------------------------
// Banners (GET /api/content/betting-pass/banners)
// ---------------------------------------------------------------------------

/** One Betting Pass banner. imageUrl is a raw backend path; resolve with
 *  absoluteMediaUrl before rendering. */
export interface BettingPassBanner {
  id: string;
  title: string;
  titleBn: string | null;
  subtitle: string;
  subtitleBn: string | null;
  imageUrl: string;
  ctaUrl: string | null;
  showOverlay: boolean;
}

export async function getBettingPassBanners(): Promise<BettingPassBanner[]> {
  const res = await api.get<{ ok: true; banners?: Array<Record<string, unknown>> }>(
    '/api/content/betting-pass/banners',
  );
  const rows = Array.isArray(res.banners) ? res.banners : [];
  return rows
    .map((b) => ({
      id: String(b.id ?? ''),
      title: str(b.titleEn),
      titleBn: strOrNull(b.titleBn),
      subtitle: str(b.subtitleEn),
      subtitleBn: strOrNull(b.subtitleBn),
      imageUrl: str(b.imageUrl),
      ctaUrl: strOrNull(b.ctaUrl),
      showOverlay: b.showOverlay !== false,
    }))
    .filter((b) => b.id.length > 0 && b.imageUrl.length > 0);
}

export function useBettingPassBanners() {
  const { status } = useAuth();
  return useQuery<BettingPassBanner[]>({
    queryKey: ['betting-pass', 'banners'],
    queryFn: getBettingPassBanners,
    enabled: status === 'authed',
    staleTime: 60_000,
  });
}

/**
 * Claim a betting-pass tier. On success (real credit) invalidate the wallet
 * balance + bonuses reads and refetch the pass so the ladder flips the tier to
 * claimed and the points total updates.
 */
export function useClaimBettingPassTier() {
  const queryClient = useQueryClient();
  return useMutation<ClaimTierResult, unknown, string>({
    mutationFn: claimBettingPassTier,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wallet', 'balance'] });
      queryClient.invalidateQueries({ queryKey: ['wallet', 'bonuses'] });
      queryClient.invalidateQueries({ queryKey: bettingPassMeQueryKey });
    },
  });
}
