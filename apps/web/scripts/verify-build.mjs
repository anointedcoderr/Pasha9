// Built by Anointed Coder.
//
// Post-build smoke check. Confirms the production output contains
// the pages-router error scaffolding (.next/server/pages/_error.js
// and friends). Without these the Next runtime crashes with
// MODULE_NOT_FOUND while trying to require .next/server/pages/_error.js
// and every request returns a generic 'Application error' before
// any of our app-router boundaries can mount.
//
// Run automatically by `pnpm --filter @pasha9/web build`.

import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const required = [
  '.next/server/pages/_error.js',
  '.next/server/pages/404.html',
  '.next/server/pages/500.html',
  '.next/server/pages/_document.js',
  '.next/server/pages/_app.js',
];

const missing = required.filter((p) => !existsSync(resolve(root, p)));

if (missing.length > 0) {
  console.error('\n[verify-build] Production output is missing required pages scaffolding:');
  for (const p of missing) console.error(`  - ${p}`);
  console.error('\nThis usually means:');
  console.error('  - apps/web/pages/_error.tsx was removed; restore it.');
  console.error('  - a transient build error skipped the pages compile; clean and rebuild:');
  console.error('      rm -rf apps/web/.next && pnpm --filter @pasha9/web build');
  process.exit(1);
}

console.log('[verify-build] OK . pages-router scaffolding present:');
for (const p of required) console.log(`  + ${p}`);
