// Built by Anointed Coder.
//
// One-shot CLI that materialises a BonusRule for every active
// DepositBonusTier row, prunes orphaned deposit_tier_* BonusRule rows
// whose tier no longer exists, and prints the result. Use this when
// the wide tier list shows tiers without an active backing rule
// (the symptom: screen promises a bonus, approval does not credit it).
//
// Invoke from the repo root:
//
//   cd /var/www/pasha9/app
//   set -a; source .env; set +a
//   pnpm --filter @pasha9/web exec tsx scripts/resync-deposit-tiers.ts
//
// The script exits non-zero on failure so it can be safely chained
// after a deploy step.

import { resyncAllTiers } from '../lib/bonuses/deposit-tiers';

async function main(): Promise<void> {
  const out = await resyncAllTiers();
  console.log(`[resync-deposit-tiers] synced=${out.synced} removed=${out.removed}`);
}

main()
  .then(() => process.exit(0))
  .catch((err: unknown) => {
    console.error('[resync-deposit-tiers] failed', err);
    process.exit(1);
  });
