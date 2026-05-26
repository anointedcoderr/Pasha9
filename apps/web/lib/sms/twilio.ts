// Built by Anointed Coder.
//
// Twilio SMS adapter (international fallback). Reads from
// SystemSetting:
//   sms_twilio_account_sid
//   sms_twilio_auth_token
//   sms_twilio_from        E.164 sender, e.g. +14155552671
//
// Uses Twilio's REST v2010 endpoint with Basic auth, no SDK
// dependency.

import type { SmsAdapter, SmsSendResult } from './types';

export const twilioAdapter: SmsAdapter = {
  key: 'twilio',
  label: 'Twilio',
  async configStatus(settings) {
    const sid = settings.sms_twilio_account_sid?.trim();
    const token = settings.sms_twilio_auth_token?.trim();
    const from = settings.sms_twilio_from?.trim();
    if (!sid || !token || !from) return 'requires_credentials';
    return 'live';
  },
  async send({ phone, body, settings }): Promise<SmsSendResult> {
    const sid = settings.sms_twilio_account_sid?.trim();
    const token = settings.sms_twilio_auth_token?.trim();
    const from = settings.sms_twilio_from?.trim();
    if (!sid || !token || !from) {
      return { ok: false, provider: 'twilio', errorCode: 'MISSING_CREDENTIALS' };
    }
    try {
      const auth = Buffer.from(`${sid}:${token}`).toString('base64');
      const params = new URLSearchParams();
      params.set('To', phone);
      params.set('From', from);
      params.set('Body', body);
      const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sid)}/Messages.json`, {
        method: 'POST',
        headers: {
          'authorization': `Basic ${auth}`,
          'content-type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
        cache: 'no-store',
      });
      const text = await res.text();
      if (!res.ok) {
        return { ok: false, provider: 'twilio', errorCode: `HTTP_${res.status}`, errorBody: text.slice(0, 500) };
      }
      let parsedRef: string | undefined;
      try {
        const json = JSON.parse(text) as { sid?: string };
        parsedRef = json.sid;
      } catch { /* ignore */ }
      return { ok: true, provider: 'twilio', ref: parsedRef };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { ok: false, provider: 'twilio', errorCode: 'NETWORK_ERROR', errorBody: msg };
    }
  },
  describe() {
    return {
      key: 'twilio',
      label: 'Twilio',
      status: 'requires_credentials',
      settingKeys: ['sms_twilio_account_sid', 'sms_twilio_auth_token', 'sms_twilio_from'],
      description: 'International SMS via Twilio REST. Set Account SID + Auth Token + From number (E.164).',
    };
  },
};
