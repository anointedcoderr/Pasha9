// Built by Anointed Coder.
//
// ChaopaoPay payout-side adapter. Same SHA-256 signature scheme as
// the deposit-side webhook, just listened for on the outbound webhook
// route (/api/payouts/webhook/chaopaopay). Reuses the deposit-side
// credentials (api_key, secret_key, merchant_id) and additionally
// requires the operator-set withdraw_password before this adapter
// will report itself live.

import { createHash } from 'crypto';
import { db } from '@/lib/db/client';
import type { PayoutAdapter, PayoutEvent, PayoutSettingsSchema } from './types';
import { mapChaopaoPayPayoutStatus } from '@/lib/payments/chaopaopay-client';

async function readSettings() {
  const rows = await db.systemSetting.findMany({
    where: {
      key: {
        in: [
          'payment_chaopaopay_enabled',
          'payment_chaopaopay_merchant_id',
          'payment_chaopaopay_api_key',
          'payment_chaopaopay_secret_key',
          'payment_chaopaopay_withdraw_password',
        ],
      },
    },
  });
  const m = new Map<string, string>();
  for (const r of rows) if (r.value && r.value.trim()) m.set(r.key, r.value.trim());
  return {
    enabled: (m.get('payment_chaopaopay_enabled') ?? '0') === '1',
    merchantId: m.get('payment_chaopaopay_merchant_id') ?? null,
    apiKey: m.get('payment_chaopaopay_api_key') ?? null,
    secretKey: m.get('payment_chaopaopay_secret_key') ?? null,
    withdrawPassword: m.get('payment_chaopaopay_withdraw_password') ?? null,
  };
}

function computeSignature(transactionId: string, trxId: string, status: string, secretKey: string): string {
  return createHash('sha256')
    .update(`${transactionId}${trxId}${status}${secretKey}`)
    .digest('hex');
}

interface WebhookPayload {
  transaction_id?: string;
  trx_id?: string;
  type?: string;
  amount?: number | string;
  currency?: string;
  status?: string;
  customer_name?: string;
  updated_at?: string;
  signature?: string;
}

export const chaopaopayPayout: PayoutAdapter = {
  key: 'chaopaopay' as PayoutAdapter['key'],
  label: 'ChaopaoPay payout (bKash + Nagad)',
  icon: 'wallet',
  async configStatus() {
    const cfg = await readSettings();
    if (!cfg.enabled) {
      return { configured: false, status: 'disabled', notes: ['ChaopaoPay is disabled in admin settings.'] };
    }
    const missing: string[] = [];
    if (!cfg.merchantId) missing.push('Merchant ID');
    if (!cfg.apiKey) missing.push('API Key');
    if (!cfg.secretKey) missing.push('Secret Key');
    if (!cfg.withdrawPassword) missing.push('Withdraw Password');
    if (missing.length > 0) {
      return {
        configured: false,
        status: 'requires_credentials',
        notes: [`Missing: ${missing.join(', ')}.`, 'Withdraw password is the field that gates payouts specifically - deposits work without it.'],
      };
    }
    return {
      configured: true,
      status: 'live',
      notes: ['All payout credentials present. ChaopaoPay /payout/create.php is ready.'],
    };
  },
  async verifyWebhook(headers, rawBody): Promise<PayoutEvent | null> {
    let payload: WebhookPayload;
    try {
      payload = JSON.parse(rawBody) as WebhookPayload;
    } catch {
      return null;
    }
    const transactionId = typeof payload.transaction_id === 'string' ? payload.transaction_id.trim() : '';
    const trxId = typeof payload.trx_id === 'string' ? payload.trx_id.trim() : '';
    const status = typeof payload.status === 'string' ? payload.status.trim() : '';
    const incomingSignature = typeof payload.signature === 'string' ? payload.signature.trim().toLowerCase() : '';
    const amount = Number(payload.amount ?? 0);
    const currency = typeof payload.currency === 'string' && payload.currency.trim() ? payload.currency.trim() : 'BDT';
    if (!transactionId || !trxId || !status || !incomingSignature) return null;

    const cfg = await readSettings();
    if (!cfg.enabled || !cfg.secretKey) return null;
    const expected = computeSignature(transactionId, trxId, status, cfg.secretKey);
    const valid = expected.toLowerCase() === incomingSignature;
    return {
      providerTxId: transactionId,
      reference: trxId,
      amount,
      currency,
      status: mapChaopaoPayPayoutStatus(status),
      signatureValid: valid,
      rawPayload: payload,
      meta: {
        chaopaopay: {
          type: payload.type ?? null,
          rawStatus: status,
          updated_at: payload.updated_at ?? null,
          ...(valid ? {} : { signatureExpected: expected, signatureReceived: incomingSignature }),
        },
      },
    };
  },
};

export const chaopaopayPayoutSettings: PayoutSettingsSchema = {
  fields: [
    { key: 'payment_chaopaopay_enabled', label: 'Enable ChaopaoPay', kind: 'toggle' },
    { key: 'payment_chaopaopay_withdraw_password', label: 'Withdraw Password', kind: 'secret', hint: 'Required for payouts. Provided by ChaopaoPay onboarding separately from the API Key / Secret Key.' },
  ],
};
