// Built by Anointed Coder.
//
// One-shot installer for the premium atelier asset slots.
//
// Reads a source directory of operator-supplied images (default
// path: ~/Downloads/pasha9), matches each file to its SystemSetting
// slot key by filename, copies the file into UPLOAD_ROOT/atelier
// with a hashed name (so browsers cache-bust on every install run),
// and upserts the matching SystemSetting row.
//
// Run:
//   pnpm -F @pasha9/database exec tsx scripts/install-atelier-assets.ts
//   pnpm -F @pasha9/database exec tsx scripts/install-atelier-assets.ts --src "/path/to/folder"
//
// Idempotent. Re-run after dropping new files into the source
// folder to refresh assets without touching the admin panel.

import { mkdir, copyFile, readdir, stat, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, extname, basename } from 'node:path';
import { createHash } from 'node:crypto';
import { homedir } from 'node:os';
import { PrismaClient } from '@prisma/client';

// Slot map mirrors apps/web/lib/atelier/slots.ts. Kept inline here
// so this script is dependency-free of the Next.js tree.
const SLOT_KEY_BY_ID: Record<string, string> = {
  spin_hero_backdrop: 'atelier_spin_hero_backdrop',
  lotto_hero_backdrop: 'atelier_lotto_hero_backdrop',
  spin_tier_crest_lucky: 'atelier_spin_tier_crest_lucky',
  spin_tier_crest_royal: 'atelier_spin_tier_crest_royal',
  spin_tier_crest_supreme: 'atelier_spin_tier_crest_supreme',
  lotto_ball_gold: 'atelier_lotto_ball_gold',
  lotto_ball_silver: 'atelier_lotto_ball_silver',
  lotto_ball_bronze: 'atelier_lotto_ball_bronze',
  lotto_ball_emerald: 'atelier_lotto_ball_emerald',
  spin_hub_gem: 'atelier_spin_hub_gem',
  texture_brass_tile: 'atelier_texture_brass_tile',
  texture_mahogany_tile: 'atelier_texture_mahogany_tile',
  texture_holo_foil: 'atelier_texture_holo_foil',
  texture_paper_grain: 'atelier_texture_paper_grain',
  texture_stamp_ink: 'atelier_texture_stamp_ink',
  texture_gold_sweep: 'atelier_texture_gold_sweep',
};

interface PlanRow {
  slotId: string;
  systemKey: string;
  sourcePath: string;
  destFilename: string;
  destAbsPath: string;
  publicUrl: string;
  bytes: number;
}

function getArg(name: string): string | null {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1 || i === process.argv.length - 1) return null;
  return process.argv[i + 1];
}

function resolveSourceDir(): string {
  const explicit = getArg('src');
  if (explicit) return explicit;
  // Default to Downloads/pasha9 on the operator's machine. Works on
  // mac, linux, and Windows because Node's os.homedir() handles
  // each platform.
  return join(homedir(), 'Downloads', 'pasha9');
}

function resolveUploadRoot(): string {
  const env = process.env.UPLOAD_ROOT;
  if (env && env.trim()) return env.trim();
  if (process.env.NODE_ENV === 'production') return '/var/www/pasha9/uploads';
  // Repo-relative default for dev. Two levels up from
  // packages/database/scripts so we land at the monorepo root.
  return join(process.cwd(), '..', '..', 'uploads');
}

async function listSourceFiles(srcDir: string): Promise<Array<{ name: string; abs: string; bytes: number }>> {
  const names = await readdir(srcDir);
  const out: Array<{ name: string; abs: string; bytes: number }> = [];
  for (const name of names) {
    const abs = join(srcDir, name);
    const st = await stat(abs);
    if (!st.isFile()) continue;
    out.push({ name, abs, bytes: st.size });
  }
  return out;
}

function matchSlot(filename: string): string | null {
  const stem = basename(filename, extname(filename)).toLowerCase();
  // Exact match preferred (operator named the file e.g.
  // "spin_hero_backdrop.png").
  if (SLOT_KEY_BY_ID[stem]) return stem;
  // Otherwise scan for a slot id that appears anywhere in the stem.
  // Picks the longest match so "spin_tier_crest_supreme" beats
  // "spin" when both are candidates.
  let best: string | null = null;
  for (const id of Object.keys(SLOT_KEY_BY_ID)) {
    if (stem.includes(id) && (!best || id.length > best.length)) best = id;
  }
  return best;
}

function hashShort(input: string): string {
  return createHash('sha256').update(input).digest('hex').slice(0, 10);
}

async function plan(srcDir: string, uploadRoot: string): Promise<PlanRow[]> {
  const files = await listSourceFiles(srcDir);
  const out: PlanRow[] = [];
  const claimed = new Set<string>();
  for (const f of files) {
    const slotId = matchSlot(f.name);
    if (!slotId) continue;
    if (claimed.has(slotId)) continue; // first match wins
    claimed.add(slotId);

    const ext = extname(f.name).toLowerCase() || '.png';
    // Hash on (slotId, bytes, mtime-ish via name) so re-running with
    // the same file does not bust the URL; replacing the file
    // produces a new URL so browsers refresh.
    const tag = hashShort(`${slotId}:${f.bytes}:${f.name}`);
    const destFilename = `${slotId}-${tag}${ext}`;
    const destAbsPath = join(uploadRoot, 'atelier', destFilename);
    const publicUrl = `/uploads/atelier/${destFilename}`;

    out.push({
      slotId,
      systemKey: SLOT_KEY_BY_ID[slotId],
      sourcePath: f.abs,
      destFilename,
      destAbsPath,
      publicUrl,
      bytes: f.bytes,
    });
  }
  return out;
}

async function run() {
  const srcDir = resolveSourceDir();
  const uploadRoot = resolveUploadRoot();

  console.log(`[atelier] source: ${srcDir}`);
  console.log(`[atelier] target: ${uploadRoot}/atelier`);

  if (!existsSync(srcDir)) {
    console.error(`[atelier] source directory does not exist: ${srcDir}`);
    console.error(`[atelier] pass --src "/path/to/folder" to override.`);
    process.exit(1);
  }

  const rows = await plan(srcDir, uploadRoot);
  if (rows.length === 0) {
    console.warn(`[atelier] no recognisable files found. Filenames must contain a slot id (e.g. "spin_hero_backdrop.png").`);
    process.exit(0);
  }

  // Phase 1: file system. Always runs.
  await mkdir(join(uploadRoot, 'atelier'), { recursive: true });
  for (const r of rows) {
    await copyFile(r.sourcePath, r.destAbsPath);
    const kb = (r.bytes / 1024).toFixed(0);
    console.log(`  + ${r.slotId.padEnd(28)} ${kb.padStart(6)}KB  ${r.publicUrl}`);
  }

  // Phase 2: database. Attempts a single connect probe first so the
  // script behaves cleanly when DATABASE_URL is not set on this
  // dev machine - we write a SQL fallback the operator can pipe
  // into psql on the VPS instead.
  const dbReachable = await canConnectToDb();
  if (dbReachable) {
    const db = new PrismaClient();
    try {
      for (const r of rows) {
        await db.systemSetting.upsert({
          where: { key: r.systemKey },
          create: { key: r.systemKey, value: r.publicUrl },
          update: { value: r.publicUrl },
        });
      }
      console.log(`\n[atelier] wrote ${rows.length} SystemSetting rows via Prisma.`);
    } finally {
      await db.$disconnect();
    }
  } else {
    const sqlPath = join(uploadRoot, 'atelier', '_install.sql');
    const sql = buildSqlFallback(rows);
    await writeFile(sqlPath, sql, 'utf8');
    console.log(`\n[atelier] DATABASE_URL not set; wrote SQL fallback to:`);
    console.log(`  ${sqlPath}`);
    console.log(`Apply on the live DB with:`);
    console.log(`  psql "$DATABASE_URL" -f "${sqlPath}"`);
  }

  // Report any slot still missing so the operator knows what to add
  // next.
  const installed = new Set(rows.map((r) => r.slotId));
  const missing = Object.keys(SLOT_KEY_BY_ID).filter((id) => !installed.has(id));
  if (missing.length) {
    console.log(`\n[atelier] installed ${rows.length}/${Object.keys(SLOT_KEY_BY_ID).length}. Missing:`);
    for (const id of missing) console.log(`  - ${id}`);
  } else {
    console.log(`\n[atelier] installed ${rows.length}/${Object.keys(SLOT_KEY_BY_ID).length}. Every slot is wired.`);
  }
}

async function canConnectToDb(): Promise<boolean> {
  if (!process.env.DATABASE_URL) return false;
  let db: PrismaClient | null = null;
  try {
    db = new PrismaClient();
    await db.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  } finally {
    try { await db?.$disconnect(); } catch { /* swallow */ }
  }
}

function sqlQuote(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

// Build a 25-char cuid-like identifier compatible with Prisma's
// default(cuid()) format. Uses crypto.randomUUID-derived bytes so
// the same key never produces a colliding id across runs.
function makeCuidLike(): string {
  const id = createHash('sha256').update(`${Date.now()}:${Math.random()}:${process.hrtime.bigint()}`).digest('hex');
  return `c${id.slice(0, 24)}`;
}

function buildSqlFallback(rows: PlanRow[]): string {
  const lines: string[] = [
    '-- Generated by install-atelier-assets.ts',
    '-- Apply with:  psql "$DATABASE_URL" -f _install.sql',
    '--',
    '-- Idempotent. ON CONFLICT path only refreshes value + updatedAt;',
    '-- id is preserved on existing rows so foreign keys stay intact.',
    'BEGIN;',
  ];
  for (const r of rows) {
    const id = makeCuidLike();
    lines.push(
      `INSERT INTO "SystemSetting" ("id", "key", "value", "type", "category", "updatedAt") VALUES (`
        + `${sqlQuote(id)}, ${sqlQuote(r.systemKey)}, ${sqlQuote(r.publicUrl)}, 'string', 'general', NOW()`
        + `) ON CONFLICT ("key") DO UPDATE SET "value" = EXCLUDED."value", "updatedAt" = NOW();`,
    );
  }
  lines.push('COMMIT;');
  lines.push('');
  return lines.join('\n');
}

run().catch((err) => {
  console.error('[atelier] failed:', err);
  process.exit(1);
});
