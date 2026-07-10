// Built by Anointed Coder.
//
// Typed fetch wrapper for the live Pasha9 API. Responsibilities:
//   - Attach the shared headers on every call (X-Client: mobile, a real
//     User-Agent, JSON content type) and, for authed calls, an
//     Authorization: Bearer <access token> from the auth store.
//   - Parse the backend { ok } envelope: on ok:true return the payload, on
//     ok:false or a non-2xx status throw a typed ApiError { code, message, status }.
//   - Transparent single refresh: when an authed call gets a 401, try ONE
//     token refresh through POST /api/auth/token/refresh using the stored
//     refresh token; on success retry the original request once; on failure
//     clear the session (sign out).
//   - Support GET / POST / PATCH / DELETE plus multipart uploads (avatar, later).
//
// The store registers a small bridge (registerAuthBridge) so this module can
// read the current tokens and hand back rotated ones without importing the
// React context directly (keeps the dependency one-way and avoids cycles).

import {
  API_BASE_URL,
  USER_AGENT,
  X_CLIENT_HEADER,
  X_CLIENT_VALUE,
} from '../config';

export type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE';

/** Tokens returned by login / register / refresh under the mobile contract. */
export interface TokenBundle {
  token: string;
  refresh: string;
  expiresIn: number;
}

/** Typed API failure. `code` is the backend error code, `status` the HTTP status. */
export class ApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly meta?: Record<string, unknown>;

  constructor(status: number, code: string, message?: string, meta?: Record<string, unknown>) {
    super(message ?? code);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.meta = meta;
  }
}

// ---------------------------------------------------------------------------
// Auth bridge: the store wires these so the client can read/rotate tokens.
// ---------------------------------------------------------------------------

export interface AuthBridge {
  getAccessToken(): string | null;
  getRefreshToken(): string | null;
  /** Persist a freshly rotated token pair after a successful refresh. */
  onTokensRotated(bundle: TokenBundle): void | Promise<void>;
  /** Clear the session when refresh is impossible (invalid/expired refresh). */
  onSessionCleared(): void | Promise<void>;
}

let bridge: AuthBridge | null = null;

export function registerAuthBridge(next: AuthBridge | null): void {
  bridge = next;
}

// ---------------------------------------------------------------------------
// Request options
// ---------------------------------------------------------------------------

export interface RequestOptions {
  method?: HttpMethod;
  /** JSON body. Ignored when `form` is set. */
  body?: unknown;
  /** Multipart body for file uploads. Sets no Content-Type so fetch adds the boundary. */
  form?: FormData;
  /** Attach the bearer access token. Defaults to true. */
  auth?: boolean;
  /** Extra headers merged last. */
  headers?: Record<string, string>;
  /** Internal: marks the retry after a refresh so we never loop. */
  _retried?: boolean;
}

function buildHeaders(opts: RequestOptions): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'User-Agent': USER_AGENT,
    [X_CLIENT_HEADER]: X_CLIENT_VALUE,
  };

  // Only set JSON content type for a JSON body. Multipart must be left to fetch.
  if (!opts.form && opts.body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  const useAuth = opts.auth !== false;
  if (useAuth) {
    const access = bridge?.getAccessToken() ?? null;
    if (access) headers['Authorization'] = `Bearer ${access}`;
  }

  return { ...headers, ...(opts.headers ?? {}) };
}

async function rawFetch(path: string, opts: RequestOptions): Promise<Response> {
  const url = path.startsWith('http') ? path : `${API_BASE_URL}${path}`;
  const headers = buildHeaders(opts);

  let bodyInit: BodyInit | undefined;
  if (opts.form) {
    bodyInit = opts.form as unknown as BodyInit;
  } else if (opts.body !== undefined) {
    bodyInit = JSON.stringify(opts.body);
  }

  return fetch(url, {
    method: opts.method ?? (bodyInit ? 'POST' : 'GET'),
    headers,
    body: bodyInit,
  });
}

async function parseJson(res: Response): Promise<Record<string, unknown>> {
  const text = await res.text();
  if (!text) return {};
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    // Non-JSON body (gateway HTML, empty 204, etc.). Surface as a shaped error.
    throw new ApiError(res.status, 'BAD_RESPONSE', 'The server returned an unexpected response.');
  }
}

// Single-flight refresh: when several authed requests 401 at once (the normal
// case, many hooks firing on an expired access token), they must share ONE
// refresh, not each spend the rotating refresh token and race each other into
// a spurious sign-out. All concurrent callers await this same promise.
let refreshInFlight: Promise<TokenBundle | null> | null = null;

async function refreshOnce(): Promise<TokenBundle | null> {
  if (!refreshInFlight) {
    refreshInFlight = tryRefresh()
      .then(async (rotated) => {
        if (rotated) await bridge?.onTokensRotated(rotated);
        return rotated;
      })
      .finally(() => {
        refreshInFlight = null;
      });
  }
  return refreshInFlight;
}

/**
 * Low-level refresh. Calls POST /api/auth/token/refresh with the stored refresh
 * token (both in the body and as a bearer, per the contract). Returns the
 * rotated bundle, or null on any failure. Never triggers another refresh.
 */
async function tryRefresh(): Promise<TokenBundle | null> {
  const refreshToken = bridge?.getRefreshToken() ?? null;
  if (!refreshToken) return null;

  let res: Response;
  try {
    res = await rawFetch('/api/auth/token/refresh', {
      method: 'POST',
      auth: false,
      body: { refresh: refreshToken },
      headers: { Authorization: `Bearer ${refreshToken}` },
    });
  } catch {
    return null;
  }

  if (!res.ok) return null;
  let json: Record<string, unknown>;
  try {
    json = await parseJson(res);
  } catch {
    return null;
  }
  if (json.ok !== true || typeof json.token !== 'string' || typeof json.refresh !== 'string') {
    return null;
  }
  return {
    token: json.token,
    refresh: json.refresh,
    expiresIn: typeof json.expiresIn === 'number' ? json.expiresIn : 0,
  };
}

/**
 * The single public entry point. Returns the parsed payload (the envelope with
 * `ok` stripped is still present on the object; callers type only what they use)
 * and throws ApiError on any failure.
 */
export async function apiFetch<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const useAuth = opts.auth !== false;
  // Only the expired-token refresh flow applies when we actually SENT a bearer.
  // A 401 on a guest call (a failed login, for example) is a plain auth error,
  // not an expired session, so it must never trigger refresh or a sign-out.
  const sentBearer = useAuth && !!bridge?.getAccessToken();

  let res: Response;
  try {
    res = await rawFetch(path, opts);
  } catch (err) {
    throw new ApiError(0, 'NETWORK', 'Network request failed. Check your connection.', {
      cause: String(err),
    });
  }

  // Transparent single refresh on a 401 for an authed call.
  if (res.status === 401 && sentBearer && bridge) {
    if (!opts._retried) {
      const rotated = await refreshOnce();
      if (rotated) {
        // refreshOnce already persisted the rotated pair via the bridge.
        return apiFetch<T>(path, { ...opts, _retried: true });
      }
    }
    // No refresh possible, refresh failed, or the retry still came back 401:
    // the session is dead. Clear it, then fall through to throw a clean error.
    await bridge.onSessionCleared();
  }

  const json = await parseJson(res);

  if (!res.ok || json.ok === false) {
    const code = typeof json.code === 'string' ? json.code : `HTTP_${res.status}`;
    const message = typeof json.message === 'string' ? json.message : undefined;
    throw new ApiError(res.status, code, message, json);
  }

  return json as T;
}

// Convenience method helpers. Each returns the typed payload.
export const api = {
  get: <T>(path: string, opts?: Omit<RequestOptions, 'method' | 'body' | 'form'>) =>
    apiFetch<T>(path, { ...opts, method: 'GET' }),
  post: <T>(path: string, body?: unknown, opts?: Omit<RequestOptions, 'method' | 'body'>) =>
    apiFetch<T>(path, { ...opts, method: 'POST', body }),
  patch: <T>(path: string, body?: unknown, opts?: Omit<RequestOptions, 'method' | 'body'>) =>
    apiFetch<T>(path, { ...opts, method: 'PATCH', body }),
  delete: <T>(path: string, opts?: Omit<RequestOptions, 'method'>) =>
    apiFetch<T>(path, { ...opts, method: 'DELETE' }),
  upload: <T>(path: string, form: FormData, opts?: Omit<RequestOptions, 'method' | 'form' | 'body'>) =>
    apiFetch<T>(path, { ...opts, method: 'POST', form }),
};
