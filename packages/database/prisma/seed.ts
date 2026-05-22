/**
 * Pasha9 database seed.
 *
 * Idempotent. Run on every fresh deploy. Populates system roles, permissions,
 * the initial super admin user, default homepage content, sample categories,
 * providers, and an initial set of games so the public site looks alive.
 *
 * Run with: pnpm --filter @pasha9/database seed
 *
 * Built by Anointed Coder.
 */

import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

async function main() {
  console.log('Pasha9 seed: starting...');

  await db.systemSetting.upsert({
    where: { key: 'site_name' },
    update: {},
    create: { key: 'site_name', value: 'Pasha9', type: 'string' },
  });

  console.log('Pasha9 seed: complete. Full content seeding lands in Phase 1.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
