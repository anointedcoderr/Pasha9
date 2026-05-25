// Built by Anointed Coder.

import { db } from '@/lib/db/client';
import type { PayoutAdapter, PayoutSettingsSchema } from './types';

async function readSettings() {
  const rows = await db.systemSetting.findMany({
    where: {
      key: {
        in: [
          'payout_nagad_enabled',
          'payment_nagad_merchant_id',
          'payment_nagad_merchant_number',
          'payment_nagad_public_key',
          'payment_nagad_private_key',
          'payout_nagad_callback_secret',
        ],
      },
    },
  });
  const m = new Map<string, string>();
  for (const r of rows) if (r.value && r.value.trim()) m.set(r.key, r.value.trim());
  return {
    enabled: (m.get('payout_nagad_enabled') ?? '0') === '1',
    merchantId: m.get('payment_nagad_merchant_id') ?? null,
    merchantNumber: m.get('payment_nagad_merchant_number') ?? null,
    publicKey: m.get('payment_nagad_public_key') ?? null,
    privateKey: m.get('payment_nagad_private_key') ?? null,
    callbackSecret: m.get('payout_nagad_callback_secret') ?? null,
  };
}

export const nagadPayout: PayoutAdapter = {
  key: 'nagad',
  label: 'Nagad payout',
  icon: 'phone',
  async configStatus() {
    const cfg = await readSettings();
    if (!cfg.enabled) {
      return { configured: false, status: 'disabled', notes: ['Adapter is disabled in admin settings.'] };
    }
    const missing: string[] = [];
    if (!cfg.merchantId) missing.push('Merchant ID (set under /admin/payments)');
    if (!cfg.merchantNumber) missing.push('Merchant Number (set under /admin/payments)');
    if (!cfg.publicKey) missing.push('Nagad Public Key (set under /admin/payments)');
    if (!cfg.privateKey) missing.push('Merchant Private Key (set under /admin/payments)');
    if (!cfg.callbackSecret) missing.push('Payout Callback Secret');
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
      notes: ['Credentials present. Signature verification is a SCAFFOLD; the real Nagad RSA payout scheme ships when sandbox is tested.'],
    };
  },
  async verifyWebhook() {
    return null;
  },
};

export const nagadPayoutSettings: PayoutSettingsSchema = {
  fields: [
    { key: 'payout_nagad_enabled', label: 'Enable Nagad payout', kind: 'toggle' },
    { key: 'payout_nagad_callback_secret', label: 'Payout Callback Secret', kind: 'secret' },
  ],
};
