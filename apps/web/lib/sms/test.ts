// Built by Anointed Coder.
//
// Test SMS adapter. Behaves like manual but flagged as 'live' so the
// admin UI does not warn the operator. Use during QA when you want
// to drive the OTP / notification flow end-to-end without paying for
// a real SMS.

import type { SmsAdapter, SmsSendResult } from './types';

export const testAdapter: SmsAdapter = {
  key: 'test',
  label: 'Test (no real send)',
  async configStatus() {
    return 'live';
  },
  async send({ body }): Promise<SmsSendResult> {
    return {
      ok: true,
      provider: 'test',
      ref: `test-${Date.now()}`,
      devBody: body,
    };
  },
  describe() {
    return {
      key: 'test',
      label: 'Test (echo only)',
      status: 'live',
      settingKeys: [],
      description: 'Pretends to send. Useful for QA. SMS body visible in NotificationLog history. Switch to a real adapter before going live.',
    };
  },
};
