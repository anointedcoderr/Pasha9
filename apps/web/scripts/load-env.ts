// Built by Anointed Coder.
//
// Makes the wallet scripts runnable on their own.
//
// PM2 injects DATABASE_URL into the running app, but an interactive shell has
// no such thing, and tsx does not read the app env file the way Next.js does.
// So a script that builds its own PrismaClient dies on its FIRST query with an
// unhelpful runtime error rather than a clear "no database url" message.
// deploy.sh already works around this for prisma db push; this does the same
// for the scripts, so they no longer depend on the caller remembering a magic
// export prefix.
//
// Import this for its side effect BEFORE constructing PrismaClient:
//
//   import './load-env';
//   const db = new PrismaClient();
//
// Module imports are evaluated before the importing module's body, so the
// variable is in place by the time the client is built.

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const CANDIDATES = [
  '.env',
  '.env.production',
  '.env.local',
  // Scripts run via `pnpm --filter @pasha9/web exec`, so the working directory
  // is apps/web. The repo root is two levels up and is where the deployed
  // .env actually lives.
  '../../.env',
  '../../.env.production',
];

function readKey(file: string, key: string): string | null {
  try {
    for (const raw of readFileSync(file, 'utf8').split(/\r?\n/)) {
      const line = raw.trim();
      if (!line || line.startsWith('#')) continue;
      const eq = line.indexOf('=');
      if (eq === -1) continue;
      if (line.slice(0, eq).trim() !== key) continue;
      // Everything after the first '=' is the value, because a Postgres URL
      // contains '=' in its query string. Surrounding quotes are stripped;
      // nothing else is interpreted.
      let value = line.slice(eq + 1).trim();
      if (value.length >= 2 && ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'")))) {
        value = value.slice(1, -1);
      }
      return value || null;
    }
  } catch {
    // An unreadable candidate is not an error; try the next one.
  }
  return null;
}

if (!process.env.DATABASE_URL) {
  for (const rel of CANDIDATES) {
    const file = resolve(process.cwd(), rel);
    if (!existsSync(file)) continue;
    const value = readKey(file, 'DATABASE_URL');
    if (value) {
      process.env.DATABASE_URL = value;
      console.log(`(loaded DATABASE_URL from ${rel})`);
      break;
    }
  }
}

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set and was not found in any of:');
  for (const rel of CANDIDATES) console.error(`  ${rel}`);
  console.error('');
  console.error('Run this from /var/www/pasha9/app, or export DATABASE_URL first.');
  process.exit(1);
}
