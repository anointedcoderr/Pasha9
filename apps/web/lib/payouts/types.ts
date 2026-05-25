// Built by Anointed Coder.
//
// Outbound payout adapter interfaces. Mirrors lib/payments/types.ts
// but for the money-leaving direction. A payout adapter either
// initiates an outbound transfer to the user's account (when the
// gateway supports it) and/or accepts status webhooks from the
// gateway when the payout settles.
//
// For M2C, all real providers are scaffolds. The manual + test
// adapters are immediately usable.

export type PayoutProviderKey = 'manual' | 'test' | 'bkash' | 'nagad' | 'rocket';

export type PayoutProviderStatus = 'live' | 'requires_credentials' | 'disabled' | 'manual';

/** Status callback from a gateway after attempting / completing a payout. */
export interface PayoutEvent {
  providerTxId: string;
  reference?: string | null;  // local Withdrawal.id or admin-set ref
  amount: number;
  currency: string;
  status: 'paid' | 'failed' | 'pending';
  signatureValid: boolean;
  rawPayload: unknown;
  meta?: Record<string, unknown>;
}

export interface PayoutConfigStatus {
  configured: boolean;
  status: PayoutProviderStatus;
  notes?: string[];
}

export interface PayoutAdapter {
  key: PayoutProviderKey;
  label: string;
  icon: 'wallet' | 'phone' | 'banknote' | 'flask-conical' | 'shield-check';
  configStatus(): Promise<PayoutConfigStatus>;
  /**
   * Verify a payout-status webhook. Same contract as the inbound
   * verifier: signatureValid must only be true when cryptographically
   * verified.
   */
  verifyWebhook(headers: Headers, rawBody: string): Promise<PayoutEvent | null>;
}

export interface PayoutSettingsSchema {
  fields: Array<{
    key: string;
    label: string;
    kind: 'text' | 'secret' | 'toggle' | 'select';
    options?: string[];
    hint?: string;
  }>;
}
