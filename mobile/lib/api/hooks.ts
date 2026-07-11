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
  useInfiniteQuery,
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
import {
  getWingoState,
  getWingoMyBets,
  placeWingoBet,
  type PlaceWingoBetInput,
  type PlaceWingoBetResult,
  type WingoMode,
  type WingoMyBetsPage,
  type WingoState,
} from './wingo';
import {
  getNativeGame,
  createNativeSession,
  placeDiceBet,
  startMinesRound,
  revealMinesTile,
  cashoutMines,
  placeKenoBet,
  placeRouletteBet,
  placeCrashBet,
  type NativeGameCode,
  type NativeGameView,
  type NativeSession,
  type PlaceDiceBetInput,
  type DiceBetResult,
  type StartMinesInput,
  type MinesStartResult,
  type MinesRevealResult,
  type MinesCashoutResult,
  type PlaceKenoBetInput,
  type KenoBetResult,
  type PlaceRouletteBetInput,
  type RouletteBetResult,
  type PlaceCrashBetInput,
  type CrashBetResult,
} from './native-games';
import {
  getProviders,
  getProviderGames,
  launchGame,
  type LaunchGameInput,
  type LaunchResult,
  type Provider,
  type ProviderGamesParams,
  type ProviderGamesResult,
} from './providers';
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

export const wingoStateQueryKey = (mode: WingoMode) => ['wingo', 'state', mode] as const;
export const wingoMyBetsQueryKey = (mode: WingoMode) => ['wingo', 'my-bets', mode] as const;

export const nativeGameQueryKey = (code: NativeGameCode) => ['native-games', 'game', code] as const;

export const providersQueryKey = ['providers', 'list'] as const;

/**
 * Query key for one provider-games page set. The filter object is part of the
 * key so a filter change (search, category, brand, featured, jackpot, limit)
 * mounts a fresh infinite query rather than appending onto the previous filter.
 */
export const providerGamesQueryKey = (
  params: Omit<ProviderGamesParams, 'offset'>,
) =>
  [
    'providers',
    'games',
    params.providerKey,
    {
      q: params.q?.trim() || '',
      category: params.category || '',
      brand: params.brand || '',
      featured: !!params.featured,
      jackpot: !!params.jackpot,
      limit: params.limit ?? 30,
    },
  ] as const;

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

// ---------------------------------------------------------------------------
// WinGo (Phase 3): live rounds + real betting
// ---------------------------------------------------------------------------

/**
 * Live WinGo state for one mode. Polls every ~1500ms while the screen is
 * mounted so the countdown, phase and results stay current (the server settles
 * due rounds on read, so the poll also drives settlement). Public read: it runs
 * without auth so the board renders before the player signs in.
 */
export function useWingoState(mode: WingoMode, poll = true) {
  return useQuery<WingoState>({
    queryKey: wingoStateQueryKey(mode),
    queryFn: () => getWingoState(mode),
    // The game screen polls every 1.5s for the live round; a caller that only
    // needs the enabled flag (the lobby, to gate a card) passes poll=false and
    // reads a briefly-cached value instead of hammering the endpoint.
    refetchInterval: poll ? 1500 : false,
    staleTime: poll ? 0 : 60_000,
    // Keep the previous mode's board on screen while a tab switch loads, so
    // the layout does not blank between modes.
    placeholderData: keepPreviousData,
  });
}

/**
 * The player's WinGo bet history for a mode, newest first. Gated on auth and
 * polled modestly so a PENDING bet flips to WON/LOST shortly after its draw
 * without a manual refresh.
 */
export function useWingoMyBets(mode: WingoMode) {
  const { status } = useAuth();
  return useQuery<WingoMyBetsPage>({
    queryKey: wingoMyBetsQueryKey(mode),
    queryFn: () => getWingoMyBets({ mode, limit: 30 }),
    enabled: status === 'authed',
    refetchInterval: 5000,
    staleTime: 2000,
  });
}

/**
 * Place a WinGo bet slip. On success invalidate the wallet balance (real debit),
 * this mode's my-bets feed (the new rows) and the live state (round window may
 * have advanced), so every surface reflects the placement.
 */
export function usePlaceWingoBet() {
  const queryClient = useQueryClient();
  const invalidateWallet = useInvalidateWallet();
  return useMutation<PlaceWingoBetResult, unknown, PlaceWingoBetInput>({
    mutationFn: placeWingoBet,
    onSuccess: (result) => {
      invalidateWallet();
      queryClient.invalidateQueries({ queryKey: wingoMyBetsQueryKey(result.mode) });
      queryClient.invalidateQueries({ queryKey: wingoStateQueryKey(result.mode) });
    },
  });
}

// ---------------------------------------------------------------------------
// Native games (Phase 3b): dice, mines, keno, roulette, crash
// ---------------------------------------------------------------------------

/**
 * Live per-game config for one native game. Public read (no auth) so the board
 * renders before sign-in. Polled modestly so an admin flip of the global
 * enabled flag or the per-game isActive flag reaches the screen without a
 * manual refresh; the screen gates the whole bet surface on
 * `enabled && game.isActive`.
 */
export function useNativeGame(code: NativeGameCode) {
  return useQuery<NativeGameView>({
    queryKey: nativeGameQueryKey(code),
    queryFn: () => getNativeGame(code),
    refetchInterval: 20_000,
    staleTime: 10_000,
  });
}

/**
 * Open a fresh provably-fair session for a native game. Session creation moves
 * no money, so it does not invalidate the wallet. The screen creates one session
 * once the game is confirmed available and reuses it across bets.
 */
export function useCreateNativeSession(code: NativeGameCode) {
  return useMutation<NativeSession, unknown, string | undefined>({
    mutationFn: (clientSeed?: string) => createNativeSession(code, clientSeed),
  });
}

/** Place a Dice bet; on success refresh the wallet (real settle moves balance). */
export function useDiceBet() {
  const invalidateWallet = useInvalidateWallet();
  return useMutation<DiceBetResult, unknown, PlaceDiceBetInput>({
    mutationFn: placeDiceBet,
    onSuccess: invalidateWallet,
  });
}

/** Start a Mines round; on success refresh the wallet (the bet debits). */
export function useStartMines() {
  const invalidateWallet = useInvalidateWallet();
  return useMutation<MinesStartResult, unknown, StartMinesInput>({
    mutationFn: startMinesRound,
    onSuccess: invalidateWallet,
  });
}

/**
 * Reveal one Mines tile. A safe reveal moves no money; a mine hit settles the
 * round as a loss (the bet was already debited at start). Invalidate the wallet
 * regardless so the header balance stays authoritative.
 */
export function useMinesReveal() {
  const invalidateWallet = useInvalidateWallet();
  return useMutation<MinesRevealResult, unknown, { roundId: string; tile: number }>({
    mutationFn: ({ roundId, tile }) => revealMinesTile(roundId, tile),
    onSuccess: invalidateWallet,
  });
}

/** Cash out a pending Mines round; on success refresh the wallet (credits the win). */
export function useMinesCashout() {
  const invalidateWallet = useInvalidateWallet();
  return useMutation<MinesCashoutResult, unknown, { roundId: string }>({
    mutationFn: ({ roundId }) => cashoutMines(roundId),
    onSuccess: invalidateWallet,
  });
}

/** Place a Keno bet; on success refresh the wallet. */
export function useKenoBet() {
  const invalidateWallet = useInvalidateWallet();
  return useMutation<KenoBetResult, unknown, PlaceKenoBetInput>({
    mutationFn: placeKenoBet,
    onSuccess: invalidateWallet,
  });
}

/** Place a Roulette bet; on success refresh the wallet. */
export function useRouletteBet() {
  const invalidateWallet = useInvalidateWallet();
  return useMutation<RouletteBetResult, unknown, PlaceRouletteBetInput>({
    mutationFn: placeRouletteBet,
    onSuccess: invalidateWallet,
  });
}

/** Place a Crash (single-shot auto cash out) bet; on success refresh the wallet. */
export function useCrashBet() {
  const invalidateWallet = useInvalidateWallet();
  return useMutation<CrashBetResult, unknown, PlaceCrashBetInput>({
    mutationFn: placeCrashBet,
    onSuccess: invalidateWallet,
  });
}

// ---------------------------------------------------------------------------
// Provider (aggregator) games (Phase 4): live catalog + in-app launch
// ---------------------------------------------------------------------------

/**
 * The Live providers. Public read (no auth) so the lobby can pick the main
 * provider and render its brand pills before the player signs in. Cached for a
 * few minutes since the provider list only changes when an admin flips one Live.
 */
export function useProviders() {
  return useQuery<Provider[]>({
    queryKey: providersQueryKey,
    queryFn: getProviders,
    staleTime: 5 * 60_000,
  });
}

/**
 * Paginated provider-games read backed by an infinite query. The screen grows
 * the list with fetchNextPage(); getNextPageParam advances the offset by the
 * number of rows already loaded until it reaches counts.total. Every page also
 * carries the whole-catalog counts (total, byCategory, byBrand) so the caller
 * reads stable category/brand chips from pages[0]. Disabled until a providerKey
 * is known, and public so the grid renders for a guest shell.
 */
export function useProviderGames(params: ProviderGamesParams) {
  const limit = params.limit ?? 30;
  return useInfiniteQuery<ProviderGamesResult>({
    queryKey: providerGamesQueryKey(params),
    queryFn: ({ pageParam }) =>
      getProviderGames({ ...params, limit, offset: (pageParam as number) ?? 0 }),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      const loaded = allPages.reduce((n, p) => n + p.games.length, 0);
      return loaded < lastPage.counts.total ? loaded : undefined;
    },
    enabled: !!params.providerKey,
    staleTime: 60_000,
    // Keep the current games mounted while a new filter's first page loads so
    // the grid does not blank to skeletons on every chip tap.
    placeholderData: keepPreviousData,
  });
}

/**
 * Open a provider game. Returns the resolved launch URL (or throws ApiError:
 * 401 not signed in, 402 INSUFFICIENT_FUNDS with { balance, minBalance },
 * 503 PROVIDER_INACTIVE, etc.). The launch itself moves no money, so it does
 * not invalidate the wallet here; the shared launch handler refreshes the
 * balance once the in-app browser closes (a play session may have settled bets).
 */
export function useLaunchGame() {
  return useMutation<LaunchResult, unknown, LaunchGameInput>({
    mutationFn: launchGame,
  });
}
