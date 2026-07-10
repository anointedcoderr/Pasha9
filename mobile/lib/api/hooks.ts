// Built by Anointed Coder.
//
// React Query hooks over the live API. Phase 1 ships one: useBalance(), which
// reads the player's real wallet balances from GET /api/bonuses/me. The query
// only runs once the session is authed so a signed-out shell never fires an
// unauthorised request.

import { useQuery } from '@tanstack/react-query';
import { getBalance, type WalletBalance } from './auth';
import { useAuth } from '@/store/auth';

export const balanceQueryKey = ['wallet', 'balance'] as const;

export function useBalance() {
  const { status } = useAuth();
  return useQuery<WalletBalance>({
    queryKey: balanceQueryKey,
    queryFn: getBalance,
    enabled: status === 'authed',
    staleTime: 15_000,
  });
}
