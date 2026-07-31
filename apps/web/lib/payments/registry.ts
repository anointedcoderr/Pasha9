// Built by Anointed Coder.
//
// Single source of truth for available payment provider adapters and
// their admin settings schemas. The webhook route, admin payments
// page and reconciliation page all walk this registry; new providers
// only need to be appended here.

import { manualAdapter, manualSettings } from './manual';
import { testAdapter, testSettings } from './test';
import { bkashAdapter, bkashSettings } from './bkash';
import { nagadAdapter, nagadSettings } from './nagad';
import { rocketAdapter, rocketSettings } from './rocket';
import { chaopaopayAdapter, chaopaopaySettings } from './chaopaopay';
import { zinipayAdapter, zinipaySettings } from './zinipay';
import { starpayAdapter, starpaySettings } from './starpay';
import type { ProviderAdapter, ProviderKey, ProviderSettingsSchema } from './types';

interface Entry {
  adapter: ProviderAdapter;
  settings: ProviderSettingsSchema;
  description: string;
}

const REGISTRY: Record<ProviderKey, Entry> = {
  manual: {
    adapter: manualAdapter,
    settings: manualSettings,
    description: 'Authoritative fallback. Users submit a TX ID + proof and admin approves at /admin/deposits.',
  },
  test: {
    adapter: testAdapter,
    settings: testSettings,
    description: 'Shared-secret test gateway for QA. Useful to exercise the webhook -> reconciliation -> auto-approve pipeline without a real provider.',
  },
  bkash: {
    adapter: bkashAdapter,
    settings: bkashSettings,
    description: 'bKash payment gateway. Requires merchant credentials. Signature verification scaffold ships in M2B; final implementation lands when sandbox credentials are tested end to end.',
  },
  nagad: {
    adapter: nagadAdapter,
    settings: nagadSettings,
    description: 'Nagad payment gateway. Requires merchant credentials + RSA key pair. Signature scaffold ships in M2B.',
  },
  rocket: {
    adapter: rocketAdapter,
    settings: rocketSettings,
    description: 'Rocket payment gateway. Requires merchant credentials + HMAC secret. Signature scaffold ships in M2B.',
  },
  chaopaopay: {
    adapter: chaopaopayAdapter,
    settings: chaopaopaySettings,
    description: 'ChaopaoPay BD aggregator. One merchant account covers both bKash (method_code 101) and Nagad (method_code 102). Webhook signature verification is live; payouts require the withdraw password.',
  },
  zinipay: {
    adapter: zinipayAdapter,
    settings: zinipaySettings,
    description: 'ZinIPay hosted-payment-page deposit gateway (player picks bKash/Nagad/Rocket on the gateway screen). No HMAC published, so the webhook handler re-calls /v1/payment/verify before crediting any deposit. No payout endpoint - withdrawals continue via ChaopaoPay or manual.',
  },
  starpay: {
    adapter: starpayAdapter,
    settings: starpaySettings,
    description: 'StarPay (stp1.starpay1.com) BD deposit gateway (bKash/Nagad/Rocket via hosted page/QR). MD5-signed both ways, so the signed callback is verified locally before crediting. Callback is at /api/payments/starpay/callback and acknowledged with plain-text SUCCESS. Disabled by default; payouts pending the provider payout spec.',
  },
};

export const PROVIDER_KEYS = Object.keys(REGISTRY) as ProviderKey[];

export function getAdapter(key: string): ProviderAdapter | null {
  if (!Object.prototype.hasOwnProperty.call(REGISTRY, key)) return null;
  return REGISTRY[key as ProviderKey].adapter;
}

export function getSettingsSchema(key: ProviderKey): ProviderSettingsSchema {
  return REGISTRY[key].settings;
}

export function describeAdapter(key: ProviderKey): string {
  return REGISTRY[key].description;
}

export async function listProviderSummaries() {
  return Promise.all(
    PROVIDER_KEYS.map(async (key) => {
      const entry = REGISTRY[key];
      const status = await entry.adapter.configStatus();
      return {
        key,
        label: entry.adapter.label,
        icon: entry.adapter.icon,
        description: entry.description,
        fields: entry.settings.fields,
        status,
      };
    }),
  );
}
