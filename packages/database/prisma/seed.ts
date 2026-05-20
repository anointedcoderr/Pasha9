/**
 * Seed data for Milestone 2.
 * Mirrors the Milestone 1 mock data so visual demo and DB-backed runs match.
 * Built by Anointed Coder.
 */

// NOTE: This script is intentionally not wired up in Milestone 1.
// It will be activated once Milestone 2 starts and DATABASE_URL is set.
// Run with: pnpm --filter @sanjid14/database seed

import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

async function main() {
  console.log('Seeding sanjid14 reference data...');

  await db.systemSetting.upsert({
    where: { key: 'site_name' },
    update: {},
    create: { key: 'site_name', value: 'sanjid14', type: 'string' },
  });

  console.log('Seed complete. Add bonus rules, banners, categories, providers in Milestone 2.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
