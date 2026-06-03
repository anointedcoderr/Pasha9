// Built by Anointed Coder.
//
// Auto-tag ExternalGame.isJackpot for titles that contain obvious
// jackpot/mega/grand/treasure/fortune/crown wording. The admin can
// override per row from /admin/providers/[id] Games tab.
//
// Run:
//   pnpm --filter @pasha9/database autotag:jackpot
// Flags:
//   --dry-run    Report what would change without writing.
//   --reset      Clear isJackpot back to false on rows the auto-tag
//                misses (rare; useful when titles get renamed
//                upstream).
//
// Idempotent. Re-running prints "marked 0" once the set is stable.

import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

const PATTERNS: Array<RegExp> = [
  /\bjackpot\b/i,
  /\bmega\b/i,
  /\bgrand\b/i,
  /\btreasure\b/i,
  /\bfortune\b/i,
  /\bcrown\b/i,
  /\bjewel\b/i,
];

function matches(name: string): boolean {
  return PATTERNS.some((p) => p.test(name));
}

async function main(): Promise<void> {
  const dryRun = process.argv.includes('--dry-run');
  const reset = process.argv.includes('--reset');

  const games = await db.externalGame.findMany({
    select: { id: true, displayName: true, isJackpot: true },
  });
  console.log(`[autotag-jackpot] scanning ${games.length} rows`);

  let marked = 0;
  let unmarked = 0;
  for (const g of games) {
    const shouldBe = matches(g.displayName);
    if (shouldBe && !g.isJackpot) {
      marked++;
      console.log(`  ${dryRun ? '[dry] ' : ''}+jackpot "${g.displayName}"`);
      if (!dryRun) {
        await db.externalGame.update({ where: { id: g.id }, data: { isJackpot: true } });
      }
    } else if (!shouldBe && g.isJackpot && reset) {
      unmarked++;
      console.log(`  ${dryRun ? '[dry] ' : ''}-jackpot "${g.displayName}"`);
      if (!dryRun) {
        await db.externalGame.update({ where: { id: g.id }, data: { isJackpot: false } });
      }
    }
  }
  console.log(`[autotag-jackpot] marked ${marked}${reset ? `, unmarked ${unmarked}` : ''}`);
}

main()
  .catch((err) => { console.error('[autotag-jackpot] failed', err); process.exit(1); })
  .finally(async () => { await db.$disconnect(); });
