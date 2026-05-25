// Built by Anointed Coder.

import type { PayoutAdapter, PayoutSettingsSchema } from './types';

export const manualPayout: PayoutAdapter = {
  key: 'manual',
  label: 'Manual payout (admin-driven)',
  icon: 'wallet',
  async configStatus() {
    return {
      configured: true,
      status: 'manual',
      notes: [
        'Always available. After approving a withdrawal at /admin/withdrawals the admin pays the user out of band and clicks Mark Paid to close the loop.',
      ],
    };
  },
  async verifyWebhook() {
    return null;
  },
};

export const manualPayoutSettings: PayoutSettingsSchema = { fields: [] };
