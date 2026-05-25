// Built by Anointed Coder.
//
// Manual adapter. The original M1 deposit flow where the user posts
// transaction-id + screenshot and an admin approves in
// /admin/deposits. Always "live", never receives a webhook. Listed
// here so /admin/payments can render it as the system's authoritative
// fallback alongside the automated providers.

import type { ProviderAdapter, ProviderSettingsSchema } from './types';

export const manualAdapter: ProviderAdapter = {
  key: 'manual',
  label: 'Manual deposit (admin approval)',
  icon: 'wallet',
  async configStatus() {
    return { configured: true, status: 'manual', notes: ['Always available. Admin approves deposits at /admin/deposits.'] };
  },
  async verifyWebhook() {
    // Manual flow has no webhook. Hits to /api/payments/webhook/manual
    // are rejected.
    return null;
  },
};

export const manualSettings: ProviderSettingsSchema = { fields: [] };
