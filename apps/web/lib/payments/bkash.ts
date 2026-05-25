// Built by Anointed Coder.
//
// bKash adapter SCAFFOLD. M2B ships the credentials + webhook plumbing
// and a stub verifier that always rejects until the client supplies
// real merchant credentials. When credentials land, this file is the
// only place we need to implement bKash's documented signature scheme.
// The webhook route + reconciliation log + auto-approve flow are
// already wired against this interface.

import { db } from '@/lib/db/client';
import type { ProviderAdapter, ProviderSettingsSchema } from './types';

async function readSettings() {
  const rows = await db.systemSetting.findMany({
    where: {
      key: {
        in: [
          'payment_bkash_enabled',
          'payment_bkash_app_key',
          'payment_bkash_app_secret',
          'payment_bkash_username',
          'payment_bkash_password',
          'payment_bkash_callback_secret',
        ],
      },
    },
  });
  const m = new Map<string, string>();
  for (const r of rows) if (r.value && r.value.trim()) m.set(r.key, r.value.trim());
  return {
    enabled: (m.get('payment_bkash_enabled') ?? '0') === '1',
    appKey: m.get('payment_bkash_app_key') ?? null,
    appSecret: m.get('payment_bkash_app_secret') ?? null,
    username: m.get('payment_bkash_username') ?? null,
    password: m.get('payment_bkash_password') ?? null,
    callbackSecret: m.get('payment_bkash_callback_secret') ?? null,
  };
}

export const bkashAdapter: ProviderAdapter = {
  key: 'bkash',
  label: 'bKash',
  icon: 'phone',
  async configStatus() {
    const cfg = await readSettings();
    if (!cfg.enabled) {
      return { configured: false, status: 'disabled', notes: ['Adapter is disabled in admin settings.'] };
    }
    const missing: string[] = [];
    if (!cfg.appKey) missing.push('App Key');
    if (!cfg.appSecret) missing.push('App Secret');
    if (!cfg.username) missing.push('Username');
    if (!cfg.password) missing.push('Password');
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
      notes: ['Credentials present. Signature verification is a SCAFFOLD; the real bKash signature check ships when sandbox credentials are tested end to end.'],
    };
  },
  async verifyWebhook() {
    // Real bKash signature verification lands when the client supplies
    // sandbox credentials. Until then, every webhook is logged in
    // PaymentGatewayTx with signatureValid=false so support can review.
    return null;
  },
};

export const bkashSettings: ProviderSettingsSchema = {
  fields: [
    { key: 'payment_bkash_enabled', label: 'Enable bKash', kind: 'toggle' },
    { key: 'payment_bkash_app_key', label: 'App Key', kind: 'text' },
    { key: 'payment_bkash_app_secret', label: 'App Secret', kind: 'secret' },
    { key: 'payment_bkash_username', label: 'Merchant Username', kind: 'text' },
    { key: 'payment_bkash_password', label: 'Merchant Password', kind: 'secret' },
    { key: 'payment_bkash_callback_secret', label: 'Callback Secret', kind: 'secret', hint: 'Used to verify the X-Signature header on incoming webhooks.' },
  ],
};
