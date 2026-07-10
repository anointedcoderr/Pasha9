// Built by Anointed Coder.
//
// React Query hooks over the live API.
//   - Phase 1: useBalance() reads the player's real wallet balances from
//     GET /api/bonuses/me.
//   - Phase 2 (wallet wiring): useBonuses(), usePaymentMethods(),
//     useDepositPreview(), useWithdrawalEligibility(), useWithdrawalLimits(),
//     useTransactions(), and the useCreateDeposit() / useCreateWithdrawal()
//     mutations that invalidate the balance + bonuses + transactions caches
//     on success.
//
// Every read only runs once the session is authed so a signed-out shell never
// fires an unauthorised request. The two public content reads (payment methods,
// withdrawal limits, deposit preview) are also gated on auth to keep them off
// the guest shell, matching the rest of the wallet surface.

import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { getBalance, type WalletBalance } from './auth';
import {
  getBonusesMe,
  getDepositPreview,
  getPaymentMethods,
  getTransactions,
  getWithdrawalEligibility,
  getWithdrawalLimits,
  createDeposit,
  createWithdrawal,
  type BonusesMe,
  type CreateDepositInput,
  type CreateWithdrawalInput,
  type DepositPreview,
  type DepositResult,
  type PaymentMethods,
  type TransactionsPage,
  type TransactionsQuery,
  type TransactionType,
  type WithdrawalEligibility,
  type WithdrawalLimits,
  type WithdrawalResult,
} from './wallet';
import { useAuth } from '@/store/auth';

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------

export const balanceQueryKey = ['wallet', 'balance'] as const;
export const bonusesQueryKey = ['wallet', 'bonuses'] as const;
export const paymentMethodsQueryKey = ['wallet', 'payment-methods'] as const;
export const withdrawalEligibilityQueryKey = ['wallet', 'withdrawal-eligibility'] as const;
export const withdrawalLimitsQueryKey = ['wallet', 'withdrawal-limits'] as const;

export const transactionsQueryKey = (type?: TransactionType | null, take?: number) =>
  ['wallet', 'transactions', type ?? 'all', take ?? 25] as const;

export const depositPreviewQueryKey = (amount: number, promotionId?: string | null) =>
  ['wallet', 'deposit-preview', amount, promotionId ?? null] as const;

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

/** Phase 1 balance read, kept intact for existing callers. */
export function useBalance() {
  const { status } = useAuth();
  return useQuery<WalletBalance>({
    queryKey: balanceQueryKey,
    queryFn: getBalance,
    enabled: status === 'authed',
    staleTime: 15_000,
  });
}

/** Full bonuses + balances read (balances, totals, grants/turnover). */
export function useBonuses() {
  const { status } = useAuth();
  return useQuery<BonusesMe>({
    queryKey: bonusesQueryKey,
    queryFn: getBonusesMe,
    enabled: status === 'authed',
    staleTime: 15_000,
  });
}

/** Deposit + payout channels with their per-method min/max limits. */
export function usePaymentMethods() {
  const { status } = useAuth();
  return useQuery<PaymentMethods>({
    queryKey: paymentMethodsQueryKey,
    queryFn: getPaymentMethods,
    enabled: status === 'authed',
    staleTime: 5 * 60_000,
  });
}

/** Live deposit-bonus preview. Only runs for a valid in-range amount. */
export function useDepositPreview(amount: number, promotionId?: string | null) {
  const { status } = useAuth();
  return useQuery<DepositPreview>({
    queryKey: depositPreviewQueryKey(amount, promotionId),
    queryFn: () => getDepositPreview(amount, promotionId),
    enabled: status === 'authed' && amount >= 100,
    staleTime: 30_000,
  });
}

/** Combined turnover gate for the withdraw screen. */
export function useWithdrawalEligibility() {
  const { status } = useAuth();
  return useQuery<WithdrawalEligibility>({
    queryKey: withdrawalEligibilityQueryKey,
    queryFn: getWithdrawalEligibility,
    enabled: status === 'authed',
    staleTime: 10_000,
  });
}

/** Global withdrawal min/max + policy note. */
export function useWithdrawalLimits() {
  const { status } = useAuth();
  return useQuery<WithdrawalLimits>({
    queryKey: withdrawalLimitsQueryKey,
    queryFn: getWithdrawalLimits,
    enabled: status === 'authed',
    staleTime: 5 * 60_000,
  });
}

/**
 * Paginated transaction ledger. The endpoint returns the newest `take` rows
 * (no cursor), so "Load more" is a larger take passed by the screen.
 */
export function useTransactions(query: TransactionsQuery = {}) {
  const { status } = useAuth();
  const take = query.take ?? 25;
  const type = query.type ?? null;
  return useQuery<TransactionsPage>({
    queryKey: transactionsQueryKey(type, take),
    queryFn: () => getTransactions({ type, take }),
    enabled: status === 'authed',
    staleTime: 10_000,
    // Keep the current rows mounted while a larger "take" loads, so Load more
    // does not blank the list to skeletons or lose scroll position.
    placeholderData: keepPreviousData,
  });
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

/**
 * Invalidate every wallet read that a money movement can affect: the two
 * balance reads and all cached transaction pages / filters.
 */
function useInvalidateWallet() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: balanceQueryKey });
    queryClient.invalidateQueries({ queryKey: bonusesQueryKey });
    queryClient.invalidateQueries({ queryKey: withdrawalEligibilityQueryKey });
    // All transaction pages regardless of filter / take.
    queryClient.invalidateQueries({ queryKey: ['wallet', 'transactions'] });
  };
}

/** Submit a deposit; on success refresh balances + transactions. */
export function useCreateDeposit() {
  const invalidate = useInvalidateWallet();
  return useMutation<DepositResult, unknown, CreateDepositInput>({
    mutationFn: createDeposit,
    onSuccess: invalidate,
  });
}

/** Submit a withdrawal; on success refresh balances + transactions. */
export function useCreateWithdrawal() {
  const invalidate = useInvalidateWallet();
  return useMutation<WithdrawalResult, unknown, CreateWithdrawalInput>({
    mutationFn: createWithdrawal,
    onSuccess: invalidate,
  });
}
