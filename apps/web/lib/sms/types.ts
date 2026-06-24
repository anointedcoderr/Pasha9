// Built by Anointed Coder.
//
// M2I SMS adapter interface. Mirrors the M2B/M2C payment + payout
// adapter pattern so a new provider can be added by writing one file
// and adding it to the registry.

export type SmsProviderKey = 'manual' | 'test' | 'sslwireless' | 'twilio' | 'smsnetbd';

export interface SmsSendResult {
  ok: boolean;
  provider: SmsProviderKey;
  ref?: string;            // provider message id
  errorCode?: string;
  errorBody?: string;
  // Adapters that intentionally do not send (manual, test) can
  // return the body here so the admin can copy/paste the OTP from
  // /admin/notifications history.
  devBody?: string;
}

export interface SmsProviderStatus {
  key: SmsProviderKey;
  label: string;
  status: 'live' | 'requires_credentials' | 'manual';
  // Settings keys this adapter reads from SystemSetting.
  settingKeys: string[];
  // Short description shown on the admin page.
  description: string;
}

export interface SmsAdapter {
  readonly key: SmsProviderKey;
  readonly label: string;
  /** Returns the live status given the current SystemSetting values. */
  configStatus(settings: Record<string, string>): Promise<'live' | 'requires_credentials' | 'manual'>;
  /** Actually send (or log) the SMS. Must never throw - return ok:false instead. */
  send(opts: { phone: string; body: string; settings: Record<string, string> }): Promise<SmsSendResult>;
  describe(): SmsProviderStatus;
}
