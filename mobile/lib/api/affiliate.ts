// Built by Anointed Coder.
//
// Typed API functions + react-query hooks for the live affiliate program:
// the applicant's own status/stats read and the apply submission.
//
// Backend contracts (read-only reference):
//   GET  /api/affiliate/me
//        -> { user: { username, referralCode, isAffiliate, tier },
//             application: { id, status, channel, audience, notes,
//                            reviewedAt, createdAt } | null,
//             downline: { level1, level2, level3, active },
//             commissions: { totalAll, pending, approved, paid, cancelled,
//                            withdrawable, inFlightPayouts }, ... }
//   POST /api/affiliate/apply  { channel?, audience?, notes? }
//        -> { application, alreadyApplied? }
//        A pending / approved user gets the existing record back
//        (alreadyApplied: true); a rejected user can reapply.

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from './client';

export const affiliateQueryKey = ['affiliate', 'me'] as const;

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------

export type AffiliateStatus = 'pending' | 'approved' | 'rejected';

export interface AffiliateApplication {
  id: string;
  status: AffiliateStatus;
  channel: string | null;
  audience: string | null;
  notes: string | null;
  reviewedAt: string | null;
  createdAt: string | null;
}

export interface AffiliateTier {
  id: string;
  name: string;
  description: string | null;
  level1Pct: number;
  level2Pct: number;
  level3Pct: number;
}

export interface AffiliateOverview {
  username: string;
  referralCode: string;
  isAffiliate: boolean;
  tier: AffiliateTier | null;
  application: AffiliateApplication | null;
  downline: { level1: number; level2: number; level3: number; active: number };
  commissions: {
    totalAll: number;
    pending: number;
    approved: number;
    paid: number;
    withdrawable: number;
  };
}

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}
function str(v: unknown): string | null {
  return typeof v === 'string' && v.length > 0 ? v : null;
}
function normStatus(v: unknown): AffiliateStatus {
  return v === 'approved' || v === 'rejected' ? v : 'pending';
}

interface AffiliateResponse {
  ok: true;
  user?: {
    username?: string;
    referralCode?: string;
    isAffiliate?: boolean;
    tier?: {
      id?: string;
      name?: string;
      description?: string | null;
      level1Pct?: number;
      level2Pct?: number;
      level3Pct?: number;
    } | null;
  };
  application?: {
    id?: string;
    status?: string;
    channel?: string | null;
    audience?: string | null;
    notes?: string | null;
    reviewedAt?: string | null;
    createdAt?: string | null;
  } | null;
  downline?: { level1?: number; level2?: number; level3?: number; active?: number };
  commissions?: { totalAll?: number; pending?: number; approved?: number; paid?: number; withdrawable?: number };
}

function mapApplication(a: NonNullable<AffiliateResponse['application']>): AffiliateApplication {
  return {
    id: String(a.id ?? ''),
    status: normStatus(a.status),
    channel: str(a.channel),
    audience: str(a.audience),
    notes: str(a.notes),
    reviewedAt: str(a.reviewedAt),
    createdAt: str(a.createdAt),
  };
}

export async function getAffiliateOverview(): Promise<AffiliateOverview> {
  const res = await api.get<AffiliateResponse>('/api/affiliate/me');
  const tier = res.user?.tier ?? null;
  return {
    username: res.user?.username ?? '',
    referralCode: res.user?.referralCode ?? '',
    isAffiliate: Boolean(res.user?.isAffiliate),
    tier: tier
      ? {
          id: String(tier.id ?? ''),
          name: typeof tier.name === 'string' ? tier.name : '',
          description: str(tier.description),
          level1Pct: num(tier.level1Pct),
          level2Pct: num(tier.level2Pct),
          level3Pct: num(tier.level3Pct),
        }
      : null,
    application: res.application ? mapApplication(res.application) : null,
    downline: {
      level1: num(res.downline?.level1),
      level2: num(res.downline?.level2),
      level3: num(res.downline?.level3),
      active: num(res.downline?.active),
    },
    commissions: {
      totalAll: num(res.commissions?.totalAll),
      pending: num(res.commissions?.pending),
      approved: num(res.commissions?.approved),
      paid: num(res.commissions?.paid),
      withdrawable: num(res.commissions?.withdrawable),
    },
  };
}

export function useAffiliateOverview() {
  return useQuery({ queryKey: affiliateQueryKey, queryFn: getAffiliateOverview });
}

// ---------------------------------------------------------------------------
// Apply
// ---------------------------------------------------------------------------

export interface AffiliateApplyInput {
  channel?: string;
  audience?: string;
  notes?: string;
}

export interface AffiliateApplyResult {
  application: AffiliateApplication | null;
  alreadyApplied: boolean;
}

/**
 * POST /api/affiliate/apply. Only sends fields the user actually filled so the
 * server-side max-length validation is never tripped by empty strings. Throws
 * the shared ApiError on rejection (VALIDATION / RATE_LIMITED) so the screen
 * can surface ApiError.message.
 */
export async function applyAffiliate(input: AffiliateApplyInput): Promise<AffiliateApplyResult> {
  const body: Record<string, string> = {};
  const channel = input.channel?.trim();
  const audience = input.audience?.trim();
  const notes = input.notes?.trim();
  if (channel) body.channel = channel;
  if (audience) body.audience = audience;
  if (notes) body.notes = notes;

  const res = await api.post<{ ok: true; application?: AffiliateResponse['application']; alreadyApplied?: boolean }>(
    '/api/affiliate/apply',
    body,
  );
  return {
    application: res.application ? mapApplication(res.application) : null,
    alreadyApplied: Boolean(res.alreadyApplied),
  };
}

export function useApplyAffiliate() {
  const queryClient = useQueryClient();
  return useMutation<AffiliateApplyResult, unknown, AffiliateApplyInput>({
    mutationFn: (input: AffiliateApplyInput) => applyAffiliate(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: affiliateQueryKey });
    },
  });
}
