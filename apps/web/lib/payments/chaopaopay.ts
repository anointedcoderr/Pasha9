// Built by Anointed Coder.
//
// ChaopaoPay (BD aggregator at bd-api.chaopaopay.cc) adapter.
// Aggregator that bundles bKash + Nagad behind one merchant account,
// so the operator only manages one set of credentials instead of two.
//
// What this file owns:
//   - Settings reader for /admin/payments
//   - configStatus diagnostics
//   - Webhook signature verification + ProviderEvent mapping
//
// What the sibling chaopaopay-client.ts owns:
//   - Outbound HTTP calls (create deposit, check status, payouts)
//
// Webhook contract published in the ChaopaoPay docs:
//   POST <our callback_url>
//   {
//     transaction_id: "TRX...",
//     trx_id: "PAY-...",
//     type: "payin" | "payout",
//     amount: 1500.00,
//     currency: "BDT",
//     status: "completed" | "failed" | "pending" | "processing" | "cancelled" | "refunded",
//     customer_name: "John Doe",
//     updated_at: "2025-...",
//     signature: "sha256_hash"
//   }
// signature = sha256( transaction_id . trx_id . status . secret_key )
//
// The secret key lives in SystemSetting key
// 'payment_chaopaopay_secret_key' and is never sent over the wire to
// the gateway - it is shared at merchant onboarding only and used to
// authenticate callbacks coming the other direction.

import { createHash } from 'crypto';
import { db } from '@/lib/db/client';
import type { ProviderAdapter, ProviderEvent, ProviderSettingsSchema } from './types';
import { mapChaopaoPayStatus } from './chaopaopay-client';

async function readSettings() {
  const rows = await db.systemSetting.findMany({
    where: {
      key: {
        in: [
          'payment_chaopaopay_enabled',
          'payment_chaopaopay_base_url',
          'payment_chaopaopay_merchant_id',
          'payment_chaopaopay_api_key',
          'payment_chaopaopay_secret_key',
          'payment_chaopaopay_withdraw_password',
          'payment_chaopaopay_bkash_icon',
          'payment_chaopaopay_nagad_icon',
        ],
      },
    },
  });
  const m = new Map<string, string>();
  for (const r of rows) if (r.value && r.value.trim()) m.set(r.key, r.value.trim());
  return {
    enabled: (m.get('payment_chaopaopay_enabled') ?? '0') === '1',
    baseUrl: m.get('payment_chaopaopay_base_url') ?? 'https://bd-api.chaopaopay.cc/api/v1',
    merchantId: m.get('payment_chaopaopay_merchant_id') ?? null,
    apiKey: m.get('payment_chaopaopay_api_key') ?? null,
    secretKey: m.get('payment_chaopaopay_secret_key') ?? null,
    withdrawPassword: m.get('payment_chaopaopay_withdraw_password') ?? null,
    bkashIcon: m.get('payment_chaopaopay_bkash_icon') ?? null,
    nagadIcon: m.get('payment_chaopaopay_nagad_icon') ?? null,
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

export const chaopaopayAdapter: ProviderAdapter = {
  key: 'chaopaopay',
  label: 'ChaopaoPay (bKash + Nagad)',
  icon: 'wallet',

  async configStatus() {
    const cfg = await readSettings();
    if (!cfg.enabled) {
      return { configured: false, status: 'disabled', notes: ['Adapter is disabled in admin settings. Toggle Enable ChaopaoPay under /admin/payments.'] };
    }
    const missing: string[] = [];
    if (!cfg.merchantId) missing.push('Merchant ID');
    if (!cfg.apiKey) missing.push('API Key');
    if (!cfg.secretKey) missing.push('Secret Key (for webhook signature verification)');
    if (missing.length > 0) {
      return {
        configured: false,
        status: 'requires_credentials',
        notes: [
          `Missing: ${missing.join(', ')}.`,
          'Every incoming webhook will be logged with signatureValid=false until these are filled in.',
          'Payouts also require the withdraw password (separate field) but deposits work without it.',
        ],
      };
    }
    const payoutReady = !!cfg.withdrawPassword;
    return {
      configured: true,
      status: 'live',
      notes: [
        'Credentials present. Deposits + status-check + webhook signature verification are live.',
        payoutReady
          ? 'Withdraw password set - payouts are also live.'
          : 'Withdraw password NOT set - payouts will return INVALID_WITHDRAW_PASS until the operator adds it.',
      ],
    };
  },

  async verifyWebhook(headers, rawBody): Promise<ProviderEvent | null> {
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

    if (!transactionId || !trxId || !status || !incomingSignature) {
      return null;
    }

    const cfg = await readSettings();
    if (!cfg.enabled || !cfg.secretKey) {
      // We have no key to verify against - cannot trust this webhook.
      return null;
    }

    const expected = computeSignature(transactionId, trxId, status, cfg.secretKey);
    const valid = expected.toLowerCase() === incomingSignature;

    if (!valid) {
      // Signature mismatch. Return an event with signatureValid=false so
      // the route still gets a PaymentGatewayTx row written for audit,
      // but the service layer refuses to credit the wallet.
      return {
        providerTxId: transactionId,
        amount,
        currency,
        status: mapChaopaoPayStatus(status),
        reference: trxId,
        signatureValid: false,
        rawPayload: payload,
        meta: {
          chaopaopay: {
            type: payload.type ?? null,
            customer_name: payload.customer_name ?? null,
            updated_at: payload.updated_at ?? null,
            signatureExpected: expected,
            signatureReceived: incomingSignature,
          },
        },
      };
    }

    return {
      providerTxId: transactionId,
      amount,
      currency,
      status: mapChaopaoPayStatus(status),
      reference: trxId,
      signatureValid: true,
      rawPayload: payload,
      meta: {
        chaopaopay: {
          type: payload.type ?? null,
          customer_name: payload.customer_name ?? null,
          updated_at: payload.updated_at ?? null,
          rawStatus: status,
        },
      },
    };
  },
};

export const chaopaopaySettings: ProviderSettingsSchema = {
  fields: [
    { key: 'payment_chaopaopay_enabled', label: 'Enable ChaopaoPay', kind: 'toggle' },
    { key: 'payment_chaopaopay_base_url', label: 'Base URL', kind: 'text', hint: 'Defaults to https://bd-api.chaopaopay.cc/api/v1 . Override only if ChaopaoPay gives you a sandbox host.' },
    { key: 'payment_chaopaopay_merchant_id', label: 'Merchant ID', kind: 'text', hint: 'Visible top-right of the ChaopaoPay merchant panel.' },
    { key: 'payment_chaopaopay_api_key', label: 'API Key (pk_...)', kind: 'text', hint: 'From the API Credentials section of the merchant panel.' },
    { key: 'payment_chaopaopay_secret_key', label: 'Secret Key (sk_...)', kind: 'secret', hint: 'Used to verify webhook signatures. Never exposed publicly.' },
    { key: 'payment_chaopaopay_withdraw_password', label: 'Withdraw Password', kind: 'secret', hint: 'Required for payouts only. Set when withdrawal automation is enabled.' },
    { key: 'payment_chaopaopay_auto_payout_on_approve', label: 'Auto-payout on approval', kind: 'toggle', hint: 'When ON, approving a bKash/Nagad withdrawal in /admin/withdrawals also fires the ChaopaoPay payout immediately. When OFF, the operator uses the two-click "Send via ChaopaoPay" button. Defaults OFF for safety.' },
    { key: 'payment_chaopaopay_bkash_icon', label: 'bKash tile icon', kind: 'image', hint: 'Square PNG/JPG/WebP/SVG shown on the deposit tile grid. Leave empty to use the built-in bK badge.' },
    { key: 'payment_chaopaopay_nagad_icon', label: 'Nagad tile icon', kind: 'image', hint: 'Square PNG/JPG/WebP/SVG shown on the deposit tile grid. Leave empty to use the built-in N badge.' },
  ],
};
