// Built by Anointed Coder.
//
// Google Ads conversion tracking adapter. Two parts:
//   - Web pixel (gtag) handled by the client TrackingScripts component
//   - Server-side enhanced conversions / offline import is a bigger
//     project that requires the Google Ads API + OAuth. For M2I we
//     surface the conversion id + conversion label so the gtag
//     snippet can fire them, and the server adapter is a no-op stub
//     that logs the event for future migration.
//
// Reads:
//   analytics_google_ads             AW-XXXX conversion id (used by client gtag)
//   analytics_google_ads_conv_label  optional conversion label

import type { PlatformAdapter, TrackingEventInput, DispatchResult } from './types';

export const googleAdsAdapter: PlatformAdapter = {
  key: 'google_ads',
  label: 'Google Ads',
  settingKeys: ['analytics_google_ads', 'analytics_google_ads_conv_label'],
  isLive(settings) {
    return !!settings.analytics_google_ads?.trim();
  },
  async dispatch(event, settings): Promise<DispatchResult> {
    const id = settings.analytics_google_ads?.trim();
    if (!id) return { platform: 'google_ads', status: 'skipped_no_id' };

    // No server-to-server send for M2I. Document the intent and
    // return ok so the dashboard shows the event was acknowledged.
    // Browser-side gtag(send) handles the live conversion.
    console.info('[tracking][google_ads] event ack (gtag handles live)', {
      event: event.event,
      reference: event.reference,
      value: event.value,
      conversionId: id,
    });
    return { platform: 'google_ads', status: 'ok' };
  },
};
