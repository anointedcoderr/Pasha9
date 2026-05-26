// Built by Anointed Coder.
//
// SSLWireless SMS adapter (Bangladesh's most common transactional
// SMS gateway). Reads from SystemSetting:
//   sms_sslwireless_api_token      Bearer token from the SSLWireless dashboard
//   sms_sslwireless_sid            SMS Service Id (sender)
//   sms_sslwireless_endpoint       optional override (default = official URL)
//
// The HTTP shape follows the public SSLWireless v3 API. If their API
// changes, update this file in isolation - registry + service do not
// need to know.

import type { SmsAdapter, SmsSendResult } from './types';

const DEFAULT_ENDPOINT = 'https://smsplus.sslwireless.com/api/v3/send-sms';

export const sslwirelessAdapter: SmsAdapter = {
  key: 'sslwireless',
  label: 'SSLWireless (BD)',
  async configStatus(settings) {
    const token = settings.sms_sslwireless_api_token?.trim();
    const sid = settings.sms_sslwireless_sid?.trim();
    if (!token || !sid) return 'requires_credentials';
    return 'live';
  },
  async send({ phone, body, settings }): Promise<SmsSendResult> {
    const token = settings.sms_sslwireless_api_token?.trim();
    const sid = settings.sms_sslwireless_sid?.trim();
    if (!token || !sid) {
      return { ok: false, provider: 'sslwireless', errorCode: 'MISSING_CREDENTIALS', errorBody: 'sms_sslwireless_api_token + sms_sslwireless_sid required' };
    }
    const endpoint = settings.sms_sslwireless_endpoint?.trim() || DEFAULT_ENDPOINT;
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'authorization': `Bearer ${token}` },
        body: JSON.stringify({
          api_token: token,
          sid,
          msisdn: phone,
          sms: body,
          csms_id: `pasha9-${Date.now()}`,
        }),
        cache: 'no-store',
      });
      const text = await res.text();
      if (!res.ok) {
        return { ok: false, provider: 'sslwireless', errorCode: `HTTP_${res.status}`, errorBody: text.slice(0, 500) };
      }
      let parsedRef: string | undefined;
      try {
        const json = JSON.parse(text) as { reference_id?: string; status?: string };
        parsedRef = json.reference_id;
      } catch { /* ignore non-JSON */ }
      return { ok: true, provider: 'sslwireless', ref: parsedRef };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { ok: false, provider: 'sslwireless', errorCode: 'NETWORK_ERROR', errorBody: msg };
    }
  },
  describe() {
    return {
      key: 'sslwireless',
      label: 'SSLWireless (BD)',
      status: 'requires_credentials',
      settingKeys: ['sms_sslwireless_api_token', 'sms_sslwireless_sid', 'sms_sslwireless_endpoint'],
      description: 'Bangladesh transactional SMS via SSLWireless v3 API. Enter the Bearer token + Service ID (SID) from the SSLWireless dashboard. Optional endpoint override.',
    };
  },
};
