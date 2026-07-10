// Built by Anointed Coder.
//
// Runtime config for the live backend wiring. The player app talks to the
// production Pasha9 web API. The base URL defaults to https://pasha9.com but
// can be overridden without a code change through app.json > expo.extra.apiBaseUrl
// (handy for pointing a dev build at staging). Every request the client makes
// carries the X-Client marker so the backend knows to also return bearer tokens
// in the body (the agreed mobile auth contract), plus a real User-Agent.

import { Platform } from 'react-native';
import Constants from 'expo-constants';

function readExtra(key: string): string | undefined {
  const extra = Constants.expoConfig?.extra as Record<string, unknown> | undefined;
  const value = extra?.[key];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

/** Production API origin. Override via app.json expo.extra.apiBaseUrl. */
export const API_BASE_URL: string = readExtra('apiBaseUrl') ?? 'https://pasha9.com';

/** Client marker header the backend keys on to issue body tokens for mobile. */
export const X_CLIENT_HEADER = 'X-Client';
export const X_CLIENT_VALUE = 'mobile';

const APP_VERSION = Constants.expoConfig?.version ?? '1.0.0';
const OS = Platform.OS === 'ios' ? 'iOS' : Platform.OS === 'android' ? 'Android' : 'Web';

/**
 * A real User-Agent string. Some upstream protections (Cloudflare / WAF) drop
 * requests with an empty or default UA, so we always send an explicit one.
 */
export const USER_AGENT = `Pasha9Mobile/${APP_VERSION} (${OS})`;

/** Secure-store keys for the persisted token pair. */
export const STORAGE_KEYS = {
  accessToken: 'pasha9.accessToken',
  refreshToken: 'pasha9.refreshToken',
} as const;
