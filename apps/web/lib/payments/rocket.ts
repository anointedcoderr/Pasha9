// Built by Anointed Coder.
//
// Rocket adapter SCAFFOLD. Same shape as the other provider stubs.
// Rocket uses a merchant-ID + API-key + HMAC-SHA256 webhook signature
// per their documentation; the verifier ships when credentials are
// configured.

import { db } from '@/lib/db/client';
import type { ProviderAdapter, ProviderSettingsSchema } from './types';

async function readSettings() {
  const rows = await db.systemSetting.findMany({
    where: {
      key: {
        in: [
          'payment_rocket_enabled',
          'payment_rocket_merchant_id',
          'payment_rocket_api_key',
          'payment_rocket_api_secret',
          'payment_rocket_callback_secret',
        ],
      },
    },
  });
  const m = new Map<string, string>();
  for (const r of rows) if (r.value && r.value.trim()) m.set(r.key, r.value.trim());
  return {
    enabled: (m.get('payment_rocket_enabled') ?? '0') === '1',
    merchantId: m.get('payment_rocket_merchant_id') ?? null,
    apiKey: m.get('payment_rocket_api_key') ?? null,
    apiSecret: m.get('payment_rocket_api_secret') ?? null,
    callbackSecret: m.get('payment_rocket_callback_secret') ?? null,
  };
}

export const rocketAdapter: ProviderAdapter = {
  key: 'rocket',
  label: 'Rocket',
  icon: 'phone',
  async configStatus() {
    const cfg = await readSettings();
    if (!cfg.enabled) {
      return { configured: false, status: 'disabled', notes: ['Adapter is disabled in admin settings.'] };
    }
    const missing: string[] = [];
    if (!cfg.merchantId) missing.push('Merchant ID');
    if (!cfg.apiKey) missing.push('API Key');
    if (!cfg.apiSecret) missing.push('API Secret');
    if (!cfg.callbackSecret) missing.push('Callback Secret');
    if (missing.length > 0) {
      return {
        configured: false,
        status: 'requires_credentials',
        notes: [`Missing: ${missing.join(', ')}.`, 'Webhook verification will reject every request until credentials are filled in.'],
      };
    }
    return {
      configured: true,
      status: 'live',
      notes: ['Credentials present. Signature verification is a SCAFFOLD; the real Rocket HMAC scheme ships when sandbox is tested.'],
    };
  },
  async verifyWebhook() {
    return null;
  },
};

export const rocketSettings: ProviderSettingsSchema = {
  fields: [
    { key: 'payment_rocket_enabled', label: 'Enable Rocket', kind: 'toggle' },
    { key: 'payment_rocket_merchant_id', label: 'Merchant ID', kind: 'text' },
    { key: 'payment_rocket_api_key', label: 'API Key', kind: 'text' },
    { key: 'payment_rocket_api_secret', label: 'API Secret', kind: 'secret' },
    { key: 'payment_rocket_callback_secret', label: 'Callback Secret', kind: 'secret' },
  ],
};
