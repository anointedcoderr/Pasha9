// Built by Anointed Coder.
//
// Facebook Conversions API (server-side) adapter. Reads:
//   pixel_facebook                 web pixel ID (also used by client)
//   pixel_facebook_capi_token      Conversions API access token
//   pixel_facebook_test_event_code optional, for the Test Events tab
//
// Without the CAPI token, server-side fires are skipped (the web
// pixel still works browser-side via TrackingScripts).

import { createHash } from 'crypto';
import type { PlatformAdapter, TrackingEventInput, DispatchResult } from './types';

const FB_EVENT_MAP: Record<string, string> = {
  signup: 'CompleteRegistration',
  login: 'Login',
  deposit: 'Purchase',
  withdrawal: 'Withdraw',
  lotto_bet: 'Purchase',
  bonus_claim: 'CustomEvent',
  custom: 'CustomEvent',
};

function sha256(s: string): string {
  return createHash('sha256').update(s.toLowerCase().trim()).digest('hex');
}

export const facebookAdapter: PlatformAdapter = {
  key: 'facebook',
  label: 'Facebook',
  settingKeys: ['pixel_facebook', 'pixel_facebook_capi_token', 'pixel_facebook_test_event_code'],
  isLive(settings) {
    return !!(settings.pixel_facebook?.trim() && settings.pixel_facebook_capi_token?.trim());
  },
  async dispatch(event, settings): Promise<DispatchResult> {
    const pixelId = settings.pixel_facebook?.trim();
    const capiToken = settings.pixel_facebook_capi_token?.trim();
    const testCode = settings.pixel_facebook_test_event_code?.trim();
    if (!pixelId) return { platform: 'facebook', status: 'skipped_no_id' };
    if (!capiToken) return { platform: 'facebook', status: 'skipped_no_token' };

    const fbEvent = FB_EVENT_MAP[event.event] ?? 'CustomEvent';
    const userData: Record<string, unknown> = {};
    if (event.emailLowercase) userData.em = [sha256(event.emailLowercase)];
    if (event.phoneE164) userData.ph = [sha256(event.phoneE164.replace(/[^\d]/g, ''))];
    if (event.userId) userData.external_id = [sha256(event.userId)];
    if (event.ip) userData.client_ip_address = event.ip;
    if (event.userAgent) userData.client_user_agent = event.userAgent;

    const body = {
      data: [
        {
          event_name: fbEvent,
          event_time: Math.floor(Date.now() / 1000),
          event_source_url: event.payload?.url ?? null,
          action_source: event.source === 'client' ? 'website' : 'system_generated',
          user_data: userData,
          custom_data: {
            ...(event.value != null ? { value: event.value } : {}),
            ...(event.currency ? { currency: event.currency } : {}),
            ...(event.reference ? { reference: event.reference } : {}),
            ...(event.payload ?? {}),
          },
          event_id: event.reference ?? undefined,
        },
      ],
      ...(testCode ? { test_event_code: testCode } : {}),
    };

    try {
      const url = `https://graph.facebook.com/v18.0/${encodeURIComponent(pixelId)}/events?access_token=${encodeURIComponent(capiToken)}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
        cache: 'no-store',
      });
      const text = await res.text();
      if (!res.ok) return { platform: 'facebook', status: `error_HTTP_${res.status}`, errorBody: text.slice(0, 400) };
      let ref: string | undefined;
      try {
        const json = JSON.parse(text) as { fbtrace_id?: string };
        ref = json.fbtrace_id;
      } catch { /* ignore */ }
      return { platform: 'facebook', status: 'ok', ref };
    } catch (err) {
      return { platform: 'facebook', status: 'error_NETWORK', errorBody: err instanceof Error ? err.message : String(err) };
    }
  },
};
