// Built by Anointed Coder.

import { db } from '@/lib/db/client';
import type { PayoutAdapter, PayoutSettingsSchema } from './types';

async function readSettings() {
  const rows = await db.systemSetting.findMany({
    where: {
      key: {
        in: [
          'payout_rocket_enabled',
          'payment_rocket_merchant_id',
          'payment_rocket_api_key',
          'payment_rocket_api_secret',
          'payout_rocket_callback_secret',
        ],
      },
    },
  });
  const m = new Map<string, string>();
  for (const r of rows) if (r.value && r.value.trim()) m.set(r.key, r.value.trim());
  return {
    enabled: (m.get('payout_rocket_enabled') ?? '0') === '1',
    merchantId: m.get('payment_rocket_merchant_id') ?? null,
    apiKey: m.get('payment_rocket_api_key') ?? null,
    apiSecret: m.get('payment_rocket_api_secret') ?? null,
    callbackSecret: m.get('payout_rocket_callback_secret') ?? null,
  };
}

export const rocketPayout: PayoutAdapter = {
  key: 'rocket',
  label: 'Rocket payout',
  icon: 'phone',
  async configStatus() {
    const cfg = await readSettings();
    if (!cfg.enabled) {
      return { configured: false, status: 'disabled', notes: ['Adapter is disabled in admin settings.'] };
    }
    const missing: string[] = [];
    if (!cfg.merchantId) missing.push('Merchant ID (set under /admin/payments)');
    if (!cfg.apiKey) missing.push('API Key (set under /admin/payments)');
    if (!cfg.apiSecret) missing.push('API Secret (set under /admin/payments)');
    if (!cfg.callbackSecret) missing.push('Payout Callback Secret');
    if (missing.length > 0) {
      return {
        configured: false,
        status: 'requires_credentials',
        notes: [`Missing: ${missing.join(', ')}.`],
      };
    }
    return {
      configured: true,
      status: 'live',
      notes: ['Credentials present. Signature verification is a SCAFFOLD; the real Rocket payout HMAC ships when sandbox is tested.'],
    };
  },
  async verifyWebhook() {
    return null;
  },
};

export const rocketPayoutSettings: PayoutSettingsSchema = {
  fields: [
    { key: 'payout_rocket_enabled', label: 'Enable Rocket payout', kind: 'toggle' },
    { key: 'payout_rocket_callback_secret', label: 'Payout Callback Secret', kind: 'secret' },
  ],
};
