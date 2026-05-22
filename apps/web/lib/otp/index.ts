// Built by Anointed Coder.
// OTP factory. Resolves the right adapter for the current environment.
//
// In development we use the console adapter so QA can see the code in the server log.
// In production we use the no-op adapter (returning a clear "not configured" error)
// until a real SMS provider is configured via the admin SMS settings page.

import { consoleAdapter } from './adapter-console';
import { noopAdapter } from './adapter-noop';
import type { OtpProvider } from './provider';

export function getOtpProvider(): OtpProvider {
  const choice = (process.env.PASHA9_OTP_PROVIDER ?? '').toLowerCase();
  if (choice === 'console') return consoleAdapter;
  if (choice === 'noop' || choice === 'none' || choice === '') {
    return process.env.NODE_ENV === 'production' ? noopAdapter : consoleAdapter;
  }
  // Real adapters (sslwireless, twilio, etc.) plug in here in M2 when credentials land.
  return noopAdapter;
}

export type { OtpProvider } from './provider';
