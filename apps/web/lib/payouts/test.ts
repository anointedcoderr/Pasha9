// Built by Anointed Coder.
//
// Test payout adapter. Lets QA exercise the payout webhook ->
// reconciliation -> mark-paid pipeline without a real gateway.
// Reads the shared secret from SystemSetting payout_test_secret.

import { db } from '@/lib/db/client';
import type { PayoutAdapter, PayoutEvent, PayoutSettingsSchema } from './types';

async function readSecret(): Promise<string | null> {
  const row = await db.systemSetting.findUnique({ where: { key: 'payout_test_secret' } });
  const v = row?.value?.trim();
  return v || null;
}

export const testPayout: PayoutAdapter = {
  key: 'test',
  label: 'Test payout (development + staging)',
  icon: 'flask-conical',
  async configStatus() {
    const secret = await readSecret();
    if (!secret) {
      return {
        configured: false,
        status: 'disabled',
        notes: ['Set a shared secret to enable. Requests with X-Pasha-Test-Secret matching the saved value are accepted as signed.'],
      };
    }
    return {
      configured: true,
      status: 'live',
      notes: ['Active. Accepts JSON { providerTxId, reference, amount, status }.'],
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
    const event: PayoutEvent = {
      providerTxId,
      reference: typeof body.reference === 'string' ? body.reference : null,
      amount,
      currency: String(body.currency ?? 'BDT'),
      status: (body.status as PayoutEvent['status']) ?? 'paid',
      signatureValid: true,
      rawPayload: body,
      meta: typeof body.meta === 'object' && body.meta !== null ? (body.meta as Record<string, unknown>) : undefined,
    };
    return event;
  },
};

export const testPayoutSettings: PayoutSettingsSchema = {
  fields: [
    { key: 'payout_test_secret', label: 'Shared secret', kind: 'secret', hint: 'Header X-Pasha-Test-Secret must match exactly.' },
  ],
};
