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
