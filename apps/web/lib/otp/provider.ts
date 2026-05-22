// Built by Anointed Coder.
// OTP provider interface. The platform is provider-ready: pick an adapter at runtime
// via PASHA9_OTP_PROVIDER. See ./index.ts for the factory.

export interface OtpSendResult {
  ok: boolean;
  /** present in dev console adapter so the QA team can read the code from the panel */
  devCode?: string;
  /** Provider-specific reference id for support follow-up */
  ref?: string;
}

export interface OtpProvider {
  readonly name: string;
  readonly isLive: boolean;
  send(phone: string, code: string, purpose: 'signup' | 'login' | 'reset' | 'verify_phone'): Promise<OtpSendResult>;
}
