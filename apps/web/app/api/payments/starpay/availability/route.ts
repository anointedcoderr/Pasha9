// Built by Anointed Coder.
//
// Public probe used by the deposit page to decide which StarPay-backed
// deposit tiles to show. StarPay itself is never player-facing - the
// player sees bKash / Nagad / Rocket as separate tiles, each independently
// enabled, labeled, iconed and ordered by the operator. Returns only the
// tiles that are actually usable right now (gateway configured AND that
// tile enabled). Never exposes the secret.

export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { readStarPaySettings, starpayDepositTiles } from '@/lib/payments/starpay-client';
import { jsonOk } from '@/lib/auth/errors';

export async function GET() {
  const cfg = await readStarPaySettings();
  const gatewayReady = !!(cfg.enabled && cfg.mchId && cfg.secret);

  const methods = gatewayReady
    ? starpayDepositTiles(cfg)
        .filter((t) => t.enabled)
        .map((t) => ({ key: t.key, label: t.label, icon: t.icon }))
    : [];

  return jsonOk({
    methods,
    // Display defaults; the platform-wide deposit schema limits apply.
    minAmount: 100,
    maxAmount: 500_000,
    currency: 'BDT',
  });
}
