// Built by Anointed Coder.
//
// One-time UI rename for the iGamingAPIs aggregator provider row.
//
// Why: the original GameProvider row was named "iGamingAPIs JILI" back
// when JILI was the only brand on the account. After the multi-brand
// import landed (PGSoft, JDB, Habanero, Spribe, Evolution Live, etc.)
// that label reads as if only JILI is wired up. Operators have asked
// for a clearer label that reflects the aggregator-with-brands shape.
//
// What this changes: GameProvider.name only. providerKey, adapterKey,
// API token, API secret, callback secret, callback path, public base
// URL, launch logic and callback logic are NOT touched.
//
// Run:
//   pnpm --filter @pasha9/database tsx scripts/rename-igamingapis-provider.ts
//
// Flags:
//   --dry-run        Print what would change without writing.
//   --label=...      Override the new display name (default
//                    "iGamingAPIs Aggregator").
//
// Idempotent: re-running prints "already renamed" and exits 0.

import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

function arg(name: string, fallback: string): string {
  const hit = process.argv.find((a) => a.startsWith(`${name}=`));
  return hit ? hit.slice(name.length + 1) : fallback;
}
function flag(name: string): boolean {
  return process.argv.includes(name);
}

async function main(): Promise<void> {
  const dryRun = flag('--dry-run');
  const newName = arg('--label', 'iGamingAPIs Aggregator').trim();
  if (!newName) {
    console.error('[rename-igamingapis] --label must not be empty.');
    process.exit(1);
  }

  const row = await db.gameProvider.findFirst({
    where: { providerKey: 'igamingapis' },
    select: { id: true, name: true, providerKey: true },
  });
  if (!row) {
    console.error('[rename-igamingapis] No GameProvider row with providerKey="igamingapis" found. Nothing to do.');
    return;
  }
  if (row.name === newName) {
    console.log(`[rename-igamingapis] Already named "${newName}" (id=${row.id}). No change.`);
    return;
  }

  console.log(`[rename-igamingapis] ${row.id}: "${row.name}" -> "${newName}"${dryRun ? ' (dry-run)' : ''}`);
  if (dryRun) return;

  await db.gameProvider.update({
    where: { id: row.id },
    data: { name: newName },
  });
  console.log('[rename-igamingapis] Done.');
}

main()
  .catch((err) => {
    console.error('[rename-igamingapis] Failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
