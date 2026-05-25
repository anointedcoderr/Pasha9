// Built by Anointed Coder.
//
// bKash payout adapter SCAFFOLD. Reuses the same payment_bkash_* keys
// because both directions share merchant credentials. The dedicated
// payout_bkash_enabled key gates whether payouts are attempted at all
// (deposit and payout are configured independently).

import { db } from '@/lib/db/client';
import type { PayoutAdapter, PayoutSettingsSchema } from './types';

async function readSettings() {
  const rows = await db.systemSetting.findMany({
    where: {
      key: {
        in: [
          'payout_bkash_enabled',
          'payment_bkash_app_key',
          'payment_bkash_app_secret',
          'payment_bkash_username',
          'payment_bkash_password',
          'payout_bkash_callback_secret',
        ],
      },
    },
  });
  const m = new Map<string, string>();
  for (const r of rows) if (r.value && r.value.trim()) m.set(r.key, r.value.trim());
  return {
    enabled: (m.get('payout_bkash_enabled') ?? '0') === '1',
    appKey: m.get('payment_bkash_app_key') ?? null,
    appSecret: m.get('payment_bkash_app_secret') ?? null,
    username: m.get('payment_bkash_username') ?? null,
    password: m.get('payment_bkash_password') ?? null,
    callbackSecret: m.get('payout_bkash_callback_secret') ?? null,
  };
}

export const bkashPayout: PayoutAdapter = {
  key: 'bkash',
  label: 'bKash payout',
  icon: 'phone',
  async configStatus() {
    const cfg = await readSettings();
    if (!cfg.enabled) {
      return { configured: false, status: 'disabled', notes: ['Adapter is disabled in admin settings.'] };
    }
    const missing: string[] = [];
    if (!cfg.appKey) missing.push('App Key (set under /admin/payments)');
    if (!cfg.appSecret) missing.push('App Secret (set under /admin/payments)');
    if (!cfg.username) missing.push('Username (set under /admin/payments)');
    if (!cfg.password) missing.push('Password (set under /admin/payments)');
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
      notes: ['Credentials present. Signature verification is a SCAFFOLD; the real bKash payout signature check ships when sandbox is tested.'],
    };
  },
  async verifyWebhook() {
    return null;
  },
};

export const bkashPayoutSettings: PayoutSettingsSchema = {
  fields: [
    { key: 'payout_bkash_enabled', label: 'Enable bKash payout', kind: 'toggle' },
    { key: 'payout_bkash_callback_secret', label: 'Payout Callback Secret', kind: 'secret', hint: 'Used to verify X-Signature on payout status webhooks.' },
  ],
};
