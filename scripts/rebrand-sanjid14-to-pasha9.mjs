#!/usr/bin/env node
// One-shot codemod: rebrand the codebase from sanjid14 to Pasha9.
// Run once, commit, then delete this file.
// Safe: skips node_modules, .next, .turbo, .git, build outputs, and lockfiles.

import { readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';

const ROOT = process.cwd();

const SKIP_DIRS = new Set(['node_modules', '.next', '.turbo', '.git', 'dist', 'build', '.vercel', '.husky']);
const SKIP_FILES = new Set(['pnpm-lock.yaml', 'package-lock.json', 'yarn.lock']);

const ALLOW_EXT = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
  '.json', '.md', '.mdx',
  '.css', '.scss',
  '.yml', '.yaml',
  '.html',
  '.sh', '.ps1',
  '.env', '.example',
]);

// Order matters: longer/specific patterns first so they consume before shorter ones run.
const REPLACEMENTS = [
  // Package scope
  [/@sanjid14\//g, '@pasha9/'],
  // Cookie and storage keys
  [/sanjid14_lang/g, 'pasha9_lang'],
  [/sanjid14:lang/g, 'pasha9:lang'],
  // Repo URL in package.json / docs (we will rename the GitHub repo to Pasha9 later)
  [/anointedcoderr\/Sanjid14/g, 'anointedcoderr/Pasha9'],
  // Folder slug used in deploy paths
  [/\/var\/www\/sanjid14/g, '/var/www/pasha9'],
  // Capitalized references in package descriptions and docs
  [/sanjid14-platform/g, 'pasha9-platform'],
];

let changedFiles = 0;
let touchedReplacements = 0;

function walk(dir) {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    let st;
    try { st = statSync(full); } catch { continue; }
    if (st.isDirectory()) {
      walk(full);
      continue;
    }
    if (SKIP_FILES.has(entry)) continue;
    const ext = extname(entry);
    if (ext && !ALLOW_EXT.has(ext)) continue;
    // Skip the codemod itself
    if (full.endsWith('rebrand-sanjid14-to-pasha9.mjs')) continue;

    let text;
    try { text = readFileSync(full, 'utf8'); } catch { continue; }
    const original = text;
    let localHits = 0;
    for (const [pattern, replacement] of REPLACEMENTS) {
      text = text.replace(pattern, (match) => {
        localHits++;
        return replacement;
      });
    }
    if (text !== original) {
      writeFileSync(full, text);
      changedFiles++;
      touchedReplacements += localHits;
      const rel = full.slice(ROOT.length + 1).replace(/\\/g, '/');
      console.log(`  ${rel}  (${localHits} replacement${localHits === 1 ? '' : 's'})`);
    }
  }
}

console.log('Pasha9 rebrand codemod');
console.log('======================');
walk(ROOT);
console.log('');
console.log(`Done. ${changedFiles} file(s) changed, ${touchedReplacements} replacement(s) applied.`);
console.log('');
console.log('Next steps:');
console.log('  1. Manually update apps/web/lib/constants/brand.ts (full rewrite)');
console.log('  2. Manually update apps/web/components/site/Logo.tsx (display text)');
console.log('  3. Manually update apps/web/app/layout.tsx metadata');
console.log('  4. Run: pnpm install   (refresh lockfile with new @pasha9/* names)');
console.log('  5. Delete this codemod file.');
