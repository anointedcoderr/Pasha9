// Built by Anointed Coder.
//
// TikTok Events API (server-side) adapter. Reads:
//   pixel_tiktok                 web pixel ID (used by client TTQ)
//   pixel_tiktok_access_token    Events API access token
//
// Without the access token, server-side fires are skipped (the web
// pixel still works browser-side via TrackingScripts).

import { createHash } from 'crypto';
import type { PlatformAdapter, TrackingEventInput, DispatchResult } from './types';

const TT_EVENT_MAP: Record<string, string> = {
  signup: 'CompleteRegistration',
  login: 'ClickButton',
  deposit: 'CompletePayment',
  withdrawal: 'Withdraw',
  lotto_bet: 'PlaceAnOrder',
  bonus_claim: 'Subscribe',
  custom: 'ViewContent',
};

function sha256(s: string): string {
  return createHash('sha256').update(s.toLowerCase().trim()).digest('hex');
}

export const tiktokAdapter: PlatformAdapter = {
  key: 'tiktok',
  label: 'TikTok',
  settingKeys: ['pixel_tiktok', 'pixel_tiktok_access_token'],
  isLive(settings) {
    return !!(settings.pixel_tiktok?.trim() && settings.pixel_tiktok_access_token?.trim());
  },
  async dispatch(event, settings): Promise<DispatchResult> {
    const pixelCode = settings.pixel_tiktok?.trim();
    const token = settings.pixel_tiktok_access_token?.trim();
    if (!pixelCode) return { platform: 'tiktok', status: 'skipped_no_id' };
    if (!token) return { platform: 'tiktok', status: 'skipped_no_token' };

    const ttEvent = TT_EVENT_MAP[event.event] ?? 'ViewContent';
    const user: Record<string, unknown> = {};
    if (event.emailLowercase) user.email = sha256(event.emailLowercase);
    if (event.phoneE164) user.phone_number = sha256(event.phoneE164.replace(/[^\d]/g, ''));
    if (event.userId) user.external_id = sha256(event.userId);
    if (event.ip) user.ip = event.ip;
    if (event.userAgent) user.user_agent = event.userAgent;

    const body = {
      event_source: 'web',
      event_source_id: pixelCode,
      data: [
        {
          event: ttEvent,
          event_time: Math.floor(Date.now() / 1000),
          event_id: event.reference,
          user,
          properties: {
            ...(event.value != null ? { value: event.value } : {}),
            ...(event.currency ? { currency: event.currency } : {}),
            ...(event.reference ? { content_id: event.reference } : {}),
            ...(event.payload ?? {}),
          },
        },
      ],
    };

    try {
      const res = await fetch('https://business-api.tiktok.com/open_api/v1.3/event/track/', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'access-token': token,
        },
        body: JSON.stringify(body),
        cache: 'no-store',
      });
      const text = await res.text();
      if (!res.ok) return { platform: 'tiktok', status: `error_HTTP_${res.status}`, errorBody: text.slice(0, 400) };
      let ref: string | undefined;
      try {
        const json = JSON.parse(text) as { request_id?: string };
        ref = json.request_id;
      } catch { /* ignore */ }
      return { platform: 'tiktok', status: 'ok', ref };
    } catch (err) {
      return { platform: 'tiktok', status: 'error_NETWORK', errorBody: err instanceof Error ? err.message : String(err) };
    }
  },
};
