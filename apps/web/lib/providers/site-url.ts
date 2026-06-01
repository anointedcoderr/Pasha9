// Built by Anointed Coder.
//
// Resolves the PUBLIC HTTPS base URL the provider will dial to
// reach our callback and player return endpoints. The provider
// runs outside our network, so it MUST NOT see localhost or any
// other private hostname.
//
// Resolution order:
//   1. creds.publicBaseUrl - per-provider override saved by admin
//   2. process.env.PUBLIC_SITE_URL (or NEXT_PUBLIC_SITE_URL / PASHA9_PUBLIC_URL)
//   3. The incoming request origin (fine in production, dangerous
//      on local dev - flagged by isPrivateHost so the caller can
//      refuse to send the payload).
//
// The caller can read suspicion flags off the returned object and
// choose to abort (admin Test Launch) or warn loudly (Setup tab).

import type { ProviderCreds } from './credentials';

const PRIVATE_HOSTS = ['localhost', '127.0.0.1', '0.0.0.0', '::1'];

export interface ResolvedBaseUrl {
  base: string;
  source: 'provider_setting' | 'env' | 'request_origin';
  isHttps: boolean;
  isPrivateHost: boolean;
}

function inspectUrl(raw: string, source: ResolvedBaseUrl['source']): ResolvedBaseUrl {
  const trimmed = raw.replace(/\/+$/, '');
  let isHttps = false;
  let isPrivateHost = false;
  try {
    const u = new URL(trimmed);
    isHttps = u.protocol === 'https:';
    isPrivateHost = PRIVATE_HOSTS.includes(u.hostname.toLowerCase()) || /^192\.168\./.test(u.hostname) || /^10\./.test(u.hostname) || /^172\.(1[6-9]|2\d|3[0-1])\./.test(u.hostname);
  } catch {
    // unparseable, treat as suspect
    isHttps = false;
    isPrivateHost = true;
  }
  return { base: trimmed, source, isHttps, isPrivateHost };
}

export function resolvePublicBaseUrl(creds: Pick<ProviderCreds, 'publicBaseUrl'>, fallbackOrigin: string): ResolvedBaseUrl {
  if (creds.publicBaseUrl && creds.publicBaseUrl.trim().length > 0) {
    return inspectUrl(creds.publicBaseUrl.trim(), 'provider_setting');
  }
  const envUrl = process.env.PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_SITE_URL || process.env.PASHA9_PUBLIC_URL;
  if (envUrl && envUrl.trim().length > 0) {
    return inspectUrl(envUrl.trim(), 'env');
  }
  return inspectUrl(fallbackOrigin, 'request_origin');
}

export interface ResolvedProviderUrls {
  baseUrl: ResolvedBaseUrl;
  callbackUrl: string;       // includes ?key=<callbackSecret> already
  returnUrl: string;
  callbackUrlMasked: string; // safe for UI - secret stripped
}

export function resolveProviderUrls(creds: ProviderCreds, fallbackOrigin: string): ResolvedProviderUrls {
  const baseUrl = resolvePublicBaseUrl(creds, fallbackOrigin);
  const cbPath = creds.callbackPath || `/api/providers/${creds.providerKey}/callback`;
  const callbackUrl = `${baseUrl.base}${cbPath}?key=${encodeURIComponent(creds.callbackSecret)}`;
  const callbackUrlMasked = `${baseUrl.base}${cbPath}?key=••••`;
  const returnUrl = `${baseUrl.base}/games/provider/return?p=${encodeURIComponent(creds.providerKey)}`;
  return { baseUrl, callbackUrl, returnUrl, callbackUrlMasked };
}
