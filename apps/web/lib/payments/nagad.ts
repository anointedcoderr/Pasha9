// Built by Anointed Coder.
//
// Nagad adapter SCAFFOLD. Same shape as bkash.ts. The signature scheme
// is RSA-SHA256 over a Nagad-defined challenge string; the
// implementation lands when the client supplies sandbox credentials
// and the live merchant private key.

import { db } from '@/lib/db/client';
import type { ProviderAdapter, ProviderSettingsSchema } from './types';

async function readSettings() {
  const rows = await db.systemSetting.findMany({
    where: {
      key: {
        in: [
          'payment_nagad_enabled',
          'payment_nagad_merchant_id',
          'payment_nagad_merchant_number',
          'payment_nagad_public_key',
          'payment_nagad_private_key',
          'payment_nagad_callback_secret',
        ],
      },
    },
  });
  const m = new Map<string, string>();
  for (const r of rows) if (r.value && r.value.trim()) m.set(r.key, r.value.trim());
  return {
    enabled: (m.get('payment_nagad_enabled') ?? '0') === '1',
    merchantId: m.get('payment_nagad_merchant_id') ?? null,
    merchantNumber: m.get('payment_nagad_merchant_number') ?? null,
    publicKey: m.get('payment_nagad_public_key') ?? null,
    privateKey: m.get('payment_nagad_private_key') ?? null,
    callbackSecret: m.get('payment_nagad_callback_secret') ?? null,
  };
}

export const nagadAdapter: ProviderAdapter = {
  key: 'nagad',
  label: 'Nagad',
  icon: 'phone',
  async configStatus() {
    const cfg = await readSettings();
    if (!cfg.enabled) {
      return { configured: false, status: 'disabled', notes: ['Adapter is disabled in admin settings.'] };
    }
    const missing: string[] = [];
    if (!cfg.merchantId) missing.push('Merchant ID');
    if (!cfg.merchantNumber) missing.push('Merchant Number');
    if (!cfg.publicKey) missing.push('Public Key');
    if (!cfg.privateKey) missing.push('Private Key');
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
      notes: ['Credentials present. Signature verification is a SCAFFOLD; the real Nagad RSA scheme ships when sandbox is tested.'],
    };
  },
  async verifyWebhook() {
    return null;
  },
};

export const nagadSettings: ProviderSettingsSchema = {
  fields: [
    { key: 'payment_nagad_enabled', label: 'Enable Nagad', kind: 'toggle' },
    { key: 'payment_nagad_merchant_id', label: 'Merchant ID', kind: 'text' },
    { key: 'payment_nagad_merchant_number', label: 'Merchant Number', kind: 'text' },
    { key: 'payment_nagad_public_key', label: 'Nagad Public Key', kind: 'secret', hint: 'PEM block. Used to verify Nagad-signed responses.' },
    { key: 'payment_nagad_private_key', label: 'Merchant Private Key', kind: 'secret', hint: 'PEM block. Used to sign requests to Nagad.' },
    { key: 'payment_nagad_callback_secret', label: 'Callback Secret', kind: 'secret' },
  ],
};
