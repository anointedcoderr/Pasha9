// Built by Anointed Coder.
//
// M2I SMS service. One entry point: sendSms(opts). Looks up the
// current provider from SystemSetting.sms_provider, loads its
// per-provider settings, calls the adapter, then writes a
// NotificationLog row (success or failure) so the admin can audit
// every send from /admin/notifications.
//
// Never throws to the caller - deposit / withdrawal / OTP flows must
// never fail because an SMS provider is down. Returns the result so
// the caller can surface ok=false in the response if needed.

import type { Prisma } from '@prisma/client';
import { db } from '@/lib/db/client';
import { getSmsAdapter, SMS_PROVIDER_KEYS } from './registry';
import type { SmsSendResult } from './types';

const PROVIDER_SETTING_KEY = 'sms_provider';
// Every key any adapter might read. We fetch them all in one query.
const ALL_SETTING_KEYS = [
  PROVIDER_SETTING_KEY,
  'sms_sender_id',
  'sms_sslwireless_api_token',
  'sms_sslwireless_sid',
  'sms_sslwireless_endpoint',
  'sms_twilio_account_sid',
  'sms_twilio_auth_token',
  'sms_twilio_from',
  'sms_smsnetbd_api_key',
  'sms_smsnetbd_endpoint',
  'otp_expiry_minutes',
];

async function loadSettings(): Promise<Record<string, string>> {
  const rows = await db.systemSetting.findMany({
    where: { key: { in: ALL_SETTING_KEYS } },
    select: { key: true, value: true },
  });
  const map: Record<string, string> = {};
  for (const r of rows) map[r.key] = r.value ?? '';
  return map;
}

export interface SendSmsOpts {
  phone: string;
  body: string;
  template?: string;
  userId?: string | null;
  triggerKey?: string | null;
  meta?: Prisma.JsonObject | null;
}

export async function sendSms(opts: SendSmsOpts): Promise<SmsSendResult> {
  const phone = opts.phone.trim();
  if (!phone) {
    return { ok: false, provider: 'manual', errorCode: 'EMPTY_PHONE' };
  }

  let settings: Record<string, string>;
  try {
    settings = await loadSettings();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[sms] settings load failed', err);
    return { ok: false, provider: 'manual', errorCode: 'SETTINGS_FAILED', errorBody: msg };
  }

  const providerKey = settings[PROVIDER_SETTING_KEY] || 'manual';
  const adapter = getSmsAdapter(providerKey);

  let result: SmsSendResult;
  try {
    result = await adapter.send({ phone, body: opts.body, settings });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[sms] adapter threw unexpectedly', err);
    result = { ok: false, provider: adapter.key, errorCode: 'ADAPTER_THREW', errorBody: msg.slice(0, 500) };
  }

  // Audit log. Never block the response on a logger failure.
  try {
    await db.notificationLog.create({
      data: {
        channel: 'sms',
        provider: adapter.key,
        recipient: phone,
        template: opts.template ?? null,
        body: opts.body,
        userId: opts.userId ?? null,
        triggerKey: opts.triggerKey ?? null,
        ok: result.ok,
        ref: result.ref ?? null,
        errorCode: result.errorCode ?? null,
        errorBody: result.errorBody ?? null,
        meta: (opts.meta ?? null) as Prisma.InputJsonValue,
      },
    });
  } catch (err) {
    console.error('[sms] NotificationLog write failed', err);
  }

  console.info('[sms]', adapter.key, result.ok ? 'ok' : `fail:${result.errorCode ?? '?'}`, { template: opts.template, phone: phone.slice(0, 4) + '***', ref: result.ref });
  return result;
}

// Convenience wrapper used by /api/auth/otp/request to keep the
// existing call shape clean.
export async function sendOtpSms(phone: string, code: string, purpose: string): Promise<SmsSendResult> {
  return sendSms({
    phone,
    body: `Your Pasha 9 verification code is ${code}. It expires in 5 minutes. Do not share with anyone.`,
    template: `otp_${purpose}`,
    triggerKey: `otp:${phone}:${purpose}`,
  });
}

export function listProviderKeys(): readonly string[] {
  return SMS_PROVIDER_KEYS;
}
