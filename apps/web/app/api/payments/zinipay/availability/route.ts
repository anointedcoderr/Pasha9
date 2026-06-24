// Built by Anointed Coder.
//
// Public probe used by the deposit page to decide whether to show the
// ZinIPay quick-deposit tile. Returns whether the gateway is enabled and
// keyed, plus the operator-uploaded brand icon. Never exposes the API key.

export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { readZinIPaySettings } from '@/lib/payments/zinipay-client';
import { jsonOk } from '@/lib/auth/errors';

export async function GET() {
  const cfg = await readZinIPaySettings();
  const available = !!(cfg.enabled && cfg.apiKey);

  return jsonOk({
    available,
    // Display defaults; the platform-wide deposit schema limits apply.
    minAmount: 100,
    maxAmount: 500_000,
    currency: 'BDT',
    icon: cfg.brandIcon ?? null,
  });
}
