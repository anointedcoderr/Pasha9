// Built by Anointed Coder.
//
// GA4 Measurement Protocol (server-side) adapter. Reads:
//   analytics_ga4                   measurement id (G-XXXX) - also used by client gtag
//   analytics_ga4_api_secret        API secret from GA4 -> Admin -> Data Streams
//
// Without the API secret, server-side fires are skipped (the gtag
// snippet still tracks pageviews + browser-side events).

import type { PlatformAdapter, TrackingEventInput, DispatchResult } from './types';

const GA_EVENT_MAP: Record<string, string> = {
  signup: 'sign_up',
  login: 'login',
  deposit: 'purchase',
  withdrawal: 'refund',
  lotto_bet: 'purchase',
  bonus_claim: 'earn_virtual_currency',
  custom: 'custom_event',
};

export const ga4Adapter: PlatformAdapter = {
  key: 'ga4',
  label: 'GA4',
  settingKeys: ['analytics_ga4', 'analytics_ga4_api_secret'],
  isLive(settings) {
    return !!(settings.analytics_ga4?.trim() && settings.analytics_ga4_api_secret?.trim());
  },
  async dispatch(event, settings): Promise<DispatchResult> {
    const measurementId = settings.analytics_ga4?.trim();
    const apiSecret = settings.analytics_ga4_api_secret?.trim();
    if (!measurementId) return { platform: 'ga4', status: 'skipped_no_id' };
    if (!apiSecret) return { platform: 'ga4', status: 'skipped_no_token' };

    const gaEvent = GA_EVENT_MAP[event.event] ?? 'custom_event';

    // GA4 needs a client id. Server-side we hash userId or use a
    // synthetic device id from reference.
    const clientId = event.userId ?? event.reference ?? `srv-${Date.now()}`;

    const params: Record<string, unknown> = {
      ...(event.value != null ? { value: event.value } : {}),
      ...(event.currency ? { currency: event.currency } : {}),
      ...(event.reference ? { transaction_id: event.reference } : {}),
      ...(event.payload ?? {}),
    };

    const body = {
      client_id: clientId,
      user_id: event.userId ?? undefined,
      events: [{ name: gaEvent, params }],
    };

    try {
      const url = `https://www.google-analytics.com/mp/collect?measurement_id=${encodeURIComponent(measurementId)}&api_secret=${encodeURIComponent(apiSecret)}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
        cache: 'no-store',
      });
      // GA4 MP returns 204 No Content on success and empty body. Any
      // 4xx/5xx is an error; text() is informational only.
      if (!res.ok) {
        const text = await res.text();
        return { platform: 'ga4', status: `error_HTTP_${res.status}`, errorBody: text.slice(0, 400) };
      }
      return { platform: 'ga4', status: 'ok' };
    } catch (err) {
      return { platform: 'ga4', status: 'error_NETWORK', errorBody: err instanceof Error ? err.message : String(err) };
    }
  },
};
