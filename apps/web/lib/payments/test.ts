// Built by Anointed Coder.
//
// Test adapter. Reads a shared secret from SystemSetting
// payment_test_secret and treats requests carrying that secret in the
// X-Pasha-Test-Secret header as signature-valid. Useful for end-to-end
// testing the webhook -> reconciliation -> auto-approve plumbing
// without a real gateway, AND for QA against an operator-provided
// staging URL.
//
// Disabled by default. The admin must enter a non-empty secret in
// /admin/payments before the adapter accepts webhooks.

import { db } from '@/lib/db/client';
import type { ProviderAdapter, ProviderSettingsSchema, ProviderEvent } from './types';

async function readSecret(): Promise<string | null> {
  const row = await db.systemSetting.findUnique({ where: { key: 'payment_test_secret' } });
  const v = row?.value?.trim();
  return v || null;
}

export const testAdapter: ProviderAdapter = {
  key: 'test',
  label: 'Test gateway (development + staging)',
  icon: 'flask-conical',
  async configStatus() {
    const secret = await readSecret();
    if (!secret) {
      return {
        configured: false,
        status: 'disabled',
        notes: ['Set a shared secret to enable. Useful for testing the webhook pipeline end to end.'],
      };
    }
    return {
      configured: true,
      status: 'live',
      notes: ['Active. Requests with X-Pasha-Test-Secret matching the saved value are accepted as signed.'],
    };
  },
  async verifyWebhook(headers, rawBody) {
    const expected = await readSecret();
    if (!expected) return null;
    const provided = headers.get('x-pasha-test-secret') ?? '';
    if (provided !== expected) return null;
    let body: Record<string, unknown> = {};
    try {
      body = JSON.parse(rawBody);
    } catch {
      return null;
    }
    const providerTxId = String(body.providerTxId ?? body.txId ?? '');
    const amount = Number(body.amount ?? 0);
    if (!providerTxId || !Number.isFinite(amount) || amount <= 0) return null;
    const event: ProviderEvent = {
      providerTxId,
      amount,
      currency: String(body.currency ?? 'BDT'),
      status: (body.status as ProviderEvent['status']) ?? 'success',
      reference: typeof body.reference === 'string' ? body.reference : null,
      signatureValid: true,
      rawPayload: body,
      meta: typeof body.meta === 'object' && body.meta !== null ? (body.meta as Record<string, unknown>) : undefined,
    };
    return event;
  },
};

export const testSettings: ProviderSettingsSchema = {
  fields: [
    { key: 'payment_test_secret', label: 'Shared secret', kind: 'secret', hint: 'Header X-Pasha-Test-Secret must match exactly.' },
  ],
};
