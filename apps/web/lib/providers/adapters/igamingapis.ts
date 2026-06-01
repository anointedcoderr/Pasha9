// Built by Anointed Coder.
//
// iGamingAPIs / SoftAPI adapter implementation.
//
// Confirmed from the provider panel:
//   Base URL:    https://igamingapis.live/api/v1
//   Launch:      GET /api/v1?payload=<AES-256-ECB(JSON)>&token=<API_TOKEN>
//   Brands:      GET https://igamingapis.com/provider/
//   Games:       GET https://igamingapis.com/provider/brands.php?brand_id=<id>
//   Callback:    POST { game_id, game_round, member_account, bet_amount, win_amount, timestamp }
//   Response:    { credit_amount, timestamp(ms) }
//
// Open items still pending seller confirmation:
//   1. Whether the launch endpoint's path is `/api/v1` or `/api/v1/<resource>`.
//   2. Whether brands/games endpoints require the API token.
//   3. Whether game_id in the callback equals the gameUid we sent.
//   4. Whether credit_amount should be the updated balance OR net_loss
//      (bet - win). Operator picks via callbackResponseMode.
//   5. Whether iGamingAPIs sends any HMAC / signature header.
//   6. Rollback / cancel / refund semantics.
//
// Until those resolve, the adapter ships with the strictest sane
// interpretation: callbacks must carry the platform's `?key=` query
// param to be accepted, all bodies are logged, and the response is
// built from callbackResponseMode.

import {
  type ProviderAdapter,
  type ProviderBrand,
  type ProviderGame,
  type LaunchOptions,
  type LaunchResult,
  type HealthCheckResult,
  type NormalizedCallback,
  type CallbackResponseInput,
  type CallbackResponseEnvelope,
  ProviderAdapterError,
} from '../types';
import type { ProviderCreds } from '../credentials';
import { aesEcbEncryptBase64 } from '../crypto';

const ADAPTER_KEY = 'igamingapis';
const LABEL = 'iGamingAPIs / SoftAPI (JILI)';

const DEFAULT_BRANDS_URL = 'https://igamingapis.com/provider/';
const DEFAULT_GAMES_URL = 'https://igamingapis.com/provider/brands.php';

interface LaunchPayload {
  user_id: string;
  balance: number;
  game_uid: string;
  token: string;
  timestamp: number;
  return: string;
  callback: string;
  currency_code?: string;
  language?: string;
}

async function timedFetch(input: string, init?: RequestInit): Promise<{ status: number; durationMs: number; bodyText: string; bodyJson: unknown | null }> {
  const start = Date.now();
  let status = 0;
  let bodyText = '';
  let bodyJson: unknown | null = null;
  try {
    const res = await fetch(input, init);
    status = res.status;
    bodyText = await res.text();
    try { bodyJson = JSON.parse(bodyText); } catch { bodyJson = null; }
  } finally {
    // duration always recorded
  }
  return { status, durationMs: Date.now() - start, bodyText, bodyJson };
}

function asArray(x: unknown): unknown[] {
  return Array.isArray(x) ? x : [];
}

function pickString(obj: unknown, key: string, fallback = ''): string {
  if (obj && typeof obj === 'object' && key in obj) {
    const v = (obj as Record<string, unknown>)[key];
    if (typeof v === 'string') return v;
    if (typeof v === 'number') return String(v);
  }
  return fallback;
}

function pickNumber(obj: unknown, key: string, fallback = 0): number {
  if (obj && typeof obj === 'object' && key in obj) {
    const v = (obj as Record<string, unknown>)[key];
    if (typeof v === 'number' && Number.isFinite(v)) return v;
    if (typeof v === 'string') {
      const n = Number(v);
      if (Number.isFinite(n)) return n;
    }
  }
  return fallback;
}

export const igamingapisAdapter: ProviderAdapter = {
  key: ADAPTER_KEY,
  label: LABEL,

  async listBrands(creds) {
    const url = (creds.apiBase || '').replace(/\/+$/, '') || DEFAULT_BRANDS_URL;
    // Prefer the dedicated brands URL when the operator left apiBase
    // pointing at /api/v1; the brand catalog lives on the marketing
    // domain per panel screenshots.
    const target = /^https?:\/\/igamingapis\.com\/provider/.test(url) ? url : DEFAULT_BRANDS_URL;
    const { status, bodyText, bodyJson } = await timedFetch(target, {
      method: 'GET',
      headers: { accept: 'application/json' },
    });
    if (status < 200 || status >= 300) {
      throw new ProviderAdapterError('UPSTREAM_HTTP_ERROR', `Brands fetch failed (HTTP ${status})`, status);
    }
    // The endpoint returns either an array or { data: [...] } per
    // panel observation. Both shapes are supported.
    const list = Array.isArray(bodyJson)
      ? bodyJson
      : asArray((bodyJson as { data?: unknown })?.data);

    const result: ProviderBrand[] = list.map((row) => ({
      brandKey: pickString(row, 'brand_id') || pickString(row, 'id') || pickString(row, 'key') || pickString(row, 'slug'),
      displayName: pickString(row, 'name') || pickString(row, 'display_name') || pickString(row, 'brand_name') || pickString(row, 'brand_id', 'unknown'),
      raw: row,
    })).filter((b) => b.brandKey.length > 0);

    return { result, rawRequest: { url: target, method: 'GET' }, rawResponse: bodyJson ?? bodyText };
  },

  async listGames(creds, brandKey) {
    if (!brandKey) throw new ProviderAdapterError('UPSTREAM_BAD_RESPONSE', 'brandKey is required for listGames.');
    const base = (creds.apiBase || '').replace(/\/+$/, '');
    const target = /^https?:\/\/igamingapis\.com\/provider/.test(base)
      ? `${base.replace(/\/?$/, '')}/brands.php?brand_id=${encodeURIComponent(brandKey)}`
      : `${DEFAULT_GAMES_URL}?brand_id=${encodeURIComponent(brandKey)}`;

    const { status, bodyText, bodyJson } = await timedFetch(target, {
      method: 'GET',
      headers: { accept: 'application/json' },
    });
    if (status < 200 || status >= 300) {
      throw new ProviderAdapterError('UPSTREAM_HTTP_ERROR', `Games fetch failed (HTTP ${status})`, status);
    }
    const list = Array.isArray(bodyJson)
      ? bodyJson
      : asArray((bodyJson as { data?: unknown })?.data);

    const result: ProviderGame[] = list.map((row) => ({
      gameUid: pickString(row, 'game_uid') || pickString(row, 'game_id') || pickString(row, 'id'),
      displayName: pickString(row, 'name') || pickString(row, 'game_name') || pickString(row, 'title') || 'Provider Game',
      category: pickString(row, 'category') || pickString(row, 'type') || undefined,
      imageUrl: pickString(row, 'image') || pickString(row, 'image_url') || pickString(row, 'thumbnail') || undefined,
      brandKey,
      raw: row,
    })).filter((g) => g.gameUid.length > 0);

    return { result, rawRequest: { url: target, method: 'GET' }, rawResponse: bodyJson ?? bodyText };
  },

  async launch(creds, opts) {
    if (!creds.apiKey) throw new ProviderAdapterError('CREDENTIALS_MISSING', 'API token is not configured.');
    if (!creds.apiSecret) throw new ProviderAdapterError('CREDENTIALS_MISSING', 'API secret is not configured.');
    if (!creds.apiBase) throw new ProviderAdapterError('CREDENTIALS_MISSING', 'API base URL is not configured.');

    const payload: LaunchPayload = {
      user_id: opts.memberAccount,
      balance: Math.max(0, Math.floor(opts.balance * 100) / 100),
      game_uid: opts.gameUid,
      token: opts.token,
      timestamp: Math.floor(Date.now() / 1000),
      return: opts.returnUrl,
      callback: opts.callbackUrl,
    };
    if (opts.currencyCode) payload.currency_code = opts.currencyCode;
    if (opts.language) payload.language = opts.language;

    const json = JSON.stringify(payload);
    const encrypted = aesEcbEncryptBase64(json, creds.apiSecret, creds.secretEncoding);

    const base = creds.apiBase.replace(/\/+$/, '');
    const url = `${base}?payload=${encodeURIComponent(encrypted)}&token=${encodeURIComponent(creds.apiKey)}`;

    const { status, bodyText, bodyJson } = await timedFetch(url, {
      method: 'GET',
      headers: { accept: 'application/json' },
    });

    if (status < 200 || status >= 300) {
      throw new ProviderAdapterError('UPSTREAM_HTTP_ERROR', `Launch failed (HTTP ${status})`, status);
    }
    const rawCode = pickNumber(bodyJson, 'code', -1);
    const rawMessage = pickString(bodyJson, 'msg') || pickString(bodyJson, 'message');
    const data = (bodyJson && typeof bodyJson === 'object' ? (bodyJson as { data?: unknown }).data : null) ?? null;
    const launchUrl = pickString(data, 'url') || pickString(bodyJson, 'url');
    if (!launchUrl) {
      throw new ProviderAdapterError('UPSTREAM_BAD_RESPONSE', `Launch URL missing in provider response. code=${rawCode} msg=${rawMessage || 'n/a'}`);
    }
    return {
      result: {
        launchUrl,
        mode: creds.launchMode,
        rawCode,
        rawMessage,
        raw: bodyJson,
      } satisfies LaunchResult,
      rawRequest: { url: '<masked>', method: 'GET', payload },
      rawResponse: bodyJson ?? bodyText,
    };
  },

  async healthCheck(creds) {
    // Cheap connectivity probe: hit the brand list endpoint with a
    // short timeout. A successful response (any 2xx) is enough to
    // tag the provider as reachable.
    const target = /^https?:\/\/igamingapis\.com\/provider/.test(creds.apiBase || '')
      ? creds.apiBase
      : DEFAULT_BRANDS_URL;
    const start = Date.now();
    try {
      const res = await fetch(target, { method: 'GET', headers: { accept: 'application/json' } });
      const ok = res.status >= 200 && res.status < 400;
      return { ok, latencyMs: Date.now() - start, detail: `HTTP ${res.status}` };
    } catch (err) {
      return { ok: false, latencyMs: Date.now() - start, detail: err instanceof Error ? err.message : String(err) };
    }
  },

  async parseCallback(creds, _headers, rawBody) {
    if (!rawBody || typeof rawBody !== 'object') {
      throw new ProviderAdapterError('CALLBACK_INVALID', 'Callback body must be a JSON object.');
    }
    const body = rawBody as Record<string, unknown>;
    const memberAccount = pickString(body, 'member_account');
    const gameRound = pickString(body, 'game_round');
    const gameUid = pickString(body, 'game_id') || pickString(body, 'game_uid');
    const betAmount = pickNumber(body, 'bet_amount', 0);
    const winAmount = pickNumber(body, 'win_amount', 0);
    const tsRaw = body.timestamp;

    if (!memberAccount) throw new ProviderAdapterError('CALLBACK_INVALID', 'member_account is required.');
    if (!gameRound) throw new ProviderAdapterError('CALLBACK_INVALID', 'game_round is required.');

    // Provider sends `YYYY-MM-DD HH:mm:ss` per panel screenshot. Use
    // a permissive parse so future ISO/epoch variants still work.
    let ts: Date | null = null;
    if (typeof tsRaw === 'string') {
      const d = new Date(tsRaw.replace(' ', 'T') + 'Z');
      if (!Number.isNaN(d.getTime())) ts = d;
    } else if (typeof tsRaw === 'number' && Number.isFinite(tsRaw)) {
      // Heuristic: < 10^12 => seconds, else ms.
      ts = new Date(tsRaw < 1e12 ? tsRaw * 1000 : tsRaw);
    }

    // Optional age check using the operator's clock-skew tolerance.
    if (ts && creds.clockSkewSeconds > 0) {
      const ageSec = Math.abs(Date.now() - ts.getTime()) / 1000;
      if (ageSec > creds.clockSkewSeconds * 4) {
        // 4x the configured skew is a soft warning, not a reject -
        // until provider confirms timestamp accuracy.
        console.warn('[providers/igamingapis] callback timestamp drift', { ageSec, allowed: creds.clockSkewSeconds });
      }
    }

    return {
      // Until docs clarify a transaction_type field, treat any
      // win_amount > 0 as a win, otherwise a bet/settle event.
      type: winAmount > 0 ? 'win' : 'bet',
      memberAccount,
      gameUid: gameUid || null,
      gameRound,
      betAmount,
      winAmount,
      providerTxId: gameRound,
      timestamp: ts,
      rawBody,
    } satisfies NormalizedCallback;
  },

  buildCallbackResponse(_creds, input): CallbackResponseEnvelope {
    if (!input.ok) {
      return {
        status: 400,
        body: { code: 1, msg: input.errorCode ?? 'CALLBACK_REJECTED', timestamp: Date.now() },
      };
    }
    const credit = input.responseMode === 'net_loss_amount'
      ? Math.max(0, input.betAmount - input.winAmount)
      : input.newBalance;
    return {
      status: 200,
      body: {
        credit_amount: Number(credit.toFixed(2)),
        timestamp: Date.now(),
      },
    };
  },
};
