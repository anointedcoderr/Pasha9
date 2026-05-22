// Built by Anointed Coder.
// Production fallback adapter. Returns a clear failure so the admin and the user know
// the SMS provider has not been configured yet.

import type { OtpProvider, OtpSendResult } from './provider';

export const noopAdapter: OtpProvider = {
  name: 'noop',
  isLive: false,
  async send(): Promise<OtpSendResult> {
    return { ok: false };
  },
};
