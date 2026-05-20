#!/usr/bin/env node
/**
 * Branding and character gate.
 * Fails with exit 1 if any source file mentions the developer toolchain by name,
 * or contains an em / long dash character. Required by the project brief.
 *
 * Built by Anointed Coder.
 */

import { readdir, readFile, stat } from 'node:fs/promises';
import { join, extname } from 'node:path';

const ROOT = process.cwd();
const SCAN_DIRS = ['apps', 'packages', 'docs', 'scripts'];
const SKIP_DIRS = new Set(['node_modules', '.next', 'dist', '.turbo', 'build', 'out', '.git']);
const TEXT_EXT = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.md', '.json', '.css', '.html', '.prisma']);

// Banned strings. Self-references are stripped via the escape trick below so the
// scanner itself does not match.
const C = ['C', 'l', 'a', 'u', 'd', 'e'].join('');
const A = ['A', 'n', 't', 'h', 'r', 'o', 'p', 'i', 'c'].join('');
const banned = [C, A];
const dashes = ['—', '–']; // em dash, en dash

let failures = 0;

async function walk(dir) {
  const entries = await readdir(dir);
  for (const name of entries) {
    if (SKIP_DIRS.has(name)) continue;
    const full = join(dir, name);
    const s = await stat(full);
    if (s.isDirectory()) {
      await walk(full);
    } else if (TEXT_EXT.has(extname(full))) {
      await scanFile(full);
    }
  }
}

async function scanFile(file) {
  // Skip this scanner file itself.
  if (file.endsWith('check-branding.mjs')) return;
  const text = await readFile(file, 'utf8');
  const lines = text.split(/\r?\n/);
  lines.forEach((line, idx) => {
    for (const b of banned) {
      const i = line.toLowerCase().indexOf(b.toLowerCase());
      if (i >= 0) {
        failures += 1;
        console.error(`${file}:${idx + 1} banned reference to ${b}`);
      }
    }
    for (const d of dashes) {
      const i = line.indexOf(d);
      if (i >= 0) {
        failures += 1;
        console.error(`${file}:${idx + 1} contains forbidden long dash character`);
      }
    }
  });
}

async function main() {
  for (const d of SCAN_DIRS) {
    try {
      await walk(join(ROOT, d));
    } catch (err) {
      if (err && err.code === 'ENOENT') continue;
      throw err;
    }
  }
  if (failures === 0) {
    console.log('Branding gate: clean. No banned references found.');
    process.exit(0);
  } else {
    console.error(`Branding gate failed with ${failures} issue(s).`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(2);
});
