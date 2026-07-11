// Built by Anointed Coder.
//
// AuthProvider: the single source of truth for the player session on mobile.
//   - Persists the access + refresh token pair in expo-secure-store.
//   - Holds the live tokens in refs so the API client bridge can read the
//     current values synchronously during a request / refresh.
//   - Bootstraps on launch: read the stored tokens, validate them with me()
//     (the client transparently refreshes a stale access token), and either
//     lands the player as "authed" or clears to "guest".
//   - Exposes signIn / register / signOut for the auth screens.
//
// The client never imports this context; instead we register a bridge with it
// (registerAuthBridge) so token reads and rotations flow one way.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import * as SecureStore from 'expo-secure-store';
import { useQueryClient } from '@tanstack/react-query';
import { STORAGE_KEYS } from '@/lib/config';
import {
  registerAuthBridge,
  type TokenBundle,
} from '@/lib/api/client';
import {
  login as apiLogin,
  register as apiRegister,
  logout as apiLogout,
  getMe,
  type AuthUser,
  type LoginInput,
  type RegisterInput,
  type LoginResult,
} from '@/lib/api/auth';

export type AuthStatus = 'loading' | 'authed' | 'guest';

export interface AuthContextValue {
  user: AuthUser | null;
  status: AuthStatus;
  /** Resolves to the login result so the screen can handle a TOTP challenge. */
  signIn: (input: LoginInput) => Promise<LoginResult>;
  register: (input: RegisterInput) => Promise<void>;
  signOut: () => Promise<void>;
  /** Merge a partial update into the cached user (e.g. after a profile edit). */
  patchUser: (partial: Partial<AuthUser>) => void;
  /** Re-read the user from GET /api/auth/me and replace the cached copy. */
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [status, setStatus] = useState<AuthStatus>('loading');
  // Cached server data is per-user. Wiping it on every session teardown stops a
  // second account (or a signed-out shell) from ever seeing the prior player's
  // balance or history from the react-query cache.
  const queryClient = useQueryClient();

  // Live token values. Refs so the client bridge always reads the latest
  // without waiting for a React re-render.
  const accessRef = useRef<string | null>(null);
  const refreshRef = useRef<string | null>(null);

  const persistTokens = useCallback(async (bundle: TokenBundle) => {
    accessRef.current = bundle.token;
    refreshRef.current = bundle.refresh;
    await Promise.all([
      SecureStore.setItemAsync(STORAGE_KEYS.accessToken, bundle.token),
      SecureStore.setItemAsync(STORAGE_KEYS.refreshToken, bundle.refresh),
    ]);
  }, []);

  const clearTokens = useCallback(async () => {
    accessRef.current = null;
    refreshRef.current = null;
    await Promise.all([
      SecureStore.deleteItemAsync(STORAGE_KEYS.accessToken),
      SecureStore.deleteItemAsync(STORAGE_KEYS.refreshToken),
    ]);
  }, []);

  // Register the client bridge once. The callbacks read/write the refs and
  // secure-store, and flip the session to guest when refresh is impossible.
  useEffect(() => {
    registerAuthBridge({
      getAccessToken: () => accessRef.current,
      getRefreshToken: () => refreshRef.current,
      onTokensRotated: (bundle) => persistTokens(bundle),
      onSessionCleared: async () => {
        await clearTokens();
        queryClient.clear();
        setUser(null);
        setStatus('guest');
      },
    });
    return () => registerAuthBridge(null);
  }, [persistTokens, clearTokens, queryClient]);

  // Launch bootstrap.
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [access, refresh] = await Promise.all([
          SecureStore.getItemAsync(STORAGE_KEYS.accessToken),
          SecureStore.getItemAsync(STORAGE_KEYS.refreshToken),
        ]);
        if (!refresh) {
          if (active) setStatus('guest');
          return;
        }
        accessRef.current = access ?? null;
        refreshRef.current = refresh;

        // Validate. The client refreshes a stale access token automatically;
        // if the refresh is also dead it fires onSessionCleared -> guest.
        const me = await getMe();
        if (!active) return;
        setUser(me);
        setStatus('authed');
      } catch {
        if (!active) return;
        await clearTokens();
        setUser(null);
        setStatus('guest');
      }
    })();
    return () => {
      active = false;
    };
  }, [clearTokens]);

  const signIn = useCallback(
    async (input: LoginInput): Promise<LoginResult> => {
      const result = await apiLogin(input);
      if (result.kind === 'authenticated') {
        await persistTokens(result.tokens);
        setUser(result.user);
        setStatus('authed');
      }
      // A challenge result leaves the session as-is; the screen decides.
      return result;
    },
    [persistTokens],
  );

  const register = useCallback(
    async (input: RegisterInput): Promise<void> => {
      const { user: newUser, tokens } = await apiRegister(input);
      await persistTokens(tokens);
      setUser(newUser);
      setStatus('authed');
    },
    [persistTokens],
  );

  // Merge a partial update into the cached user without a round trip. Used after
  // a profile edit / avatar upload so the header and account screens reflect the
  // change immediately. A no-op when there is no signed-in user.
  const patchUser = useCallback((partial: Partial<AuthUser>): void => {
    setUser((prev) => (prev ? { ...prev, ...partial } : prev));
  }, []);

  // Re-fetch the authoritative user from the backend and replace the cache.
  const refreshUser = useCallback(async (): Promise<void> => {
    const fresh = await getMe();
    setUser(fresh);
  }, []);

  const signOut = useCallback(async (): Promise<void> => {
    const refresh = refreshRef.current;
    try {
      await apiLogout(refresh);
    } catch {
      // Ignore: local state is cleared regardless so the user is signed out.
    }
    await clearTokens();
    queryClient.clear();
    setUser(null);
    setStatus('guest');
  }, [clearTokens, queryClient]);

  const value = useMemo<AuthContextValue>(
    () => ({ user, status, signIn, register, signOut, patchUser, refreshUser }),
    [user, status, signIn, register, signOut, patchUser, refreshUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
