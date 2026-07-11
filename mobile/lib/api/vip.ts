// Built by Anointed Coder.
//
// VIP Club (Phase 5, engagement): typed fetch functions AND their react-query
// hooks for the live Pasha9 loyalty surface. One feature file so the screen
// imports a single module. The shared client (lib/api/client.ts) attaches the
// bearer, unwraps the { ok } envelope, and throws ApiError.
//
// Backend contracts (read-only reference, apps/web):
//   GET  /api/vip/tiers   (public) -> { tiers[{ id, name, nameBn, position,
//          description, descriptionBn, cashbackRatePercent, withdrawalMaxAmount,
//          perksEn, perksBn, iconUrl, badgeColor }] }
//   GET  /api/vip/status  (authed) -> { tier: VipTier | null,
//          pendingApplication: { id, tierId, appliedAt, notes } | null }
//   POST /api/vip/apply   body { tierId?, notes? }
//          -> { application: { id, status, appliedAt } }
//        Refuses 409 ALREADY_PENDING when an application is already pending,
//        404 TIER_NOT_FOUND / 409 TIER_INACTIVE for a bad tier, 429 RATE_LIMITED.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './client';
import { useAuth } from '@/store/auth';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** One active VIP tier and its perks. */
export interface VipTier {
  id: string;
  name: string;
  nameBn: string | null;
  position: number;
  description: string | null;
  descriptionBn: string | null;
  cashbackRatePercent: number | null;
  withdrawalMaxAmount: number | null;
  perksEn: string[];
  perksBn: string[];
  iconUrl: string | null;
  badgeColor: string | null;
}

export interface VipPendingApplication {
  id: string;
  tierId: string | null;
  appliedAt: string;
  notes: string | null;
}

export interface VipStatus {
  tier: VipTier | null;
  pendingApplication: VipPendingApplication | null;
}

const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : Number(v) || 0);
const strOrNull = (v: unknown): string | null => (typeof v === 'string' && v.length > 0 ? v : null);

/**
 * Perks arrive as a JSON array of strings (or, defensively, a newline-joined
 * string). Normalise both to a clean string[] so the UI can just map over them.
 */
function toPerks(v: unknown): string[] {
  if (Array.isArray(v)) return v.map((x) => String(x)).filter((s) => s.trim().length > 0);
  if (typeof v === 'string') return v.split('\n').map((s) => s.trim()).filter((s) => s.length > 0);
  return [];
}

function toTier(raw: Record<string, unknown> | null | undefined): VipTier | null {
  if (!raw || typeof raw.id !== 'string' || raw.id.length === 0) return null;
  return {
    id: String(raw.id),
    name: typeof raw.name === 'string' && raw.name.length > 0 ? raw.name : 'VIP',
    nameBn: strOrNull(raw.nameBn),
    position: num(raw.position),
    description: strOrNull(raw.description),
    descriptionBn: strOrNull(raw.descriptionBn),
    cashbackRatePercent: raw.cashbackRatePercent == null ? null : num(raw.cashbackRatePercent),
    withdrawalMaxAmount: raw.withdrawalMaxAmount == null ? null : num(raw.withdrawalMaxAmount),
    perksEn: toPerks(raw.perksEn),
    perksBn: toPerks(raw.perksBn),
    iconUrl: strOrNull(raw.iconUrl),
    badgeColor: strOrNull(raw.badgeColor),
  };
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

interface VipTiersResponse {
  ok: true;
  tiers?: Array<Record<string, unknown>> | null;
}

/**
 * GET /api/vip/tiers. Public ordered list of active tiers (Bronze -> Diamond).
 * Called without a bearer so the ladder renders before the player signs in.
 */
export async function getVipTiers(): Promise<VipTier[]> {
  const res = await api.get<VipTiersResponse>('/api/vip/tiers', { auth: false });
  const rows = Array.isArray(res.tiers) ? res.tiers : [];
  return rows
    .map((r) => toTier(r))
    .filter((t): t is VipTier => t !== null)
    .sort((a, b) => a.position - b.position);
}

interface VipStatusResponse {
  ok: true;
  tier?: Record<string, unknown> | null;
  pendingApplication?: Record<string, unknown> | null;
}

/**
 * GET /api/vip/status. The player's current tier (or null for none yet) plus a
 * pending-application flag so the screen can disable Apply while one is open.
 */
export async function getVipStatus(): Promise<VipStatus> {
  const res = await api.get<VipStatusResponse>('/api/vip/status');
  const pending = res.pendingApplication;
  return {
    tier: toTier(res.tier),
    pendingApplication:
      pending && typeof pending.id === 'string'
        ? {
            id: String(pending.id),
            tierId: strOrNull(pending.tierId),
            appliedAt: typeof pending.appliedAt === 'string' ? pending.appliedAt : '',
            notes: strOrNull(pending.notes),
          }
        : null,
  };
}

// ---------------------------------------------------------------------------
// Apply
// ---------------------------------------------------------------------------

export interface ApplyVipInput {
  tierId?: string | null;
  notes?: string | null;
}

export interface VipApplicationResult {
  id: string;
  status: string;
  appliedAt: string;
}

interface ApplyVipResponse {
  ok: true;
  application?: { id?: string; status?: string; appliedAt?: string } | null;
}

/**
 * POST /api/vip/apply. Files an upgrade application for staff review. Throws
 * the shared ApiError so the screen can surface message and branch on
 * 409 ALREADY_PENDING, 404 TIER_NOT_FOUND, 409 TIER_INACTIVE, 429 RATE_LIMITED.
 */
export async function applyForVip(input: ApplyVipInput = {}): Promise<VipApplicationResult> {
  const res = await api.post<ApplyVipResponse>('/api/vip/apply', {
    tierId: input.tierId ?? undefined,
    notes: input.notes ?? undefined,
  });
  const app = res.application ?? {};
  return {
    id: typeof app.id === 'string' ? app.id : '',
    status: typeof app.status === 'string' ? app.status : 'pending',
    appliedAt: typeof app.appliedAt === 'string' ? app.appliedAt : '',
  };
}

// ---------------------------------------------------------------------------
// Query keys + hooks
// ---------------------------------------------------------------------------

export const vipTiersQueryKey = ['vip', 'tiers'] as const;
export const vipStatusQueryKey = ['vip', 'status'] as const;

/** Public tier ladder. Cached a few minutes; tiers change rarely. */
export function useVipTiers() {
  return useQuery<VipTier[]>({
    queryKey: vipTiersQueryKey,
    queryFn: getVipTiers,
    staleTime: 5 * 60_000,
  });
}

/** Current player tier + pending-application flag. Gated on auth. */
export function useVipStatus() {
  const { status } = useAuth();
  return useQuery<VipStatus>({
    queryKey: vipStatusQueryKey,
    queryFn: getVipStatus,
    enabled: status === 'authed',
    staleTime: 30_000,
  });
}

/**
 * Apply for a VIP tier. No money moves here, but the pending flag must refresh
 * so the screen immediately reflects the open application (and hides Apply).
 */
export function useApplyForVip() {
  const queryClient = useQueryClient();
  return useMutation<VipApplicationResult, unknown, ApplyVipInput>({
    mutationFn: applyForVip,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: vipStatusQueryKey });
    },
  });
}
