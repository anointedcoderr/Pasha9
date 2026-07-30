// Built by Anointed Coder.
//
// Live Pasha9 Rewards surface: typed fetch functions AND their react-query
// hooks in one file (Phase 5 engagement wiring). Contracts mirrored from
// apps/web/app/api/rewards/* and apps/web/app/api/content/* (read-only):
//   - getRewardsMe()          GET  /api/rewards/me            (authed)
//   - getRewardStore()        GET  /api/content/rewards       (public)
//   - getSpinWheel()          GET  /api/content/spin-wheel    (public)
//   - checkIn()               POST /api/rewards/check-in      (authed, credits coins)
//   - spin(tierKey?)          POST /api/rewards/spin          (authed, money/coins)
//   - redeemReward(id, body)  POST /api/rewards/[id]/claim    (authed, spends coins)
//
// Reward coins live on Wallet.bonusBalance, so every action that credits or
// spends them refreshes the wallet balance + bonuses caches. The { ok }
// envelope unwrap + 401 refresh live in lib/api/client.ts.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './client';
import { useAuth } from '@/store/auth';

// ---------------------------------------------------------------------------
// Free-spin allowance helpers (mirror apps/web/lib/rewards/free-spins.ts).
// A negative daily allowance is the "unlimited" sentinel: off = 0, a fixed
// number, or unlimited = -1. Kept here so the rewards screen renders and
// gates spins consistently with the web build.
// ---------------------------------------------------------------------------

export const UNLIMITED_FREE_SPINS = -1;

export function isUnlimitedFreeSpins(value: number | null | undefined): boolean {
  return typeof value === 'number' && value < 0;
}

export function formatFreeSpins(value: number | null | undefined, bn: boolean): string {
  if (isUnlimitedFreeSpins(value)) return bn ? 'সীমাহীন' : 'Unlimited';
  return String(Math.max(0, Math.floor(Number(value) || 0)));
}

// ---------------------------------------------------------------------------
// Types (GET /api/rewards/me)
// ---------------------------------------------------------------------------

export interface CheckInConfig {
  enabled: boolean;
  dailyCoins: number;
  streakBonusDay7: number;
  minDepositRequirement: number;
  minBetRequirement: number;
  cycleLength: number;
  dayAmounts: number[];
  requireDepositPerCycle: boolean;
  minDepositForNextCycle: number;
  depositGateTextEn: string;
  depositGateTextBn: string;
  [key: string]: unknown;
}

export interface SpinConfig {
  enabled: boolean;
  costPerSpinCoins: number;
  freeSpinsPerDay: number;
  [key: string]: unknown;
}

export interface RewardsMe {
  coins: number;
  checkIn: {
    config: CheckInConfig;
    claimedToday: boolean;
    streakDay: number;
    depositRequiredForNextCycle: boolean;
  };
  spin: {
    config: SpinConfig;
    freeSpinsRemaining: number;
    dailyFreeSpinsRemaining: number;
    grantedFreeSpinsByTier: Record<string, number>;
    // True remaining free spins per named wheel (daily allowance minus used
    // today, plus granted). Present on newer backends; may be absent.
    freeRemainingByTier?: Record<string, number>;
    grantedFreeSpinsTotal: number;
    lastSpinAt: string | null;
  };
}

// ---------------------------------------------------------------------------
// Types (GET /api/content/rewards -> store items)
// ---------------------------------------------------------------------------

export type RewardType = 'recharge' | 'physical' | 'digital' | string;

export interface RewardItem {
  id: string;
  title: string;
  titleBn: string | null;
  description: string | null;
  descriptionBn: string | null;
  cost: number;
  category: string | null;
  rewardType: RewardType;
  accent: string | null;
  imageUrl: string | null;
  bannerUrl: string | null;
  shortInstructionEn: string | null;
  shortInstructionBn: string | null;
  position: number;
}

export interface RewardStore {
  items: RewardItem[];
}

// ---------------------------------------------------------------------------
// Types (GET /api/content/spin-wheel)
// ---------------------------------------------------------------------------

export interface SpinSegmentPublic {
  id: string;
  label: string;
  color: string;
  position: number;
  payoutType: string;
  payoutAmount: number;
  turnoverX: number;
}

export interface SpinTier {
  id: string;
  key: string;
  nameEn: string;
  nameBn: string | null;
  descriptionEn: string | null;
  descriptionBn: string | null;
  costPerSpin: number;
  freeSpinsPerDay: number;
  color: string | null;
  iconUrl: string | null;
  position: number;
  segments: SpinSegmentPublic[];
}

export interface SpinWheel {
  config: SpinConfig;
  tiers: SpinTier[];
  legacySegments: SpinSegmentPublic[];
  segments: SpinSegmentPublic[];
}

// ---------------------------------------------------------------------------
// Action result types
// ---------------------------------------------------------------------------

export interface CheckInResult {
  coinsAwarded: number;
  streakDay: number;
  isDay7: boolean;
}

export interface SpinResultPayload {
  tierKey: string | null;
  segmentId: string;
  segmentIndex: number;
  segmentLabel: string;
  payoutType: string;
  payoutAmount: number;
  cost: number;
  source: 'free_daily' | 'free_grant' | 'manual';
  bonusGrantId: string | null;
  freeSpinsRemaining: number;
}

/** Body shape for POST /api/rewards/[id]/claim, keyed by RewardItem.rewardType. */
export interface RechargeClaimBody {
  operator: 'gp' | 'robi' | 'bl' | 'airtel' | 'teletalk';
  phone: string;
}
export interface PhysicalClaimBody {
  fullName: string;
  phone: string;
  address: string;
  notes?: string;
}
export type RedeemBody = RechargeClaimBody | PhysicalClaimBody | Record<string, never>;

export interface RedeemResult {
  claim: {
    id: string;
    itemTitle: string;
    rewardType: RewardType;
    costPaid: number;
    status: string;
  };
}

// ---------------------------------------------------------------------------
// Fetch functions
// ---------------------------------------------------------------------------

export function getRewardsMe(): Promise<RewardsMe> {
  return api.get<RewardsMe>('/api/rewards/me');
}

export function getRewardStore(): Promise<RewardStore> {
  return api.get<RewardStore>('/api/content/rewards');
}

export function getSpinWheel(): Promise<SpinWheel> {
  return api.get<SpinWheel>('/api/content/spin-wheel');
}

export function checkIn(): Promise<CheckInResult> {
  return api.post<CheckInResult>('/api/rewards/check-in');
}

export function spin(tierKey?: string): Promise<SpinResultPayload> {
  return api.post<SpinResultPayload>('/api/rewards/spin', tierKey ? { tierKey } : {});
}

export function redeemReward(id: string, body: RedeemBody): Promise<RedeemResult> {
  return api.post<RedeemResult>(`/api/rewards/${id}/claim`, body);
}

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------

export const rewardsMeQueryKey = ['rewards', 'me'] as const;
export const rewardStoreQueryKey = ['rewards', 'store'] as const;
export const spinWheelQueryKey = ['rewards', 'spin-wheel'] as const;

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

/** Coin balance + check-in + spin snapshot. Gated on an authed session. */
export function useRewardsMe() {
  const { status } = useAuth();
  return useQuery<RewardsMe>({
    queryKey: rewardsMeQueryKey,
    queryFn: getRewardsMe,
    enabled: status === 'authed',
    staleTime: 15_000,
  });
}

/** Public reward-store items. Gated on auth to keep it off the guest shell. */
export function useRewardStore() {
  const { status } = useAuth();
  return useQuery<RewardStore>({
    queryKey: rewardStoreQueryKey,
    queryFn: getRewardStore,
    enabled: status === 'authed',
    staleTime: 60_000,
  });
}

/** Public spin-wheel description (tiers + segments + config). */
export function useSpinWheel() {
  const { status } = useAuth();
  return useQuery<SpinWheel>({
    queryKey: spinWheelQueryKey,
    queryFn: getSpinWheel,
    enabled: status === 'authed',
    staleTime: 60_000,
  });
}

/** Daily check-in claim. Credits reward coins (Wallet.bonusBalance). */
export function useCheckIn() {
  const queryClient = useQueryClient();
  return useMutation<CheckInResult, unknown, void>({
    mutationFn: () => checkIn(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wallet', 'balance'] });
      queryClient.invalidateQueries({ queryKey: ['wallet', 'bonuses'] });
      queryClient.invalidateQueries({ queryKey: rewardsMeQueryKey });
    },
  });
}

/** Spin the wheel. Spends coins / grants prizes, so refresh wallet + rewards. */
export function useSpin() {
  const queryClient = useQueryClient();
  return useMutation<SpinResultPayload, unknown, string | undefined>({
    mutationFn: (tierKey?: string) => spin(tierKey),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wallet', 'balance'] });
      queryClient.invalidateQueries({ queryKey: ['wallet', 'bonuses'] });
      queryClient.invalidateQueries({ queryKey: rewardsMeQueryKey });
    },
  });
}

/** Redeem a reward-store item. Spends coins immediately (freezes on the claim). */
export function useRedeemReward() {
  const queryClient = useQueryClient();
  return useMutation<RedeemResult, unknown, { id: string; body: RedeemBody }>({
    mutationFn: ({ id, body }) => redeemReward(id, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wallet', 'balance'] });
      queryClient.invalidateQueries({ queryKey: ['wallet', 'bonuses'] });
      queryClient.invalidateQueries({ queryKey: rewardsMeQueryKey });
    },
  });
}
