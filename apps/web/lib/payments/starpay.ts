// Built by Anointed Coder.
//
// StarPay adapter for the payment provider registry. StarPay signs both
// directions with MD5 (see starpay-client.ts starpaySign), so unlike
// ZinIPay we verify the callback signature locally rather than re-calling
// the gateway. A callback is credited only when its `sign` recomputes to
// the value we hold AND its status maps to success.
//
// Owns: configStatus for /admin/payments, and verifyWebhook.
// starpay-client.ts owns the outbound calls (create order, query order).
//
// Disabled by default (payment_starpay_enabled must be set to 1 in
// admin). Do NOT enable in production until: (1) the merchant secret is
// set via admin, and (2) a sandbox / low-value live order has confirmed
// the signature (including the uppercase-secret toggle), the channel
// ids, and the callback field shape. Withdrawals/payouts are not built
// yet - the provider has not supplied the payout create-order spec.

import type { ProviderAdapter, ProviderEvent, ProviderSettingsSchema } from './types';
import { readStarPaySettings, starpaySign, starpaySignMatches, starpayMapStatus } from './starpay-client';

export const starpayAdapter: ProviderAdapter = {
  // key is treated as an opaque string by the registry; 'starpay' is
  // added to the ProviderKey union in types.ts.
  key: 'starpay' as ProviderAdapter['key'],
  label: 'StarPay (hosted)',
  icon: 'wallet',

  async configStatus() {
    const cfg = await readStarPaySettings();
    if (!cfg.enabled) {
      return {
        configured: false,
        status: 'disabled',
        notes: ['Disabled in admin. Enable StarPay under /admin/payments once the secret is set and a sandbox order is confirmed.'],
      };
    }
    if (!cfg.mchId || !cfg.secret) {
      return {
        configured: false,
        status: 'requires_credentials',
        notes: [
          'Missing merchant ID or secret. Set them under /admin/payments (the secret is stored server-side and never sent to the browser).',
          'Callbacks will be logged as signature_invalid until the secret is set.',
        ],
      };
    }
    return {
      configured: true,
      status: 'live',
      notes: [
        'Credentials present. Deposits via hosted page + signed callback are live.',
        'Confirm the uppercase-secret toggle and channel ids with a low-value order before real traffic.',
        'Payouts (withdrawals) are not implemented - the provider has not supplied the payout create-order spec.',
      ],
    };
  },

  async verifyWebhook(_headers, rawBody): Promise<ProviderEvent | null> {
    let payload: Record<string, unknown>;
    try {
      const parsed = JSON.parse(rawBody);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
      payload = parsed as Record<string, unknown>;
    } catch {
      return null;
    }

    const cfg = await readStarPaySettings();
    if (!cfg.enabled || !cfg.mchId || !cfg.secret) return null;

    // The callback must be for our merchant account.
    if (String(payload.mchId ?? '') !== cfg.mchId) return null;

    const mchOrderNo = typeof payload.mchOrderNo === 'string' ? payload.mchOrderNo : null;
    const payOrderId = typeof payload.payOrderId === 'string' ? payload.payOrderId : null;
    const providerTxId = payOrderId ?? mchOrderNo ?? '';
    if (!providerTxId) return null;

    // Recompute the signature over the received params (minus `sign`) and
    // compare. signatureValid gates crediting downstream, so this must be
    // the ONLY thing that flips it true.
    const expected = starpaySign(payload, cfg.secret, cfg.uppercaseSecret);
    const signatureValid = starpaySignMatches(payload.sign, expected);

    const amountMinor = Number(payload.amount ?? payload.realAmount ?? 0) || 0;
    const rawStatus = payload.status == null ? null : Number(payload.status);

    return {
      providerTxId,
      amount: amountMinor / 100,
      currency: 'BDT',
      status: starpayMapStatus(rawStatus),
      reference: mchOrderNo,
      signatureValid,
      rawPayload: payload,
      meta: {
        starpay: {
          mchOrderNo,
          payOrderId,
          rawStatus,
          productId: typeof payload.productId === 'string' ? payload.productId : null,
          utr: typeof payload.utr === 'string' ? payload.utr : null,
          rejectReason: typeof payload.rejectReason === 'string' ? payload.rejectReason : null,
          param1: typeof payload.param1 === 'string' ? payload.param1 : null,
          param2: typeof payload.param2 === 'string' ? payload.param2 : null,
        },
      },
    };
  },
};

export const starpaySettings: ProviderSettingsSchema = {
  fields: [
    { key: 'payment_starpay_enabled', label: 'Enable StarPay', kind: 'toggle', hint: 'Leave OFF until the secret is set and a sandbox order confirms signing + channels.' },
    { key: 'payment_starpay_base_url', label: 'API base URL', kind: 'text', hint: 'Defaults to https://stp1api.starpay1.com.' },
    { key: 'payment_starpay_mch_id', label: 'Merchant ID', kind: 'text', hint: 'From StarPay (e.g. 25).' },
    { key: 'payment_starpay_secret', label: 'Merchant secret', kind: 'secret', hint: 'Stored server-side and never shown in the browser. Get it from StarPay through a secure channel; never paste it in chat.' },
    { key: 'payment_starpay_uppercase_secret', label: 'Uppercase secret before hashing', kind: 'toggle', hint: 'Provider samples disagree. Leave OFF first; if the signature is rejected in the sandbox, turn ON.' },
    { key: 'payment_starpay_create_path', label: 'Create order path', kind: 'text', hint: 'Defaults to /v1.0/api/order/create.' },
    { key: 'payment_starpay_query_path', label: 'Query order path', kind: 'text', hint: 'Defaults to /v1.0/api/order/query.' },
    { key: 'payment_starpay_channel_combined', label: 'Channel: combined deposit', kind: 'text', hint: 'productId for Bangladesh combined collection (default 5307).' },
    { key: 'payment_starpay_channel_bkash', label: 'Channel: bKash deposit', kind: 'text', hint: 'productId for bKash QR (default 5301).' },
    { key: 'payment_starpay_channel_nagad', label: 'Channel: Nagad deposit', kind: 'text', hint: 'productId for Nagad QR (default 5302).' },
    { key: 'payment_starpay_channel_rocket', label: 'Channel: Rocket deposit', kind: 'text', hint: 'productId for Rocket QR (default 5303).' },
    { key: 'payment_starpay_icon', label: 'Brand tile icon', kind: 'image', hint: 'Square PNG/JPG/WebP/SVG shown on the deposit tile grid.' },
  ],
};
