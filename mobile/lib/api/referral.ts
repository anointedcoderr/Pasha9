// Built by Anointed Coder.
//
// Typed API functions + react-query hooks for the live player referral
// dashboard: the code + stats read and the matured-commission claim.
//
// Backend contracts (read-only reference):
//   GET  /api/me/referrals
//        -> { user: { username, referralCode, inviteLink },
//             downline: { level1Total, level1Active, level2Total, level3Total },
//             level1Invited: [{ username, phone, joinedAt }],
//             tier: { name, level1Pct, level2Pct, level3Pct, isDefault } | null,
//             balance: { pendingAmount, claimableAmount, claimedAmount,
//                        totalEarned, lastClaimedAt },
//             settings, claim: { cadenceBlocked, nextClaimAt },
//             recentCommissions, recentClaims }
//   POST /api/me/referrals/claim
//        -> { status, amount, claimId, payoutId, walletTxId }
//        Rejections: 409 CADENCE_BLOCKED / NOTHING_TO_CLAIM / CLAIM_MODE_DISABLED.

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from './client';

export const referralQueryKey = ['referral', 'me'] as const;

const balanceKey = ['wallet', 'balance'] as const;
const bonusesKey = ['wallet', 'bonuses'] as const;

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------

export interface ReferralInvitee {
  username: string;
  phone: string;
  joinedAt: string | null;
}

export interface ReferralTier {
  name: string;
  level1Pct: number;
  level2Pct: number;
  level3Pct: number;
  isDefault: boolean;
}

export interface ReferralOverview {
  username: string;
  referralCode: string;
  inviteLink: string;
  downline: {
    level1Total: number;
    level1Active: number;
    level2Total: number;
    level3Total: number;
  };
  invited: ReferralInvitee[];
  tier: ReferralTier | null;
  balance: {
    pendingAmount: number;
    claimableAmount: number;
    claimedAmount: number;
    totalEarned: number;
    lastClaimedAt: string | null;
  };
  cadence: string;
  cadenceBlocked: boolean;
  nextClaimAt: string | null;
}

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}
function str(v: unknown): string | null {
  return typeof v === 'string' && v.length > 0 ? v : null;
}

interface ReferralResponse {
  ok: true;
  user?: { username?: string; referralCode?: string; inviteLink?: string };
  downline?: { level1Total?: number; level1Active?: number; level2Total?: number; level3Total?: number };
  level1Invited?: Array<{ username?: string; phone?: string; joinedAt?: string }>;
  tier?: { name?: string; level1Pct?: number; level2Pct?: number; level3Pct?: number; isDefault?: boolean } | null;
  balance?: {
    pendingAmount?: number;
    claimableAmount?: number;
    claimedAmount?: number;
    totalEarned?: number;
    lastClaimedAt?: string | null;
  };
  settings?: { cadence?: string };
  claim?: { cadenceBlocked?: boolean; nextClaimAt?: string | null };
}

export async function getReferralOverview(): Promise<ReferralOverview> {
  const res = await api.get<ReferralResponse>('/api/me/referrals');
  const invited = Array.isArray(res.level1Invited) ? res.level1Invited : [];
  return {
    username: res.user?.username ?? '',
    referralCode: res.user?.referralCode ?? '',
    inviteLink: res.user?.inviteLink ?? '',
    downline: {
      level1Total: num(res.downline?.level1Total),
      level1Active: num(res.downline?.level1Active),
      level2Total: num(res.downline?.level2Total),
      level3Total: num(res.downline?.level3Total),
    },
    invited: invited.map((u) => ({
      username: typeof u.username === 'string' ? u.username : '',
      phone: typeof u.phone === 'string' ? u.phone : '',
      joinedAt: str(u.joinedAt),
    })),
    tier: res.tier
      ? {
          name: typeof res.tier.name === 'string' ? res.tier.name : '',
          level1Pct: num(res.tier.level1Pct),
          level2Pct: num(res.tier.level2Pct),
          level3Pct: num(res.tier.level3Pct),
          isDefault: Boolean(res.tier.isDefault),
        }
      : null,
    balance: {
      pendingAmount: num(res.balance?.pendingAmount),
      claimableAmount: num(res.balance?.claimableAmount),
      claimedAmount: num(res.balance?.claimedAmount),
      totalEarned: num(res.balance?.totalEarned),
      lastClaimedAt: str(res.balance?.lastClaimedAt),
    },
    cadence: typeof res.settings?.cadence === 'string' ? res.settings.cadence : 'weekly',
    cadenceBlocked: Boolean(res.claim?.cadenceBlocked),
    nextClaimAt: str(res.claim?.nextClaimAt),
  };
}

export function useReferralOverview() {
  return useQuery({ queryKey: referralQueryKey, queryFn: getReferralOverview });
}

// ---------------------------------------------------------------------------
// Claim
// ---------------------------------------------------------------------------

export interface ReferralClaimResult {
  status: string;
  amount: number;
  claimId: string | null;
  payoutId: string | null;
  walletTxId: string | null;
}

/**
 * POST /api/me/referrals/claim. Settles matured referral commissions into the
 * wallet. Throws the shared ApiError on a rejection (CADENCE_BLOCKED /
 * NOTHING_TO_CLAIM / CLAIM_MODE_DISABLED / RATE_LIMITED) so the screen can
 * surface ApiError.message.
 */
export async function claimReferral(): Promise<ReferralClaimResult> {
  const res = await api.post<{
    ok: true;
    status?: string;
    amount?: number;
    claimId?: string | null;
    payoutId?: string | null;
    walletTxId?: string | null;
  }>('/api/me/referrals/claim');
  return {
    status: typeof res.status === 'string' ? res.status : 'paid',
    amount: num(res.amount),
    claimId: str(res.claimId),
    payoutId: str(res.payoutId),
    walletTxId: str(res.walletTxId),
  };
}

export function useClaimReferral() {
  const queryClient = useQueryClient();
  return useMutation<ReferralClaimResult, unknown, void>({
    mutationFn: () => claimReferral(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: balanceKey });
      queryClient.invalidateQueries({ queryKey: bonusesKey });
      queryClient.invalidateQueries({ queryKey: referralQueryKey });
    },
  });
}
