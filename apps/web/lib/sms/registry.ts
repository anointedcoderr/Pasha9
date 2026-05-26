// Built by Anointed Coder.

import type { SmsAdapter, SmsProviderKey } from './types';
import { manualAdapter } from './manual';
import { testAdapter } from './test';
import { sslwirelessAdapter } from './sslwireless';
import { twilioAdapter } from './twilio';

const REGISTRY: Record<SmsProviderKey, SmsAdapter> = {
  manual: manualAdapter,
  test: testAdapter,
  sslwireless: sslwirelessAdapter,
  twilio: twilioAdapter,
};

export const SMS_PROVIDER_KEYS: SmsProviderKey[] = ['manual', 'test', 'sslwireless', 'twilio'];

export function getSmsAdapter(key: string | null | undefined): SmsAdapter {
  if (key && (SMS_PROVIDER_KEYS as string[]).includes(key)) {
    return REGISTRY[key as SmsProviderKey];
  }
  return manualAdapter;
}

export function listSmsAdapters(): SmsAdapter[] {
  return SMS_PROVIDER_KEYS.map((k) => REGISTRY[k]);
}
