// Built by Anointed Coder.
//
// Public probe used by the deposit page to decide whether to show the
// StarPay quick-deposit tile. Returns whether the gateway is enabled and
// keyed, plus the operator-uploaded brand icon. Never exposes the secret.

export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { readStarPaySettings } from '@/lib/payments/starpay-client';
import { jsonOk } from '@/lib/auth/errors';

export async function GET() {
  const cfg = await readStarPaySettings();
  const available = !!(cfg.enabled && cfg.mchId && cfg.secret);

  return jsonOk({
    available,
    // Display defaults; the platform-wide deposit schema limits apply.
    minAmount: 100,
    maxAmount: 500_000,
    currency: 'BDT',
    icon: cfg.brandIcon ?? null,
  });
}
