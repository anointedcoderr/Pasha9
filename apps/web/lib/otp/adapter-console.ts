// Built by Anointed Coder.
// Dev OTP adapter. Logs the code to the server console and surfaces it in the response
// so the QA team can complete verification without a live SMS provider.

import type { OtpProvider, OtpSendResult } from './provider';

export const consoleAdapter: OtpProvider = {
  name: 'console',
  isLive: false,
  async send(phone, code, purpose): Promise<OtpSendResult> {
    console.log(`[otp:dev] purpose=${purpose} phone=${phone} code=${code}`);
    return { ok: true, devCode: code, ref: `dev-${Date.now()}` };
  },
};
