// Built by Anointed Coder.
//
// ZinIPay adapter for the payment provider registry. The webhook
// signature on this gateway is NOT documented (no HMAC published in
// their docs), so verifyWebhook here unconditionally calls
// /v1/payment/verify against the invoice_id the gateway sent us. Only
// when the verify call returns status=COMPLETED do we report
// signatureValid=true.
//
// What this file owns:
//   - configStatus for /admin/payments
//   - Webhook handler that re-verifies the invoice on every hit
//
// What zinipay-client.ts owns:
//   - Outbound HTTP calls (create payment, verify payment)
//
// Sibling to chaopaopay.ts; both register via lib/payments/registry.ts.

import type { ProviderAdapter, ProviderEvent, ProviderSettingsSchema } from './types';
import { readZinIPaySettings, zinipayVerify } from './zinipay-client';

interface WebhookPayload {
  invoice_id?: string;
  status?: string | boolean;
}

export const zinipayAdapter: ProviderAdapter = {
  // 'chaopaopay' is the only non-mobile-network key on ProviderKey so
  // far; we add 'zinipay' there too. The cast is intentional - the
  // adapter registry treats key as opaque.
  key: 'zinipay' as ProviderAdapter['key'],
  label: 'ZinIPay (hosted)',
  icon: 'wallet',

  async configStatus() {
    const cfg = await readZinIPaySettings();
    if (!cfg.enabled) {
      return {
        configured: false,
        status: 'disabled',
        notes: ['Adapter is disabled in admin settings. Toggle Enable ZinIPay under /admin/payments.'],
      };
    }
    if (!cfg.apiKey) {
      return {
        configured: false,
        status: 'requires_credentials',
        notes: [
          'Missing API Key. Copy "zini-api-key" from dash.zinipay.com -> Brands -> Brand Key.',
          'Webhook hits will return 503 until the key is set.',
        ],
      };
    }
    return {
      configured: true,
      status: 'live',
      notes: [
        'Credentials present. Deposits via hosted page + webhook re-verify are live.',
        'No payout/disbursement endpoint exists on ZinIPay - withdrawals continue to use ChaopaoPay or manual.',
      ],
    };
  },

  async verifyWebhook(_headers, rawBody): Promise<ProviderEvent | null> {
    let payload: WebhookPayload;
    try {
      payload = JSON.parse(rawBody) as WebhookPayload;
    } catch {
      return null;
    }
    const invoiceId = typeof payload.invoice_id === 'string' ? payload.invoice_id.trim() : '';
    if (!invoiceId) return null;

    const cfg = await readZinIPaySettings();
    if (!cfg.enabled || !cfg.apiKey) return null;

    // No HMAC, so the only safe verification is to call the gateway
    // ourselves and trust THEIR answer.
    const verified = await zinipayVerify(invoiceId);
    if (!verified.ok) {
      return {
        providerTxId: invoiceId,
        amount: 0,
        currency: 'BDT',
        status: 'pending',
        reference: null,
        signatureValid: false,
        rawPayload: payload,
        meta: { zinipay: { verifyError: verified.error } },
      };
    }

    const status =
      verified.status === 'COMPLETED' ? 'success'
        : verified.status === 'FAILED' ? 'failed'
        : 'pending';

    return {
      providerTxId: verified.transactionId ?? verified.invoiceId,
      amount: verified.amount,
      currency: 'BDT',
      status,
      reference: verified.invoiceId,
      // We trust the verify response because we called the gateway
      // server-to-server using OUR api key - that is the closest thing
      // to a signature this provider supports.
      signatureValid: verified.status === 'COMPLETED',
      rawPayload: payload,
      meta: {
        zinipay: {
          invoiceId: verified.invoiceId,
          status: verified.status,
          paymentMethod: verified.paymentMethod,
          transactionId: verified.transactionId,
          customerName: verified.customerName,
          customerEmail: verified.customerEmail,
        },
      },
    };
  },
};

export const zinipaySettings: ProviderSettingsSchema = {
  fields: [
    { key: 'payment_zinipay_enabled', label: 'Enable ZinIPay', kind: 'toggle' },
    { key: 'payment_zinipay_base_url', label: 'Base URL', kind: 'text', hint: 'Defaults to https://api.zinipay.com. Override only if ZinIPay issued you a different host.' },
    { key: 'payment_zinipay_api_key', label: 'API Key (zini-api-key)', kind: 'secret', hint: 'From dash.zinipay.com -> Brands -> Brand Key.' },
    { key: 'payment_zinipay_create_path', label: 'Create payment path', kind: 'text', hint: 'Defaults to /v1/payment/create.' },
    { key: 'payment_zinipay_verify_path', label: 'Verify payment path', kind: 'text', hint: 'Defaults to /v1/payment/verify.' },
    { key: 'payment_zinipay_icon', label: 'Brand tile icon', kind: 'image', hint: 'Square PNG/JPG/WebP/SVG shown on the deposit tile grid.' },
  ],
};
