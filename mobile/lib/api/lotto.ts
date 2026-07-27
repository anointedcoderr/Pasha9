// Built by Anointed Coder.
//
// Live Pasha9 Lotto surface: typed fetch functions AND their react-query
// hooks in one file (Phase 5 engagement wiring). Contracts mirrored from
// apps/web/app/api/lotto/* (read-only reference):
//   - getLottoMe()          GET  /api/lotto/me                     (authed)
//   - claimWinning(id)      POST /api/lotto/winnings/[id]/claim    (authed, money)
//   - transferLotto(amount) POST /api/lotto/transfer               (authed, money)
//
// Lotto tickets on Pasha9 are ACCRUED from approved deposits (ticketsPerBlock
// per blockAmount), not bought with a number-pick. There is no buy-ticket /
// draw-purchase endpoint server-side, so the UI never fakes one. The only
// money movement on this surface is claimWinning (credits Wallet.lottoBalance)
// and transferLotto (moves Wallet.lottoBalance onward to Wallet.balance). The
// { ok } envelope unwrap + 401 refresh live in lib/api/client.ts.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './client';
import { useAuth } from '@/store/auth';

// ---------------------------------------------------------------------------
// Types (GET /api/lotto/me)
// ---------------------------------------------------------------------------

export type LottoTicketStatus = 'issued' | 'won' | 'lost' | 'void' | string;
export type LottoWinningStatus = 'pending_credit' | 'credited' | string;

export interface LottoRules {
  ticketsPerBlock: number;
  blockAmount: number;
  digits: number;
  drawTimeLabel: string;
  enabled: boolean;
  claimMode: string;
}

export interface LottoProgress {
  totalApprovedDeposits: number;
  earnedTickets: number;
  toNextBlock: number;
  blockAmount: number;
  ticketsPerBlock: number;
}

export interface LottoSummary {
  ticketCount: number;
  wonCount: number;
  winningCount: number;
  wonLifetime: number;
  wonToday: number;
  activeTicketsCount: number;
  lastDrawWinningTicketsCount: number;
}

export interface LottoTicketDraw {
  id: string;
  name: string | null;
  drawsAt: string | null;
  settledAt: string | null;
  closedAt: string | null;
}

export interface LottoTicket {
  id: string;
  number: string;
  status: LottoTicketStatus;
  source: string | null;
  drawId: string | null;
  generatedAt: string;
  draw: LottoTicketDraw | null;
}

export interface LottoWinning {
  id: string;
  ticketId: string;
  ticketNumber: string;
  prizeTier: string;
  amount: number;
  status: LottoWinningStatus;
  createdAt: string;
  creditedAt: string | null;
  celebrationSeenAt: string | null;
  resultId: string;
  drawId: string;
  winningNumber: string;
  publishedAt: string | null;
}

export interface LottoMe {
  rules: LottoRules;
  progress: LottoProgress;
  lottoBalance: number;
  nextDrawAt: string | null;
  latestResultPublishedAt: string | null;
  summary: LottoSummary;
  tickets: LottoTicket[];
  winnings: LottoWinning[];
}

export interface ClaimWinningResult {
  ok: true;
  amount: number;
  prizeTier: string;
  walletTxId: string;
}

export interface TransferLottoResult {
  ok: true;
  amount: number;
  newLottoBalance: number;
  newMainBalance: number;
  transactionId?: string;
}

/** Minimum lotto -> main wallet transfer, mirrors MIN_LOTTO_TRANSFER server-side. */
export const MIN_LOTTO_TRANSFER = 100;

// ---------------------------------------------------------------------------
// Fetch functions
// ---------------------------------------------------------------------------

export function getLottoMe(): Promise<LottoMe> {
  return api.get<LottoMe>('/api/lotto/me');
}

export function claimWinning(id: string): Promise<ClaimWinningResult> {
  return api.post<ClaimWinningResult>(`/api/lotto/winnings/${id}/claim`);
}

export function transferLotto(amount: number): Promise<TransferLottoResult> {
  return api.post<TransferLottoResult>('/api/lotto/transfer', { amount });
}

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------

export const lottoMeQueryKey = ['lotto', 'me'] as const;

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

/** The player's full lottery snapshot. Gated on an authed session. */
export function useLottoMe() {
  const { status } = useAuth();
  return useQuery<LottoMe>({
    queryKey: lottoMeQueryKey,
    queryFn: getLottoMe,
    enabled: status === 'authed',
    staleTime: 15_000,
  });
}

// ---------------------------------------------------------------------------
// Public results (GET /api/content/lotto/results) + banners (GET /api/lotto/banners)
// ---------------------------------------------------------------------------

/** One published draw result. winningNumber is the 1st prize; second / third /
 *  specials / consolations come from the Babu-style extraNumbers blob. */
export interface LottoResult {
  id: string;
  drawId: string;
  drawName: string | null;
  drawsAt: string | null;
  winningNumber: string;
  second: string | null;
  third: string | null;
  specials: string[];
  consolations: string[];
  publishedAt: string | null;
}

function strArray(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && x.length > 0) : [];
}

export async function getLottoResults(take = 60): Promise<LottoResult[]> {
  const res = await api.get<{ ok: true; results?: Array<Record<string, unknown>> }>(
    `/api/content/lotto/results?take=${take}`,
  );
  const rows = Array.isArray(res.results) ? res.results : [];
  return rows
    .map((r) => {
      const extra = (r.extraNumbers ?? {}) as Record<string, unknown>;
      return {
        id: String(r.id ?? ''),
        drawId: String(r.drawId ?? ''),
        drawName: typeof r.drawName === 'string' ? r.drawName : null,
        drawsAt: typeof r.drawsAt === 'string' ? r.drawsAt : null,
        winningNumber: typeof r.winningNumber === 'string' ? r.winningNumber : '',
        second: typeof extra.second === 'string' ? extra.second : null,
        third: typeof extra.third === 'string' ? extra.third : null,
        specials: strArray(extra.specials),
        consolations: strArray(extra.consolations),
        publishedAt: typeof r.publishedAt === 'string' ? r.publishedAt : null,
      };
    })
    .filter((r) => r.id.length > 0);
}

export function useLottoResults() {
  const { status } = useAuth();
  return useQuery<LottoResult[]>({
    queryKey: ['lotto', 'results'],
    queryFn: () => getLottoResults(60),
    enabled: status === 'authed',
    staleTime: 30_000,
  });
}

/** One lotto banner. imageUrl / posterUrl are raw backend paths; resolve with
 *  absoluteMediaUrl before rendering. Video banners fall back to the poster
 *  image (the app has no native video player wired for this surface yet). */
export interface LottoBanner {
  id: string;
  kind: string;
  imageUrl: string | null;
  posterUrl: string | null;
  title: string;
  titleBn: string | null;
  ctaUrl: string | null;
}

export async function getLottoBanners(): Promise<LottoBanner[]> {
  const res = await api.get<{ ok: true; banners?: Array<Record<string, unknown>> }>('/api/lotto/banners');
  const rows = Array.isArray(res.banners) ? res.banners : [];
  return rows
    .map((b) => ({
      id: String(b.id ?? ''),
      kind: typeof b.kind === 'string' ? b.kind : 'image',
      imageUrl: typeof b.imageUrl === 'string' ? b.imageUrl : null,
      posterUrl: typeof b.posterUrl === 'string' ? b.posterUrl : null,
      title: typeof b.titleEn === 'string' ? b.titleEn : '',
      titleBn: typeof b.titleBn === 'string' ? b.titleBn : null,
      ctaUrl: typeof b.ctaUrl === 'string' ? b.ctaUrl : null,
    }))
    .filter((b) => b.id.length > 0 && (b.imageUrl != null || b.posterUrl != null));
}

export function useLottoBanners() {
  const { status } = useAuth();
  return useQuery<LottoBanner[]>({
    queryKey: ['lotto', 'banners'],
    queryFn: getLottoBanners,
    enabled: status === 'authed',
    staleTime: 60_000,
  });
}

/**
 * Claim a single pending_credit winning. Real credit to Wallet.lottoBalance,
 * so on success we refresh the wallet balance + the lotto snapshot inline.
 */
export function useClaimWinning() {
  const queryClient = useQueryClient();
  return useMutation<ClaimWinningResult, unknown, string>({
    mutationFn: (id: string) => claimWinning(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wallet', 'balance'] });
      queryClient.invalidateQueries({ queryKey: ['wallet', 'bonuses'] });
      queryClient.invalidateQueries({ queryKey: lottoMeQueryKey });
    },
  });
}

/**
 * Move an amount from the lotto balance to the main wallet balance. Real money
 * movement, so on success we refresh the wallet balance + the lotto snapshot.
 */
export function useTransferLotto() {
  const queryClient = useQueryClient();
  return useMutation<TransferLottoResult, unknown, number>({
    mutationFn: (amount: number) => transferLotto(amount),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wallet', 'balance'] });
      queryClient.invalidateQueries({ queryKey: ['wallet', 'bonuses'] });
      queryClient.invalidateQueries({ queryKey: lottoMeQueryKey });
    },
  });
}
