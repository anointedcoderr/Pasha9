// Built by Anointed Coder.
//
// SMS.net.bd (Alpha SMS) adapter. Bangladesh transactional + bulk SMS
// gateway. Reads from SystemSetting:
//   sms_smsnetbd_api_key    API key from the sms.net.bd panel (API page)
//   sms_smsnetbd_endpoint   optional override (default = official URL)
//   sms_sender_id           optional approved sender id / mask (shared key)
//
// API: POST https://api.sms.net.bd/sendsms with form fields api_key, msg,
// to (and optional sender_id). Unicode / Bengali is supported. A success
// reply is JSON { error: 0, msg: 'Success', data: { request_id, ... } };
// any non-zero `error` is a failure.

import type { SmsAdapter, SmsSendResult } from './types';

const DEFAULT_ENDPOINT = 'https://api.sms.net.bd/sendsms';

// sms.net.bd expects the number as 8801XXXXXXXXX (country code, no plus).
// Players are stored as 01XXXXXXXXX or +8801... depending on the flow, so
// normalise to the gateway's expected shape.
function normalizeBd(phone: string): string {
  let p = phone.replace(/[^\d+]/g, '');
  if (p.startsWith('+')) p = p.slice(1);
  if (p.startsWith('00')) p = p.slice(2);
  if (p.startsWith('880')) return p;
  if (p.startsWith('0')) return `88${p}`;
  if (p.startsWith('1') && p.length === 10) return `880${p}`;
  return p;
}

export const smsnetbdAdapter: SmsAdapter = {
  key: 'smsnetbd',
  label: 'SMS.net.bd (Alpha SMS, BD)',
  async configStatus(settings) {
    const key = settings.sms_smsnetbd_api_key?.trim();
    return key ? 'live' : 'requires_credentials';
  },
  async send({ phone, body, settings }): Promise<SmsSendResult> {
    const apiKey = settings.sms_smsnetbd_api_key?.trim();
    if (!apiKey) {
      return { ok: false, provider: 'smsnetbd', errorCode: 'MISSING_CREDENTIALS', errorBody: 'sms_smsnetbd_api_key required' };
    }
    const endpoint = settings.sms_smsnetbd_endpoint?.trim() || DEFAULT_ENDPOINT;
    const senderId = settings.sms_sender_id?.trim();
    const form = new URLSearchParams();
    form.set('api_key', apiKey);
    form.set('msg', body);
    form.set('to', normalizeBd(phone));
    if (senderId) form.set('sender_id', senderId);
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: form.toString(),
        cache: 'no-store',
      });
      const text = await res.text();
      if (!res.ok) {
        return { ok: false, provider: 'smsnetbd', errorCode: `HTTP_${res.status}`, errorBody: text.slice(0, 500) };
      }
      type SmsNetResp = { error?: number; msg?: string; data?: { request_id?: number | string } };
      let json: SmsNetResp | null = null;
      try { json = JSON.parse(text) as SmsNetResp; } catch { /* non-JSON body */ }
      if (!json || Number(json.error) !== 0) {
        return { ok: false, provider: 'smsnetbd', errorCode: `API_${json?.error ?? 'PARSE'}`, errorBody: (json?.msg ?? text).slice(0, 500) };
      }
      const ref = json.data?.request_id != null ? String(json.data.request_id) : undefined;
      return { ok: true, provider: 'smsnetbd', ref };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { ok: false, provider: 'smsnetbd', errorCode: 'NETWORK_ERROR', errorBody: msg };
    }
  },
  describe() {
    return {
      key: 'smsnetbd',
      label: 'SMS.net.bd (Alpha SMS, BD)',
      status: 'requires_credentials',
      settingKeys: ['sms_smsnetbd_api_key', 'sms_smsnetbd_endpoint'],
      description: 'Bangladesh SMS via sms.net.bd (Alpha SMS). Paste the API key from the sms.net.bd panel API page. Supports Bengali text. Sender ID is optional (set sms_sender_id only if you have an approved mask).',
    };
  },
};
