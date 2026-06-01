// Built by Anointed Coder.
//
// Provider adapter contract. Every external game provider that
// Pasha 9 integrates implements this interface, exposing the
// adapter through lib/providers/registry.ts so the public + admin
// routes stay provider-agnostic. iGamingAPIs / SoftAPI is the first
// implementation; future aggregators slot in with no change to
// routes or schema.

import type { ProviderCreds } from './credentials';

export interface ProviderBrand {
  brandKey: string;
  displayName: string;
  raw?: unknown;
}

export interface ProviderGame {
  gameUid: string;
  displayName: string;
  category?: string;
  imageUrl?: string;
  brandKey?: string;
  raw?: unknown;
}

export interface LaunchOptions {
  userId: string;          // Pasha 9 user id
  memberAccount: string;   // value sent to provider as member identifier
  balance: number;         // current wallet balance shown to provider
  gameUid: string;
  token: string;           // single-use launch token we issue (currently equals API token per docs)
  returnUrl: string;       // where the game should send the player back
  callbackUrl: string;     // provider hits this for wallet events
  currencyCode?: string;
  language?: string;
}

export interface LaunchResult {
  launchUrl: string;
  mode: 'redirect' | 'iframe';
  rawCode?: number;
  rawMessage?: string;
  raw?: unknown;
}

export interface HealthCheckResult {
  ok: boolean;
  latencyMs: number;
  detail?: string;
  raw?: unknown;
}

// Normalised callback shape. Adapters convert their provider-specific
// callback body into this; the wallet pipeline operates on this only.
//
// type semantics (M3 Phase 3E):
//   bet     . provider sent bet_amount > 0 and win_amount == 0
//   win     . provider sent bet_amount == 0 and win_amount > 0
//   settle  . provider sent BOTH bet_amount > 0 AND win_amount > 0
//   rollback. provider explicitly reverses a prior round
//
// The wallet pipeline uses this type to build a per-event
// idempotency key so a separate BET callback and a separate WIN
// callback for the same game_round do NOT collide.
export interface NormalizedCallback {
  type: 'bet' | 'win' | 'settle' | 'rollback';
  memberAccount: string;
  gameUid: string | null;
  gameRound: string;
  betAmount: number;
  winAmount: number;
  providerTxId: string | null;
  timestamp: Date | null;
  rawBody: unknown;
}

export interface CallbackResponseInput {
  newBalance: number;
  betAmount: number;
  winAmount: number;
  responseMode: 'updated_balance' | 'net_loss_amount';
  ok: boolean;
  errorCode?: string;
}

export interface CallbackResponseEnvelope {
  status: number;
  body: unknown;
}

export interface ProviderAdapter {
  /** lowercase identifier matching GameProvider.adapterKey */
  key: string;
  /** human-readable label for the admin add-provider dropdown */
  label: string;

  listBrands(creds: ProviderCreds): Promise<{ result: ProviderBrand[]; rawRequest: unknown; rawResponse: unknown }>;
  listGames(creds: ProviderCreds, brandKey: string): Promise<{ result: ProviderGame[]; rawRequest: unknown; rawResponse: unknown }>;
  launch(creds: ProviderCreds, opts: LaunchOptions): Promise<{ result: LaunchResult; rawRequest: unknown; rawResponse: unknown }>;
  healthCheck(creds: ProviderCreds): Promise<HealthCheckResult>;

  /**
   * Validates incoming callback security (signature/encryption if
   * applicable) and converts the provider-specific body into the
   * NormalizedCallback shape. Throws if the body is malformed; the
   * route handler catches and logs.
   */
  parseCallback(creds: ProviderCreds, headers: Record<string, string | string[] | undefined>, rawBody: unknown): Promise<NormalizedCallback>;

  /** Builds the success/error response we send back to the provider. */
  buildCallbackResponse(creds: ProviderCreds, input: CallbackResponseInput): CallbackResponseEnvelope;
}

export class ProviderAdapterError extends Error {
  /**
   * Optional snippet of the upstream response body (already masked
   * by the adapter). Surfaced to the admin UI so the operator can
   * see what the provider actually returned without digging through
   * raw logs.
   */
  public snippet?: string;

  constructor(
    public code:
      | 'PROVIDER_NOT_FOUND'
      | 'PROVIDER_INACTIVE'
      | 'CREDENTIALS_MISSING'
      | 'CREDENTIALS_INVALID'
      | 'UPSTREAM_HTTP_ERROR'
      | 'UPSTREAM_BAD_RESPONSE'
      | 'UPSTREAM_NOT_JSON'
      | 'UPSTREAM_EMPTY'
      | 'CALLBACK_INVALID'
      | 'CALLBACK_REPLAY'
      | 'CALLBACK_UNAUTHORIZED',
    message: string,
    public status: number = 400,
    snippet?: string,
  ) {
    super(message);
    this.name = 'ProviderAdapterError';
    if (snippet) this.snippet = snippet;
  }
}
