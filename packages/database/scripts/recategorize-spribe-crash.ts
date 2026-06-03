// Built by Anointed Coder.
//
// One-time fix for Spribe ExternalGame rows that came in tagged
// `flash` because that is what the CSV said. After this script,
// Aviator / Jet X / Crash / Rocket / Spaceman / Cash Show titles
// are moved to category=crash so the public crash strip and
// /games/provider?category=crash actually contain them.
//
// Run:
//   pnpm --filter @pasha9/database recategorize:spribe-crash
// Flags:
//   --dry-run       Report what would change without writing.
//   --provider-key= Override iGamingAPIs providerKey (default igamingapis).
//   --brand-key=    Override Spribe brand key (default SPRIBE).
//
// Idempotent. Re-running prints "moved 0".

import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

const PATTERNS: Array<RegExp> = [
  /\baviator\b/i,
  /\bjet[\s-]?x\b/i,
  /\bcrash(?!ing)\b/i,
  /\brocket\b/i,
  /\bspaceman\b/i,
  /\bcash\s?show\b/i,
];

function arg(name: string, fallback: string): string {
  const hit = process.argv.find((a) => a.startsWith(`${name}=`));
  return hit ? hit.slice(name.length + 1) : fallback;
}

async function main(): Promise<void> {
  const dryRun = process.argv.includes('--dry-run');
  const providerKey = arg('--provider-key', 'igamingapis');
  const brandKey = arg('--brand-key', 'SPRIBE');

  const provider = await db.gameProvider.findUnique({ where: { providerKey }, select: { id: true, name: true } });
  if (!provider) { console.error(`[recategorize] provider ${providerKey} not found`); process.exit(1); }

  const brand = await db.providerBrand.findUnique({
    where: { providerId_brandKey: { providerId: provider.id, brandKey } },
    select: { id: true, displayName: true },
  });
  if (!brand) { console.error(`[recategorize] brand ${brandKey} not found under provider ${providerKey}`); process.exit(1); }

  const games = await db.externalGame.findMany({
    where: { providerId: provider.id, brandId: brand.id },
    select: { id: true, displayName: true, category: true },
  });
  console.log(`[recategorize] ${brand.displayName}: scanning ${games.length} rows`);

  let moved = 0;
  for (const g of games) {
    if (g.category === 'crash') continue;
    const hit = PATTERNS.some((p) => p.test(g.displayName));
    if (!hit) continue;
    console.log(`  ${dryRun ? '[dry] ' : ''}"${g.displayName}" ${g.category ?? 'null'} -> crash`);
    moved++;
    if (!dryRun) {
      await db.externalGame.update({ where: { id: g.id }, data: { category: 'crash' } });
    }
  }

  console.log(`[recategorize] moved ${moved}`);
}

main()
  .catch((err) => { console.error('[recategorize] failed', err); process.exit(1); })
  .finally(async () => { await db.$disconnect(); });
