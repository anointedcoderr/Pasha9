// Built by Anointed Coder.
//
// Public probe used by the deposit page UI to decide whether to show
// the "Pay with bKash" / "Pay with Nagad" Quick Pay buttons. Returns
// the methods the operator has enabled and the min/max amounts. Does
// not expose the API key, secret key or merchant id.

export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { loadChaopaoPaySettings } from '@/lib/payments/chaopaopay-client';
import { jsonOk } from '@/lib/auth/errors';

export async function GET() {
  const cfg = await loadChaopaoPaySettings();
  const available = !!(cfg.enabled && cfg.merchantId && cfg.apiKey && cfg.secretKey);
  return jsonOk({
    available,
    methods: available ? ['bkash', 'nagad'] as const : ([] as const),
    // Display defaults. The gateway's actual per-method limits come
    // from ChaopaoPay support; until they confirm we use the
    // platform-wide deposit schema limits (100 min, 500,000 max).
    minAmount: 100,
    maxAmount: 500_000,
    currency: 'BDT',
  });
}
