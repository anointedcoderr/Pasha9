// Built by Anointed Coder.
//
// Shared provider-game launch handler. One hook drives every launch surface
// (the lobby hot strip and all three grid screens) so the money-gate, the
// auth-gate and the in-app browser behave identically everywhere.
//
// Flow:
//   1. Guard a double-launch with a synchronous in-flight ref (a second tap
//      while a launch is resolving is ignored) plus a launchingKey the tiles
//      read to show a spinner and disable themselves.
//   2. Not signed in            -> route to /auth/login.
//   3. Below the provider min    -> surface a deposit prompt with the exact
//      balance + required figures (server-authoritative on the 402, or a soft
//      local pre-check when the cached balance already proves it is short).
//   4. Provider inactive / other -> surface ApiError.message.
//   5. Success                   -> open the returned launchUrl with the
//      in-app browser, then refresh the wallet once it closes (a play session
//      may have settled bets while the game was open).

import { useCallback, useRef, useState } from 'react';
import * as WebBrowser from 'expo-web-browser';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { ApiError } from '@/lib/api/client';
import {
  balanceQueryKey,
  bonusesQueryKey,
  useBalance,
  useLaunchGame,
} from '@/lib/api/hooks';
import { useAuth } from '@/store/auth';

/** The minimum a launch target needs to carry to be launched + gated. */
export interface LaunchTarget {
  providerKey: string;
  gameUid: string;
  displayName?: string;
  /** Per-provider launchMinBalance, used for the soft local pre-check. */
  launchMinBalance?: number;
}

/** A deposit prompt raised when the player is under the provider minimum. */
export interface DepositPrompt {
  balance: number;
  required: number;
  gameName?: string;
}

export interface GameLaunch {
  /** Attempt to launch a provider game. Safe to call repeatedly; re-entrancy is guarded. */
  launch: (target: LaunchTarget) => void;
  /** `${providerKey}:${gameUid}` of the launch in flight, else null. */
  launchingKey: string | null;
  /** A human-readable error from the last failed launch, else null. */
  error: string | null;
  /** A deposit prompt when the last launch was under the provider minimum. */
  deposit: DepositPrompt | null;
  /** Dismiss the current error + deposit prompt. */
  clear: () => void;
}

const keyOf = (t: LaunchTarget) => `${t.providerKey}:${t.gameUid}`;

// Backend error codes whose message is written for players and safe to surface
// verbatim. Every other code (PROVIDER_BASE_URL_INVALID, ADAPTER_NOT_REGISTERED,
// LAUNCH_FAILED, VALIDATION, SERVER_ERROR, adapter errors) carries admin or
// developer-facing detail, so those fall back to a friendly generic line.
const PLAYER_SAFE_ERROR_CODES = new Set<string>([
  'INSUFFICIENT_FUNDS',
  'PROVIDER_INACTIVE',
  'RATE_LIMITED',
]);

const GENERIC_LAUNCH_ERROR =
  'This game could not be opened right now. Please try again shortly.';

export function useGameLaunch(): GameLaunch {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { status } = useAuth();
  const balanceQuery = useBalance();
  const launchMutation = useLaunchGame();

  const [launchingKey, setLaunchingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deposit, setDeposit] = useState<DepositPrompt | null>(null);

  // Synchronous re-entrancy guard: a double-tap fires two handlers within the
  // same frame, before any state update lands, so a ref (not launchingKey) is
  // what actually blocks the second launch.
  const inFlightRef = useRef(false);

  const clear = useCallback(() => {
    setError(null);
    setDeposit(null);
  }, []);

  const launch = useCallback(
    (target: LaunchTarget) => {
      if (inFlightRef.current) return;

      setError(null);
      setDeposit(null);

      if (status !== 'authed') {
        router.push('/auth/login');
        return;
      }

      // Soft local money-gate: if the cached balance already proves the player
      // is under the provider minimum, prompt for a deposit without spending a
      // launch call. The server still enforces the same gate authoritatively.
      const min = target.launchMinBalance ?? 0;
      if (min > 0 && balanceQuery.isSuccess) {
        const balance = balanceQuery.data.balance;
        if (balance < min) {
          setDeposit({ balance, required: min, gameName: target.displayName });
          return;
        }
      }

      const key = keyOf(target);
      inFlightRef.current = true;
      setLaunchingKey(key);

      (async () => {
        try {
          const res = await launchMutation.mutateAsync({
            providerKey: target.providerKey,
            gameUid: target.gameUid,
          });
          if (!res.launchUrl) {
            setError('No launch link was returned. Please try again in a moment.');
            return;
          }
          await WebBrowser.openBrowserAsync(res.launchUrl, {
            enableBarCollapsing: true,
            showTitle: true,
          });
          // Back from the game: a play session may have settled bets, so refresh
          // the wallet reads the header + screens rely on.
          queryClient.invalidateQueries({ queryKey: balanceQueryKey });
          queryClient.invalidateQueries({ queryKey: bonusesQueryKey });
        } catch (err) {
          if (err instanceof ApiError) {
            if (err.status === 401) {
              router.push('/auth/login');
              return;
            }
            if (err.status === 402 || err.code === 'INSUFFICIENT_FUNDS') {
              const meta = err.meta ?? {};
              const balance = Number((meta as Record<string, unknown>).balance);
              const minBalance = Number((meta as Record<string, unknown>).minBalance);
              setDeposit({
                balance: Number.isFinite(balance) ? balance : balanceQuery.data?.balance ?? 0,
                required: Number.isFinite(minBalance) && minBalance > 0 ? minBalance : Math.max(1, min),
                gameName: target.displayName,
              });
              return;
            }
            // Only echo backend copy for codes whose message is player-safe;
            // otherwise show a friendly generic line so admin/developer detail
            // (e.g. PROVIDER_BASE_URL_INVALID) never leaks to players.
            const playerSafe =
              PLAYER_SAFE_ERROR_CODES.has(err.code) && err.message !== err.code;
            setError(playerSafe ? err.message : GENERIC_LAUNCH_ERROR);
            return;
          }
          setError('Could not open the game. Check your connection and try again.');
        } finally {
          inFlightRef.current = false;
          setLaunchingKey(null);
        }
      })();
    },
    [status, router, queryClient, launchMutation, balanceQuery.isSuccess, balanceQuery.data],
  );

  return { launch, launchingKey, error, deposit, clear };
}
