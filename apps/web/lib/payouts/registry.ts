// Built by Anointed Coder.

import { manualPayout, manualPayoutSettings } from './manual';
import { testPayout, testPayoutSettings } from './test';
import { bkashPayout, bkashPayoutSettings } from './bkash';
import { nagadPayout, nagadPayoutSettings } from './nagad';
import { rocketPayout, rocketPayoutSettings } from './rocket';
import { chaopaopayPayout, chaopaopayPayoutSettings } from './chaopaopay';
import type { PayoutAdapter, PayoutProviderKey, PayoutSettingsSchema } from './types';

interface Entry {
  adapter: PayoutAdapter;
  settings: PayoutSettingsSchema;
  description: string;
}

const REGISTRY: Record<PayoutProviderKey, Entry> = {
  manual: {
    adapter: manualPayout,
    settings: manualPayoutSettings,
    description: 'Authoritative fallback. Admin pays the user out of band and clicks Mark Paid at /admin/withdrawals.',
  },
  test: {
    adapter: testPayout,
    settings: testPayoutSettings,
    description: 'Shared-secret test gateway for QA. Posts payout status webhooks back to /api/payouts/webhook/test.',
  },
  bkash: {
    adapter: bkashPayout,
    settings: bkashPayoutSettings,
    description: 'bKash payout. Reuses the deposit-side merchant credentials. Signature scaffold ships in M2C; final implementation lands when sandbox is tested.',
  },
  nagad: {
    adapter: nagadPayout,
    settings: nagadPayoutSettings,
    description: 'Nagad payout. Reuses the deposit-side merchant credentials + RSA key pair. Signature scaffold ships in M2C.',
  },
  rocket: {
    adapter: rocketPayout,
    settings: rocketPayoutSettings,
    description: 'Rocket payout. Reuses the deposit-side merchant credentials + HMAC secret. Signature scaffold ships in M2C.',
  },
  chaopaopay: {
    adapter: chaopaopayPayout,
    settings: chaopaopayPayoutSettings,
    description: 'ChaopaoPay payout. Reuses the deposit-side credentials plus the withdraw password (separate field). One adapter covers bKash + Nagad payouts via method_code 101 / 102.',
  },
};

export const PAYOUT_PROVIDER_KEYS = Object.keys(REGISTRY) as PayoutProviderKey[];

export function getPayoutAdapter(key: string): PayoutAdapter | null {
  if (!Object.prototype.hasOwnProperty.call(REGISTRY, key)) return null;
  return REGISTRY[key as PayoutProviderKey].adapter;
}

export function getPayoutSettings(key: PayoutProviderKey): PayoutSettingsSchema {
  return REGISTRY[key].settings;
}

export async function listPayoutSummaries() {
  return Promise.all(
    PAYOUT_PROVIDER_KEYS.map(async (key) => {
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
