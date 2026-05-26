// Built by Anointed Coder.
//
// Manual SMS adapter. Never hits a provider; logs the message body so
// the admin can read it from /admin/notifications history and pass
// the code on by hand. Default for fresh deploys until real
// credentials are entered.

import type { SmsAdapter, SmsSendResult } from './types';

export const manualAdapter: SmsAdapter = {
  key: 'manual',
  label: 'Manual (no provider configured)',
  async configStatus() {
    return 'manual';
  },
  async send({ body }): Promise<SmsSendResult> {
    return {
      ok: true,
      provider: 'manual',
      devBody: body,
    };
  },
  describe() {
    return {
      key: 'manual',
      label: 'Manual (no provider)',
      status: 'manual',
      settingKeys: [],
      description: 'Default. SMS body is captured in NotificationLog so admin can read the OTP from /admin/notifications and pass it on by phone.',
    };
  },
};
