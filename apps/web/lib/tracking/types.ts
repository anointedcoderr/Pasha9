// Built by Anointed Coder.
//
// M2I tracking layer. One canonical event shape gets dispatched to
// every enabled platform (FB, TikTok, GA4, Google Ads) by the
// server-side dispatcher. Web pixels (browser) consume the same
// event names so the funnel reports line up.

export type TrackingEventName =
  | 'signup'
  | 'login'
  | 'deposit'
  | 'withdrawal'
  | 'lotto_bet'
  | 'bonus_claim'
  | 'custom';

export interface TrackingEventInput {
  event: TrackingEventName;
  /** server | client. server fires use platform CAPI/Events API. */
  source?: 'server' | 'client';
  userId?: string | null;
  value?: number;
  currency?: string;            // default BDT
  reference?: string;           // depositId, withdrawalId, etc
  payload?: Record<string, unknown>;
  /** Pre-hashed email / phone if available. Server hashes if absent. */
  ip?: string | null;
  userAgent?: string | null;
  emailLowercase?: string | null;
  phoneE164?: string | null;
}

export type PlatformKey = 'facebook' | 'tiktok' | 'ga4' | 'google_ads';

export interface PlatformAdapter {
  readonly key: PlatformKey;
  readonly label: string;
  /** Adapter decides if it can dispatch given current settings. */
  isLive(settings: Record<string, string>): boolean;
  /** Fire one event. Must never throw - return result instead. */
  dispatch(event: TrackingEventInput, settings: Record<string, string>): Promise<DispatchResult>;
  /** Which SystemSetting keys this adapter reads. */
  readonly settingKeys: string[];
}

export interface DispatchResult {
  platform: PlatformKey;
  status: 'ok' | 'skipped_no_id' | 'skipped_no_token' | `error_${string}`;
  ref?: string;
  errorBody?: string;
}
