// Built by Anointed Coder.
//
// Runtime config for the WebView shell. The app is a thin native wrapper
// around the live Pasha9 website - all UI, auth and data come from the page
// itself. The only thing native code needs to know is which origin to load.
// Override via app.json > expo.extra.apiBaseUrl (handy for pointing a dev
// build at staging) without a code change.

import Constants from 'expo-constants';

function readExtra(key: string): string | undefined {
  const extra = Constants.expoConfig?.extra as Record<string, unknown> | undefined;
  const value = extra?.[key];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

/** The site the WebView loads. Override via app.json expo.extra.apiBaseUrl. */
export const SITE_URL: string = readExtra('apiBaseUrl') ?? 'https://pasha9.com';
