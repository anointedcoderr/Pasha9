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
import { aesEcbEncryptBase64, aesEcbDecryptBase64 } from '../crypto';
import { normalizeCategory } from '../category';

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

/**
 * Looks at the response body text + JSON parse outcome and decides
 * whether the upstream actually returned JSON. The iGamingAPIs brand
 * + games endpoints sit behind a login wall and return an HTML
 * marketing page to unauthenticated fetchers; detecting that early
 * lets us surface a clear admin error instead of silently inserting
 * zero rows.
 */
function detectHtml(bodyText: string, bodyJson: unknown): { isHtml: boolean; snippet: string } {
  const head = bodyText.trim().slice(0, 200);
  const lowered = head.toLowerCase();
  const looksHtml = lowered.startsWith('<!doctype') || lowered.startsWith('<html') || lowered.includes('<head') || lowered.includes('<title') || lowered.includes('premium igaming api solutions');
  const isHtml = looksHtml && bodyJson == null;
  return { isHtml, snippet: head };
}

/**
 * Tries to pull a list out of a response of unknown shape. Supports
 * top-level arrays as well as common wrappers like { data: [...] },
 * { brands: [...] }, { games: [...] }, { result: { data: [...] } }.
 */
function extractList(bodyJson: unknown, hintedKeys: string[]): unknown[] {
  if (Array.isArray(bodyJson)) return bodyJson;
  if (!bodyJson || typeof bodyJson !== 'object') return [];
  const obj = bodyJson as Record<string, unknown>;
  for (const k of hintedKeys) {
    if (Array.isArray(obj[k])) return obj[k] as unknown[];
  }
  if (obj.data && typeof obj.data === 'object') {
    if (Array.isArray(obj.data)) return obj.data as unknown[];
    for (const k of hintedKeys) {
      const v = (obj.data as Record<string, unknown>)[k];
      if (Array.isArray(v)) return v;
    }
  }
  if (obj.result && typeof obj.result === 'object') {
    for (const k of hintedKeys) {
      const v = (obj.result as Record<string, unknown>)[k];
      if (Array.isArray(v)) return v;
    }
  }
  return [];
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

// Callback field alias map. iGamingAPIs documentation shows
// member_account / game_round / game_uid; production traffic uses
// user_id / game_id / etc. Every alias here is tried in order; the
// first non-empty match wins.
const CALLBACK_ALIASES = {
  member: ['member_account', 'memberAccount', 'user_id', 'userId', 'user', 'player_id', 'playerId', 'account', 'username'],
  game:   ['game_uid', 'game_id', 'gameUid', 'gameId'],
  round:  ['game_round', 'gameRound', 'round_id', 'roundId', 'transaction_id', 'transactionId', 'bet_id', 'betId'],
  bet:    ['bet_amount', 'betAmount', 'bet', 'amount'],
  win:    ['win_amount', 'winAmount', 'win', 'payout'],
  timestamp: ['timestamp', 'time', 'created_at', 'createdAt', 'round_time', 'roundTime'],
} as const;

// Wrapper field names. Providers sometimes nest the real payload
// one level deep. We unwrap and merge with the top level so a top-
// level field still wins if the provider sends both.
const WRAPPER_KEYS = ['data', 'payload', 'result', 'message'] as const;

function firstString(obj: Record<string, unknown>, aliases: readonly string[]): string {
  for (const k of aliases) {
    const v = pickString(obj, k);
    if (v) return v;
  }
  return '';
}

function firstNumber(obj: Record<string, unknown>, aliases: readonly string[]): number {
  for (const k of aliases) {
    if (k in obj) {
      const n = pickNumber(obj, k, NaN);
      if (Number.isFinite(n)) return n;
    }
  }
  return 0;
}

function unwrapBody(raw: Record<string, unknown>): Record<string, unknown> {
  // Look for a single wrapper field that holds an object; merge its
  // contents with the top level so we can pick from either place
  // with the alias lookup below.
  for (const w of WRAPPER_KEYS) {
    const v = raw[w];
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      return { ...(v as Record<string, unknown>), ...raw };
    }
  }
  return raw;
}

export const igamingapisAdapter: ProviderAdapter = {
  key: ADAPTER_KEY,
  label: LABEL,

  async listBrands(creds) {
    // Candidate URLs to try, in order. The brand catalog historically
    // lives on the marketing domain per panel screenshots, but the
    // .live API host may also expose it. We also append the API token
    // because the panel often gates the same path behind a session.
    const base = (creds.apiBase || '').replace(/\/+$/, '');
    const tokenSuffix = creds.apiKey ? `?token=${encodeURIComponent(creds.apiKey)}` : '';
    const candidates: string[] = [];
    if (/^https?:\/\/igamingapis\.com\/provider/.test(base)) candidates.push(base);
    candidates.push(DEFAULT_BRANDS_URL);
    if (creds.apiKey) {
      candidates.push(`${DEFAULT_BRANDS_URL}${tokenSuffix}`);
      if (base && !/^https?:\/\/igamingapis\.com\/provider/.test(base)) {
        candidates.push(`${base}/brands${tokenSuffix}`);
      }
    }

    let lastSnippet = '';
    let lastStatus = 0;
    for (const target of candidates) {
      const { status, bodyText, bodyJson } = await timedFetch(target, {
        method: 'GET',
        headers: {
          accept: 'application/json',
          ...(creds.apiKey ? { authorization: `Bearer ${creds.apiKey}` } : {}),
        },
      });
      lastStatus = status;
      const { isHtml, snippet } = detectHtml(bodyText, bodyJson);
      lastSnippet = snippet;
      if (status < 200 || status >= 300) continue;
      if (isHtml) continue;
      const list = extractList(bodyJson, ['brands', 'providers', 'data', 'items']);
      if (list.length === 0) continue;
      const result: ProviderBrand[] = list.map((row) => ({
        brandKey: pickString(row, 'brand_id') || pickString(row, 'id') || pickString(row, 'key') || pickString(row, 'slug'),
        displayName: pickString(row, 'name') || pickString(row, 'display_name') || pickString(row, 'brand_name') || pickString(row, 'brand_id', 'unknown'),
        raw: row,
      })).filter((b) => b.brandKey.length > 0);
      if (result.length === 0) continue;
      return { result, rawRequest: { url: target, method: 'GET' }, rawResponse: bodyJson ?? bodyText.slice(0, 400) };
    }

    // Every candidate failed: HTML, empty, or no usable rows.
    if (lastStatus >= 400) {
      throw new ProviderAdapterError('UPSTREAM_HTTP_ERROR', `Brands fetch failed (HTTP ${lastStatus}). Confirm endpoint URL or use Add Manual Brand.`, lastStatus, lastSnippet);
    }
    if (lastSnippet && (lastSnippet.startsWith('<') || lastSnippet.toLowerCase().includes('premium'))) {
      throw new ProviderAdapterError(
        'UPSTREAM_NOT_JSON',
        'Provider brand endpoint returned HTML/login page, not JSON. Use manual JILI setup or provide a JSON endpoint.',
        502,
        lastSnippet,
      );
    }
    throw new ProviderAdapterError(
      'UPSTREAM_EMPTY',
      'Provider returned 0 brands. Confirm the endpoint URL in Setup or use Add Manual Brand to create JILI manually.',
      502,
      lastSnippet,
    );
  },

  async listGames(creds, brandKey) {
    if (!brandKey) throw new ProviderAdapterError('UPSTREAM_BAD_RESPONSE', 'brandKey is required for listGames.');
    const base = (creds.apiBase || '').replace(/\/+$/, '');
    const tokenSuffix = creds.apiKey ? `&token=${encodeURIComponent(creds.apiKey)}` : '';
    const candidates: string[] = [];
    if (/^https?:\/\/igamingapis\.com\/provider/.test(base)) {
      candidates.push(`${base}/brands.php?brand_id=${encodeURIComponent(brandKey)}`);
    }
    candidates.push(`${DEFAULT_GAMES_URL}?brand_id=${encodeURIComponent(brandKey)}`);
    if (creds.apiKey) {
      candidates.push(`${DEFAULT_GAMES_URL}?brand_id=${encodeURIComponent(brandKey)}${tokenSuffix}`);
      if (base && !/^https?:\/\/igamingapis\.com\/provider/.test(base)) {
        candidates.push(`${base}/games?brand_id=${encodeURIComponent(brandKey)}${tokenSuffix}`);
      }
    }

    let lastSnippet = '';
    let lastStatus = 0;
    for (const target of candidates) {
      const { status, bodyText, bodyJson } = await timedFetch(target, {
        method: 'GET',
        headers: {
          accept: 'application/json',
          ...(creds.apiKey ? { authorization: `Bearer ${creds.apiKey}` } : {}),
        },
      });
      lastStatus = status;
      const { isHtml, snippet } = detectHtml(bodyText, bodyJson);
      lastSnippet = snippet;
      if (status < 200 || status >= 300) continue;
      if (isHtml) continue;
      const list = extractList(bodyJson, ['games', 'data', 'items', 'list']);
      if (list.length === 0) continue;
      const result: ProviderGame[] = list.map((row) => ({
        gameUid: pickString(row, 'game_uid') || pickString(row, 'game_id') || pickString(row, 'id'),
        displayName: pickString(row, 'name') || pickString(row, 'game_name') || pickString(row, 'title') || 'Provider Game',
        category: normalizeCategory(pickString(row, 'category') || pickString(row, 'type') || ''),
        imageUrl: pickString(row, 'image') || pickString(row, 'image_url') || pickString(row, 'thumbnail') || undefined,
        brandKey,
        raw: row,
      })).filter((g) => g.gameUid.length > 0);
      if (result.length === 0) continue;
      return { result, rawRequest: { url: target, method: 'GET' }, rawResponse: bodyJson ?? bodyText.slice(0, 400) };
    }

    if (lastStatus >= 400) {
      throw new ProviderAdapterError('UPSTREAM_HTTP_ERROR', `Games fetch failed (HTTP ${lastStatus}).`, lastStatus, lastSnippet);
    }
    if (lastSnippet && (lastSnippet.startsWith('<') || lastSnippet.toLowerCase().includes('premium'))) {
      throw new ProviderAdapterError(
        'UPSTREAM_NOT_JSON',
        `Games endpoint returned HTML/login page, not JSON, for brand_id=${brandKey}.`,
        502,
        lastSnippet,
      );
    }
    throw new ProviderAdapterError(
      'UPSTREAM_EMPTY',
      `Provider returned 0 games for brand_id=${brandKey}. Confirm the brand ID matches the provider panel.`,
      502,
      lastSnippet,
    );
  },

  async launch(creds, opts) {
    if (!creds.apiKey) throw new ProviderAdapterError('CREDENTIALS_MISSING', 'API token is not configured.');
    if (!creds.apiSecret) throw new ProviderAdapterError('CREDENTIALS_MISSING', 'API secret is not configured.');
    if (!creds.apiBase) throw new ProviderAdapterError('CREDENTIALS_MISSING', 'API base URL is not configured.');

    // Timestamp is generated fresh on every invocation, AFTER all
    // input validation, IMMEDIATELY before payload assembly. Never
    // pulled from a cache, a request body, a DB column, or the
    // browser; always Date.now() in milliseconds (NOT seconds).
    const offsetMs = creds.launchTimestampOffsetMs ?? 0;
    const timestampSent = Date.now() + offsetMs;

    const payload: LaunchPayload = {
      user_id: opts.memberAccount,
      balance: Math.max(0, Math.floor(opts.balance * 100) / 100),
      game_uid: opts.gameUid,
      token: opts.token,
      timestamp: timestampSent,
      return: opts.returnUrl,
      callback: opts.callbackUrl,
    };
    if (opts.currencyCode) payload.currency_code = opts.currencyCode;
    if (opts.language) payload.language = opts.language;

    const json = JSON.stringify(payload);
    const encrypted = aesEcbEncryptBase64(json, creds.apiSecret, creds.secretEncoding);

    const base = creds.apiBase.replace(/\/+$/, '');
    const url = `${base}?payload=${encodeURIComponent(encrypted)}&token=${encodeURIComponent(creds.apiKey)}`;

    // Local sanity check immediately before we send. Anything beyond
    // a few seconds means clock drift on this VPS (NTP not running)
    // or someone is feeding a stale timestamp into the helper -
    // fail loudly instead of letting the provider reject the payload.
    const serverNow = Date.now();
    const ageMs = serverNow - timestampSent;
    if (Math.abs(ageMs) > 5_000) {
      throw new ProviderAdapterError(
        'CREDENTIALS_INVALID',
        `Local clock drift detected. timestampSent=${timestampSent} serverNow=${serverNow} ageMs=${ageMs} offsetMs=${offsetMs}. Check NTP / ntpd / chrony on the VPS, or zero out launchTimestampOffsetMs.`,
        400,
      );
    }

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
    // iGamingAPIs returns { code: 0 } on success and { code: 1 } on
    // any rejection. A non-zero code still sometimes carries a
    // data.url pointing at the provider's /error page; treat that
    // as a rejection and surface the diagnostics so the operator
    // can see exactly which field failed (payload expired, invalid
    // user_id, etc.).
    if (rawCode > 0) {
      throw new ProviderAdapterError(
        'UPSTREAM_BAD_RESPONSE',
        `Provider rejected launch. code=${rawCode} msg=${rawMessage || 'n/a'}. Diagnostics: timestampSent=${timestampSent} serverNow=${serverNow} ageMs=${ageMs} offsetMs=${offsetMs}.`,
        400,
        launchUrl ? `Provider URL: ${launchUrl}` : undefined,
      );
    }
    if (!launchUrl) {
      throw new ProviderAdapterError(
        'UPSTREAM_BAD_RESPONSE',
        `Launch URL missing in provider response. code=${rawCode} msg=${rawMessage || 'n/a'}. Diagnostics: timestampSent=${timestampSent} serverNow=${serverNow} ageMs=${ageMs} offsetMs=${offsetMs}.`,
      );
    }
    return {
      result: {
        launchUrl,
        mode: creds.launchMode,
        rawCode,
        rawMessage,
        raw: bodyJson,
      } satisfies LaunchResult,
      // rawRequest is what gets logged + surfaced to admin. It does
      // NOT include the encrypted blob, the API token, or the API
      // secret. timestampSent / serverNow / ageMs / offsetMs are the
      // signals the operator actually needs to debug expiry errors.
      rawRequest: {
        url: '<masked>',
        method: 'GET',
        payload: { ...payload, token: '<masked>' },
        timestampSent,
        serverNow,
        ageMs,
        offsetMs,
      },
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

    // iGamingAPIs sends callbacks as { payload: "<AES-256-ECB base64>",
    // timestamp: <ms> }. The real payload (member_account, game_round,
    // bet/win amounts) is INSIDE the encrypted blob, using the same
    // secret as the launch encryption. Detect and decrypt before
    // the alias extraction step.
    const top = rawBody as Record<string, unknown>;
    const wrapperTimestamp = top.timestamp;
    let body: Record<string, unknown>;
    let encryptedPayloadDetected = false;
    let decryptError: string | undefined;

    const payloadField = typeof top.payload === 'string' ? top.payload : '';
    if (payloadField && payloadField.length >= 16) {
      encryptedPayloadDetected = true;
      try {
        const plain = aesEcbDecryptBase64(payloadField, creds.apiSecret, creds.secretEncoding);
        const decoded = JSON.parse(plain);
        if (decoded && typeof decoded === 'object' && !Array.isArray(decoded)) {
          body = unwrapBody(decoded as Record<string, unknown>);
        } else {
          throw new Error('decrypted body is not a JSON object');
        }
      } catch (err) {
        decryptError = err instanceof Error ? err.message : String(err);
        // Surface a clear error WITHOUT leaking the secret or the
        // ciphertext beyond a length hint.
        throw new ProviderAdapterError(
          'CALLBACK_INVALID',
          `CALLBACK_DECRYPT_FAILED. encoding=${creds.secretEncoding} payloadLen=${payloadField.length} err=${decryptError.slice(0, 200)}`,
        );
      }
    } else {
      // No encrypted payload, fall back to plain JSON shape and
      // still try wrapper unwrap so non-iGamingAPIs adapters that
      // reuse this code path work too.
      body = unwrapBody(top);
    }

    const seenKeys = Object.keys(body).slice(0, 30);

    const memberAccount = firstString(body, CALLBACK_ALIASES.member);
    const gameRound = firstString(body, CALLBACK_ALIASES.round);
    const gameUid = firstString(body, CALLBACK_ALIASES.game);
    const betAmount = firstNumber(body, CALLBACK_ALIASES.bet);
    const winAmount = firstNumber(body, CALLBACK_ALIASES.win);
    let tsRaw: unknown = undefined;
    for (const k of CALLBACK_ALIASES.timestamp) {
      if (k in body) { tsRaw = body[k]; break; }
    }
    // Fall back to the wrapper timestamp if the decrypted body has none.
    if (tsRaw === undefined && wrapperTimestamp !== undefined) tsRaw = wrapperTimestamp;

    if (!memberAccount) {
      throw new ProviderAdapterError(
        'CALLBACK_INVALID',
        `account field missing. Seen keys: ${seenKeys.join(',') || '(none)'}`,
      );
    }
    if (!gameRound) {
      throw new ProviderAdapterError(
        'CALLBACK_INVALID',
        `round id field missing. Seen keys: ${seenKeys.join(',') || '(none)'}`,
      );
    }

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

    // Three-state event derivation. iGamingAPIs does not send an
    // explicit transaction_type field on its callbacks, so we derive
    // one from the amounts. This is what the new type-aware
    // idempotency key depends on (otherwise a separate BET callback
    // followed by a separate WIN callback for the same game_round
    // collides and the WIN is dropped as duplicate - the exact bug
    // that caused a real player win to be lost).
    let derivedType: 'bet' | 'win' | 'settle';
    if (betAmount > 0 && winAmount > 0) derivedType = 'settle';
    else if (winAmount > 0) derivedType = 'win';
    else derivedType = 'bet';

    return {
      type: derivedType,
      memberAccount,
      gameUid: gameUid || null,
      gameRound,
      betAmount,
      winAmount,
      providerTxId: gameRound,
      timestamp: ts,
      rawBody,
      diagnostics: {
        encryptedPayloadDetected,
        seenKeys,
        parsedMemberAccount: memberAccount,
        parsedGameRound: gameRound,
        parsedGameUid: gameUid || undefined,
        parsedBetAmount: betAmount,
        parsedWinAmount: winAmount,
        derivedType,
      },
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
