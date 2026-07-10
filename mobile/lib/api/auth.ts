// Built by Anointed Coder.
//
// Typed API functions that hit the real Pasha9 auth + wallet endpoints per the
// agreed mobile contract. These are thin: they shape the request body, call the
// client, and return typed payloads. Token storage / retry live in the client
// and the auth store, not here.

import { api, type TokenBundle } from './client';

// ---------------------------------------------------------------------------
// Shared shapes
// ---------------------------------------------------------------------------

/** The user object the backend returns from login / register / me. */
export interface AuthUser {
  id: string;
  username: string;
  phone: string;
  role: string;
  status?: string;
  avatarUrl?: string | null;
  referralCode?: string | null;
  vipTier?: string | null;
  wallet?: {
    balance: number;
    bonusBalance: number;
    lockedBalance: number;
    lottoBalance?: number;
    currency?: string;
  } | null;
}

/** login / register success: user plus the mobile bearer token bundle. */
export interface AuthSuccess extends TokenBundle {
  ok: true;
  user: AuthUser;
}

/** login can also return a TOTP challenge (unchanged web branch). No tokens. */
export interface AuthChallenge {
  ok: true;
  challenge: true;
  challengeToken: string;
  flags?: string[];
}

export type LoginResult =
  | { kind: 'authenticated'; user: AuthUser; tokens: TokenBundle }
  | { kind: 'challenge'; challengeToken: string; flags: string[] };

// ---------------------------------------------------------------------------
// login
// ---------------------------------------------------------------------------

export interface LoginInput {
  /** Phone or username. Sent to the backend as `identifier`. */
  username: string;
  password: string;
}

export async function login(input: LoginInput): Promise<LoginResult> {
  const res = await api.post<AuthSuccess | AuthChallenge>(
    '/api/auth/login',
    { identifier: input.username.trim(), password: input.password },
    { auth: false },
  );

  if ('challenge' in res && res.challenge) {
    return { kind: 'challenge', challengeToken: res.challengeToken, flags: res.flags ?? [] };
  }

  const ok = res as AuthSuccess;
  return {
    kind: 'authenticated',
    user: ok.user,
    tokens: { token: ok.token, refresh: ok.refresh, expiresIn: ok.expiresIn },
  };
}

// ---------------------------------------------------------------------------
// register
// ---------------------------------------------------------------------------

export interface RegisterInput {
  username: string;
  phone: string;
  password: string;
  referral?: string;
}

export async function register(input: RegisterInput): Promise<{ user: AuthUser; tokens: TokenBundle }> {
  const res = await api.post<AuthSuccess>(
    '/api/auth/register',
    {
      username: input.username.trim(),
      phone: input.phone.trim(),
      password: input.password,
      referral: input.referral?.trim() || undefined,
    },
    { auth: false },
  );
  return {
    user: res.user,
    tokens: { token: res.token, refresh: res.refresh, expiresIn: res.expiresIn },
  };
}

// ---------------------------------------------------------------------------
// refresh / logout
// ---------------------------------------------------------------------------

export async function refresh(refreshToken: string): Promise<TokenBundle> {
  const res = await api.post<{ ok: true } & TokenBundle>(
    '/api/auth/token/refresh',
    { refresh: refreshToken },
    { auth: false, headers: { Authorization: `Bearer ${refreshToken}` } },
  );
  return { token: res.token, refresh: res.refresh, expiresIn: res.expiresIn };
}

export async function logout(refreshToken: string | null): Promise<void> {
  // Best-effort: invalidate the refresh token server-side. The store clears
  // local state regardless of the outcome.
  await api.post<{ ok: true }>(
    '/api/auth/logout',
    refreshToken ? { refresh: refreshToken } : {},
    refreshToken ? { auth: false, headers: { Authorization: `Bearer ${refreshToken}` } } : {},
  );
}

// ---------------------------------------------------------------------------
// session bootstrap + core reads
// ---------------------------------------------------------------------------

export interface MeResponse {
  ok: true;
  user: AuthUser;
  permissions: string[];
}

/** GET /api/auth/me. Validates the current access token and returns the user. */
export async function me(): Promise<AuthUser> {
  const res = await api.get<MeResponse>('/api/auth/me');
  return res.user;
}

export interface WalletBalance {
  balance: number;
  bonusBalance: number;
  lockedBalance: number;
}

/**
 * GET /api/bonuses/me. Returns the player's live wallet balances. When the
 * backend has no wallet row it returns null; we normalise to zeros so the UI
 * always has a number to render.
 */
export async function getBalance(): Promise<WalletBalance> {
  const res = await api.get<{ ok: true; wallet: WalletBalance | null }>('/api/bonuses/me');
  return res.wallet ?? { balance: 0, bonusBalance: 0, lockedBalance: 0 };
}

/** Session bootstrap read used on launch: proves the token and loads the user. */
export async function getMe(): Promise<AuthUser> {
  return me();
}

// ---------------------------------------------------------------------------
// forgot password (SMS OTP self-serve flow)
// ---------------------------------------------------------------------------

/** POST /api/auth/forgot/sms/start { phone }. Enumeration-safe; always ok. */
export async function forgotStart(phone: string): Promise<void> {
  await api.post<{ ok: true }>('/api/auth/forgot/sms/start', { phone: phone.trim() }, { auth: false });
}

/** POST /api/auth/forgot/sms/complete { phone, code, newPassword }. */
export async function forgotComplete(input: {
  phone: string;
  code: string;
  newPassword: string;
}): Promise<void> {
  await api.post<{ ok: true }>(
    '/api/auth/forgot/sms/complete',
    { phone: input.phone.trim(), code: input.code.trim(), newPassword: input.newPassword },
    { auth: false },
  );
}
