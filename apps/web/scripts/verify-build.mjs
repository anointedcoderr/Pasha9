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

// Favicon hard requirement. The favicon <link> tags are SSR'd by
// the Next 14 metadata API in app/layout.tsx, and the resolved
// URL falls back to /favicon.svg when no operator-uploaded value
// is set. If the bundled fallback ever vanishes, every fresh
// install renders a broken favicon and Googlebot SERP refresh
// stalls because crawlers see a 404 for the icon link.
const faviconRequired = ['public/favicon.svg'];
const faviconMissing = faviconRequired.filter((p) => !existsSync(resolve(root, p)));
if (faviconMissing.length > 0) {
  console.error('\n[verify-build] Favicon fallback is missing:');
  for (const p of faviconMissing) console.error(`  - ${p}`);
  console.error('\napp/layout.tsx generateMetadata() points <link rel="icon">');
  console.error('at /favicon.svg as the bundled fallback when no operator upload');
  console.error('is set in SystemSetting. Without the file present in the build,');
  console.error('every fresh visitor and every SERP crawler hits a 404 for the icon.');
  process.exit(1);
}

// PWA manifest icons are a SOFT warning. The manifest at
// /manifest.webmanifest references /app-assets/icon-{192,512,
// 512-maskable}.png. These are only consumed when a player taps
// "Add to Home Screen" / "Install app" - the regular browser tab
// icon does NOT depend on them. If they are missing the manifest
// emits a console warning in the install flow but the site still
// works. Warn loudly at build time so a future commit can drop in
// the real PNG masters without blocking deploys today.
const pwaIconsOptional = [
  'public/app-assets/icon-192.png',
  'public/app-assets/icon-512.png',
  'public/app-assets/icon-512-maskable.png',
];
const pwaMissing = pwaIconsOptional.filter((p) => !existsSync(resolve(root, p)));

console.log('[verify-build] OK . pages-router scaffolding present:');
for (const p of required) console.log(`  + ${p}`);
console.log('[verify-build] OK . favicon fallback present:');
for (const p of faviconRequired) console.log(`  + ${p}`);
if (pwaMissing.length > 0) {
  console.log('[verify-build] WARN . PWA Add-to-Home-Screen icons missing:');
  for (const p of pwaMissing) console.log(`  ! ${p} (Add-to-Home-Screen will use default; tab favicon unaffected)`);
} else {
  console.log('[verify-build] OK . PWA manifest icons present:');
  for (const p of pwaIconsOptional) console.log(`  + ${p}`);
}
