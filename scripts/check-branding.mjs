#!/usr/bin/env node
/**
 * Branding and character gate for Pasha9.
 *
 * Fails with exit 1 when any source file:
 *   - mentions a banned name (developer toolchain or the retired `sanjid14` brand),
 *   - contains an em or en dash character,
 *   - is in the required-presence list but is missing the "Built by Anointed Coder" credit.
 *
 * Required by the project brief.
 *
 * Built by Anointed Coder.
 */

import { readdir, readFile, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, extname, relative } from 'node:path';

const ROOT = process.cwd();
const SCAN_DIRS = ['apps', 'packages', 'docs', 'scripts'];
const SKIP_DIRS = new Set(['node_modules', '.next', 'dist', '.turbo', 'build', 'out', '.git']);
const TEXT_EXT = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.md', '.json', '.css', '.html', '.prisma']);

// Files that are allowed to mention the retired brand for migration record-keeping.
// The rebrand codemod and this scanner reference the names by definition.
// Operational docs reference the live database name (which is still `sanjid14`)
// and the testing checklist quotes the banned terms inside acceptance criteria.
const NAME_BAN_ALLOWLIST = new Set([
  'scripts/check-branding.mjs',
  'scripts/rebrand-sanjid14-to-pasha9.mjs',
  'docs/m1-delivery.md',
  'docs/testing-checklist.md',
  'docs/deployment-guide.md',
  'docs/migration-guide.md',
  'docs/backup-guide.md',
  'docs/admin-guide.md',
  'docs/milestones.md',
  'docs/handover-checklist.md',
]);

// Banned strings. The developer toolchain names are split character-by-character
// so this scanner itself does not match.
const C = ['C', 'l', 'a', 'u', 'd', 'e'].join('');
const A = ['A', 'n', 't', 'h', 'r', 'o', 'p', 'i', 'c'].join('');
const RETIRED = 'sanjid14';
const banned = [C, A, RETIRED];

// Encoded so the scanner does not match itself.
const dashes = [String.fromCharCode(0x2014), String.fromCharCode(0x2013)];

// Files that must contain the "Built by Anointed Coder" credit string.
const MUST_CONTAIN_CREDIT = [
  'apps/web/components/site/Footer.tsx',
  'apps/web/components/admin/AdminSidebar.tsx',
  'apps/web/app/(admin)/admin/login/page.tsx',
  'apps/web/app/(admin)/admin/settings/page.tsx',
  'apps/web/app/(admin)/admin/handover/page.tsx',
  'README.md',
];

const CREDIT_TOKEN = 'Anointed Coder';

let failures = 0;
const fail = (msg) => {
  failures += 1;
  console.error(msg);
};

function toPosix(p) {
  return p.split('\\').join('/');
}

async function walk(dir) {
  let entries;
  try { entries = await readdir(dir); } catch (err) {
    if (err && err.code === 'ENOENT') return;
    throw err;
  }
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
  const rel = toPosix(relative(ROOT, file));
  const text = await readFile(file, 'utf8');
  const lines = text.split(/\r?\n/);
  const allowName = NAME_BAN_ALLOWLIST.has(rel);

  lines.forEach((line, idx) => {
    if (!allowName) {
      for (const b of banned) {
        const i = line.toLowerCase().indexOf(b.toLowerCase());
        if (i >= 0) fail(`${rel}:${idx + 1} banned reference to ${b}`);
      }
    }
    for (const d of dashes) {
      if (line.indexOf(d) >= 0) fail(`${rel}:${idx + 1} contains forbidden long dash character`);
    }
  });
}

async function assertCreditPresence() {
  for (const rel of MUST_CONTAIN_CREDIT) {
    const full = join(ROOT, rel);
    if (!existsSync(full)) {
      fail(`${rel} is missing from the repo (required to display the "Built by Anointed Coder" credit).`);
      continue;
    }
    const text = await readFile(full, 'utf8');
    if (!text.includes(CREDIT_TOKEN)) {
      fail(`${rel} is missing the "${CREDIT_TOKEN}" credit string.`);
    }
  }
}

async function main() {
  for (const d of SCAN_DIRS) {
    await walk(join(ROOT, d));
  }
  await assertCreditPresence();

  if (failures === 0) {
    console.log('Branding gate: clean. Banned refs absent, credits present.');
    process.exit(0);
  }
  console.error(`Branding gate failed with ${failures} issue(s).`);
  process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(2);
});
