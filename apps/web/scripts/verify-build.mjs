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

// Favicon + PWA manifest asset smoke. The favicon <link> tags are
// SSR'd by the Next 14 metadata API in app/layout.tsx, but the
// resolved icon URL points at either an operator-uploaded path
// (under /uploads/) or the bundled fallback /favicon.svg. The PWA
// manifest at /manifest.webmanifest references /app-assets/
// icon-{192,512,512-maskable}.png. If any of these source files
// disappear, browsers fall back to a default Chrome dot icon and
// Google's SERP refresh stalls. Catching the regression at build
// time is much cheaper than discovering it days later when the
// site name still shows the wrong icon in search results.
const assetRequired = [
  'public/favicon.svg',
  'public/app-assets/icon-192.png',
  'public/app-assets/icon-512.png',
  'public/app-assets/icon-512-maskable.png',
];
const assetMissing = assetRequired.filter((p) => !existsSync(resolve(root, p)));
if (assetMissing.length > 0) {
  console.error('\n[verify-build] Favicon / PWA manifest assets are missing:');
  for (const p of assetMissing) console.error(`  - ${p}`);
  console.error('\nThe Next metadata API points <link rel="icon"> at /favicon.svg');
  console.error('and the manifest references the /app-assets/ icons. Without these,');
  console.error('browsers (and Googlebot SERP crawler) get a 404 for the icon and');
  console.error('fall back to a default. Replace the file(s) before shipping.');
  process.exit(1);
}

console.log('[verify-build] OK . pages-router scaffolding present:');
for (const p of required) console.log(`  + ${p}`);
console.log('[verify-build] OK . favicon + manifest assets present:');
for (const p of assetRequired) console.log(`  + ${p}`);
