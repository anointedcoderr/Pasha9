// Built by Anointed Coder.
//
// Shared TypeScript shapes for the payment provider adapter layer.
// Adapters live in apps/web/lib/payments/<provider>.ts and register
// themselves with the registry so the webhook route + admin UI can
// discover them without hardcoding provider keys.

export type ProviderKey = 'manual' | 'test' | 'bkash' | 'nagad' | 'rocket' | 'chaopaopay' | 'zinipay' | 'starpay';

export type ProviderStatus =
  | 'live'              // configured + ready to verify webhooks
  | 'requires_credentials'
  | 'disabled'
  | 'manual';           // always-live, no webhook (admin approves by hand)

export interface ProviderEvent {
  /** The provider's own transaction identifier. */
  providerTxId: string;
  /** Amount in BDT. */
  amount: number;
  currency: string;
  /** success / failed / pending as the provider reports it. */
  status: 'success' | 'failed' | 'pending';
  /** Reference the user supplied (TX ID, deposit id, etc) when initiating. */
  reference?: string | null;
  /** True only when the adapter has verified the webhook signature. */
  signatureValid: boolean;
  /** Whatever raw payload the provider posted; stored for support replay. */
  rawPayload: unknown;
  /** Free-form provider metadata. */
  meta?: Record<string, unknown>;
}

export interface AdapterConfigStatus {
  configured: boolean;
  status: ProviderStatus;
  notes?: string[];
}

export interface ProviderAdapter {
  key: ProviderKey;
  label: string;
  /** Logo / icon name (lucide). */
  icon: 'wallet' | 'phone' | 'banknote' | 'flask-conical' | 'shield-check';
  /** Reads SystemSetting rows and decides whether the adapter is ready. */
  configStatus(): Promise<AdapterConfigStatus>;
  /**
   * Verify and parse an inbound webhook. Returns null when the
   * signature cannot be verified or the payload shape is wrong.
   * Adapters MUST set signatureValid=true only when they have
   * cryptographically verified the request.
   */
  verifyWebhook(headers: Headers, rawBody: string): Promise<ProviderEvent | null>;
}

/** SystemSetting keys this adapter family owns. Used for the admin UI. */
export interface ProviderSettingsSchema {
  fields: Array<{
    key: string;          // SystemSetting key, eg "payment_bkash_app_secret"
    label: string;
    kind: 'text' | 'secret' | 'toggle' | 'select' | 'image';
    options?: string[];   // for kind=select
    hint?: string;
  }>;
}
