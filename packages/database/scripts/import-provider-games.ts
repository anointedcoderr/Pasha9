/**
 * Multi-brand iGamingAPIs catalog importer.
 *
 * Reads one CSV (or every CSV in a directory) exported from the
 * iGamingAPIs provider panel and upserts the rows into ExternalGame
 * under the iGamingAPIs GameProvider, grouped by ProviderBrand. The
 * existing import-jili-games.ts is the single-brand precursor; this
 * script handles arbitrary brands using the same idempotent shape.
 *
 * CSV columns (header required):
 *   Game ID, Game Name, Brand, Category, Image URL
 *
 * Rules:
 *  - "Game ID" is the canonical numeric gameUid when present.
 *  - When "Game ID" is empty the script extracts the numeric id from
 *    the Image URL when the URL ends in /<digits>/public OR /<digits>.png.
 *    No fake IDs are ever generated.
 *  - Rows where no numeric gameUid can be derived are skipped and
 *    reported.
 *  - Brand keys are normalized into uppercase snake_case slugs.
 *  - Display names are reformatted to operator-readable text.
 *  - Category values are normalized through a shared map matching
 *    apps/web/lib/homepage/sections.ts conventions.
 *
 * Flags:
 *   --dry-run        Parse + report only. No DB writes.
 *   --skip-jili      Skip JILI rows. ON by default - JILI is owned by
 *                    the dedicated importer.
 *   --include-jili   Override the above; useful when re-importing a
 *                    full export that happens to include JILI.
 *   --update-only    Update existing ExternalGame rows but do not
 *                    insert new ones.
 *
 * Run:
 *   pnpm --filter @pasha9/database import:provider-games
 *     ./packages/database/seed-data/provider-games
 *
 *   pnpm --filter @pasha9/database import:provider-games
 *     ./packages/database/seed-data/provider-games --dry-run
 *
 *   pnpm --filter @pasha9/database import:provider-games
 *     ./packages/database/seed-data/provider-games/pgsoft.csv
 *
 * Built by Anointed Coder.
 */

import { PrismaClient, Prisma } from '@prisma/client';
import * as fs from 'node:fs';
import * as path from 'node:path';

const db = new PrismaClient();
const log = (msg: string) => console.log(`[import-provider-games] ${msg}`);
const warn = (msg: string) => console.warn(`[import-provider-games] WARN ${msg}`);

const DEFAULT_SEED_DIR = path.resolve(__dirname, '..', 'seed-data', 'provider-games');
const PROVIDER_KEY = 'igamingapis';

// -------- Flags --------

interface Flags {
  inputs: string[];
  dryRun: boolean;
  skipJili: boolean;
  includeJili: boolean;
  updateOnly: boolean;
}

function parseFlags(argv: string[]): Flags {
  const inputs: string[] = [];
  let dryRun = false;
  let skipJili = true; // default: protect the dedicated JILI importer's domain
  let includeJili = false;
  let updateOnly = false;
  for (const a of argv) {
    switch (a) {
      case '--dry-run': dryRun = true; break;
      case '--skip-jili': skipJili = true; includeJili = false; break;
      case '--include-jili': includeJili = true; skipJili = false; break;
      case '--update-only': updateOnly = true; break;
      default:
        if (a.startsWith('-')) {
          warn(`Unknown flag "${a}", ignoring.`);
        } else {
          inputs.push(a);
        }
    }
  }
  return { inputs, dryRun, skipJili, includeJili, updateOnly };
}

// -------- CSV parser (minimal, header-driven) --------

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const c = line[i];
    if (c === '"' && line[i + 1] === '"' && inQuotes) { cur += '"'; i += 1; continue; }
    if (c === '"') { inQuotes = !inQuotes; continue; }
    if (c === ',' && !inQuotes) { out.push(cur); cur = ''; continue; }
    cur += c;
  }
  out.push(cur);
  return out;
}

function parseCsv(text: string): Array<Record<string, string>> {
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length === 0) return [];
  const headers = splitCsvLine(lines[0]).map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const cells = splitCsvLine(line);
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h] = (cells[i] ?? '').trim(); });
    return row;
  });
}

// -------- Brand normalisation --------

interface BrandMeta { key: string; display: string }

const BRAND_OVERRIDES: Record<string, BrandMeta> = {
  jili:                  { key: 'JILI',                 display: 'JILI' },
  pgsoft:                { key: 'PGSOFT',               display: 'PGSoft' },
  jdb:                   { key: 'JDB',                  display: 'JDB' },
  'pragmaticplay-asia':  { key: 'PRAGMATIC_ASIA',       display: 'Pragmatic Play Asia' },
  pragmaticplayasia:     { key: 'PRAGMATIC_ASIA',       display: 'Pragmatic Play Asia' },
  pragmaticasia:         { key: 'PRAGMATIC_ASIA',       display: 'Pragmatic Play Asia' },
  'pragmatic-play-asia': { key: 'PRAGMATIC_ASIA',       display: 'Pragmatic Play Asia' },
  spribe:                { key: 'SPRIBE',               display: 'Spribe' },
  'evolution live (asia)': { key: 'EVOLUTION_LIVE_ASIA', display: 'Evolution Live Asia' },
  'evolutionliveasia':   { key: 'EVOLUTION_LIVE_ASIA', display: 'Evolution Live Asia' },
  'evolution-live-asia': { key: 'EVOLUTION_LIVE_ASIA', display: 'Evolution Live Asia' },
  'evolution live':      { key: 'EVOLUTION_LIVE',      display: 'Evolution Live' },
  evolutionlive:         { key: 'EVOLUTION_LIVE',      display: 'Evolution Live' },
  habanero:              { key: 'HABANERO',            display: 'Habanero' },
  btigaming:             { key: 'BTI_GAMING',          display: 'BTI Sports' },
  '9wickets':            { key: 'NINE_WICKETS',        display: '9Wickets' },
  '9wicket':             { key: 'NINE_WICKETS',        display: '9Wickets' },
};

function normalizeBrand(raw: string): BrandMeta {
  const key = (raw ?? '').trim();
  if (!key) return { key: 'UNKNOWN', display: 'Unknown' };
  const lower = key.toLowerCase();
  if (BRAND_OVERRIDES[lower]) return BRAND_OVERRIDES[lower];
  const slug = key
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 60) || 'UNKNOWN';
  return { key: slug, display: key };
}

// -------- Category normalisation --------

const CATEGORY_MAP: Record<string, string> = {
  // slots family
  slot: 'slots', slots: 'slots',
  slotgame: 'slots', 'slot game': 'slots',
  hotslots: 'slots',
  // flash / instant
  flash: 'flash', instant: 'flash', minigames: 'flash', 'mini games': 'flash',
  // live casino / table
  casinolive: 'live_casino', 'casino live': 'live_casino',
  livecasino: 'live_casino', 'live casino': 'live_casino',
  casino: 'live_casino',
  table: 'table', card: 'table', cards: 'table', poker: 'table',
  baccarat: 'table', blackjack: 'table', chess: 'table',
  // pvc & gamble misc
  pvc: 'table', 'gamble game': 'table',
  // fishing / fish
  fish: 'fishing', fishing: 'fishing',
  // crash
  crash: 'crash',
  // sportsbook
  sports: 'sportsbook', sport: 'sportsbook', sportsbook: 'sportsbook',
  // lobby
  lobby: 'live_casino',
};

function normalizeCategory(raw: string | null | undefined): { category: string; original: string | null; warning: string | null } {
  const original = (raw ?? '').trim() || null;
  if (!original) return { category: 'slots', original: null, warning: null };
  const lower = original.toLowerCase();
  if (CATEGORY_MAP[lower]) return { category: CATEGORY_MAP[lower], original, warning: null };
  const singular = lower.endsWith('s') ? lower.slice(0, -1) : lower;
  if (CATEGORY_MAP[singular]) return { category: CATEGORY_MAP[singular], original, warning: null };
  // Unknown values like hex hashes (e.g. a4a67f1259cabed59e338e30149ceb0f)
  // get mapped to slots so the public lobby still renders them, plus a
  // warning so the import summary calls them out.
  return { category: 'slots', original, warning: `unknown category "${original}", mapped to slots` };
}

// -------- gameUid extraction --------

function extractGameUid(rawId: string, imageUrl: string): string | null {
  const idTrim = (rawId ?? '').trim();
  if (/^\d+$/.test(idTrim)) return idTrim;

  // imagedelivery.net path: /<digits>/public
  const m1 = imageUrl.match(/\/(\d+)\/(public|[a-z]+)\/?$/i);
  if (m1) return m1[1];

  // igamingapis.com/img/<digits>.png
  const m2 = imageUrl.match(/\/img\/(\d+)\.(png|jpe?g|webp)$/i);
  if (m2) return m2[1];

  return null;
}

// -------- Importer --------

interface SkippedRow {
  brand: string;
  line: number;
  reason: string;
  displayName: string;
  gameUid: string;
  imageUrl: string;
}

interface PerBrandStats {
  brandKey: string;
  brandDisplay: string;
  total: number;
  inserted: number;
  updated: number;
  skipped: number;
  byCategory: Record<string, number>;
  unknownCategories: Set<string>;
}

async function processFile(filePath: string, flags: Flags, providerId: string, allStats: Map<string, PerBrandStats>, allSkipped: SkippedRow[]): Promise<void> {
  const text = fs.readFileSync(filePath, 'utf8');
  const rows = parseCsv(text);
  log(`file ${path.basename(filePath)} parsed ${rows.length} rows`);

  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    const lineNo = i + 2;

    const rawId = row['Game ID'] ?? row.gameUid ?? row.game_uid ?? '';
    const displayName = (row['Game Name'] ?? row.displayName ?? row.name ?? '').trim();
    const brandRaw = (row.Brand ?? row.brandKey ?? '').trim();
    const categoryRaw = (row.Category ?? row.category ?? '').trim();
    const imageUrl = (row['Image URL'] ?? row.imageUrl ?? '').trim();

    if (!displayName || !brandRaw) {
      allSkipped.push({ brand: brandRaw || '?', line: lineNo, reason: 'missing displayName or Brand', displayName: displayName || '-', gameUid: '-', imageUrl });
      continue;
    }

    const brand = normalizeBrand(brandRaw);

    if (flags.skipJili && brand.key === 'JILI' && !flags.includeJili) {
      allSkipped.push({ brand: brand.key, line: lineNo, reason: 'JILI skipped (use --include-jili)', displayName, gameUid: rawId, imageUrl });
      continue;
    }

    const gameUid = extractGameUid(rawId, imageUrl);
    if (!gameUid) {
      allSkipped.push({ brand: brand.key, line: lineNo, reason: 'no numeric gameUid in row or image URL', displayName, gameUid: rawId || '(empty)', imageUrl });
      continue;
    }

    const norm = normalizeCategory(categoryRaw);

    if (!allStats.has(brand.key)) {
      allStats.set(brand.key, {
        brandKey: brand.key,
        brandDisplay: brand.display,
        total: 0,
        inserted: 0,
        updated: 0,
        skipped: 0,
        byCategory: {},
        unknownCategories: new Set<string>(),
      });
    }
    const stats = allStats.get(brand.key)!;
    stats.total += 1;
    stats.byCategory[norm.category] = (stats.byCategory[norm.category] ?? 0) + 1;
    if (norm.warning && norm.original) stats.unknownCategories.add(norm.original);

    if (flags.dryRun) continue;

    // Brand row (idempotent).
    const brandRow = await db.providerBrand.upsert({
      where: { providerId_brandKey: { providerId, brandKey: brand.key } },
      create: { providerId, brandKey: brand.key, displayName: brand.display, status: 'active' },
      update: {
        // Only set displayName when it would change; never flip status.
        ...(brand.display ? { displayName: brand.display } : {}),
      },
      select: { id: true },
    });

    const rawMeta: Prisma.InputJsonValue = {
      source: path.basename(filePath),
      brand: brand.key,
      brandDisplay: brand.display,
      originalCategory: norm.original,
      originalRow: { rawId, brandRaw, displayName, categoryRaw, imageUrl },
    };

    const existing = await db.externalGame.findUnique({
      where: { providerId_gameUid: { providerId, gameUid } },
      select: { id: true, status: true },
    });

    const now = new Date();
    if (existing) {
      // Update path: never overwrite an operator-set status. Only
      // refresh metadata. ExternalGame.status stays whatever the
      // admin currently has it on.
      await db.externalGame.update({
        where: { id: existing.id },
        data: {
          brandId: brandRow.id,
          displayName,
          category: norm.category,
          imageUrl: imageUrl || null,
          rawMeta,
          lastSyncAt: now,
        },
      });
      stats.updated += 1;
    } else {
      if (flags.updateOnly) {
        allSkipped.push({ brand: brand.key, line: lineNo, reason: 'update-only mode, row not in DB yet', displayName, gameUid, imageUrl });
        stats.skipped += 1;
        continue;
      }
      await db.externalGame.create({
        data: {
          providerId,
          brandId: brandRow.id,
          gameUid,
          displayName,
          category: norm.category,
          imageUrl: imageUrl || null,
          status: 'active',
          rawMeta,
          lastSyncAt: now,
        },
      });
      stats.inserted += 1;
    }
  }
}

function listCsvFiles(target: string): string[] {
  const abs = path.resolve(process.cwd(), target);
  if (!fs.existsSync(abs)) {
    console.error(`[import-provider-games] path not found: ${abs}`);
    process.exit(1);
  }
  const stat = fs.statSync(abs);
  if (stat.isDirectory()) {
    return fs.readdirSync(abs)
      .filter((f) => f.toLowerCase().endsWith('.csv'))
      .map((f) => path.join(abs, f))
      .sort();
  }
  if (stat.isFile() && abs.toLowerCase().endsWith('.csv')) return [abs];
  console.error(`[import-provider-games] not a CSV file or directory: ${abs}`);
  process.exit(1);
}

async function main() {
  const flags = parseFlags(process.argv.slice(2));
  const target = flags.inputs[0] ?? DEFAULT_SEED_DIR;
  const files = listCsvFiles(target);
  if (files.length === 0) {
    console.error(`[import-provider-games] no CSV files found under ${target}`);
    process.exit(1);
  }
  log(`target ${target}`);
  log(`flags dry-run=${flags.dryRun} skip-jili=${flags.skipJili} include-jili=${flags.includeJili} update-only=${flags.updateOnly}`);

  const provider = await db.gameProvider.findUnique({
    where: { providerKey: PROVIDER_KEY },
    select: { id: true, name: true, status: true },
  });
  if (!provider) {
    console.error(`[import-provider-games] GameProvider with providerKey=${PROVIDER_KEY} not found. Create it under /admin/providers first.`);
    process.exit(1);
  }
  log(`provider ${provider.name} (id=${provider.id}, status=${provider.status})`);

  const allStats = new Map<string, PerBrandStats>();
  const allSkipped: SkippedRow[] = [];
  const t0 = Date.now();

  for (const f of files) {
    await processFile(f, flags, provider.id, allStats, allSkipped);
  }

  if (!flags.dryRun) {
    const now = new Date();
    for (const stats of allStats.values()) {
      // Stamp lastSyncAt on every brand we touched.
      await db.providerBrand.updateMany({
        where: { providerId: provider.id, brandKey: stats.brandKey },
        data: { lastSyncAt: now },
      });
    }
  }

  // Summary.
  const ms = Date.now() - t0;
  console.log('');
  log('===== SUMMARY =====');
  log(`Files processed       : ${files.length}`);
  log(`Brands touched        : ${allStats.size}`);
  let insTotal = 0;
  let updTotal = 0;
  let skTotal = allSkipped.length;
  for (const stats of [...allStats.values()].sort((a, b) => a.brandKey.localeCompare(b.brandKey))) {
    insTotal += stats.inserted;
    updTotal += stats.updated;
    log('-----------------');
    log(`brand ${stats.brandDisplay} (${stats.brandKey})`);
    log(`  total in CSV        : ${stats.total}`);
    log(`  inserted            : ${stats.inserted}`);
    log(`  updated             : ${stats.updated}`);
    log(`  skipped in this brand: ${stats.skipped}`);
    log(`  per category        : ${Object.entries(stats.byCategory).map(([k, v]) => `${k}=${v}`).join(', ')}`);
    if (stats.unknownCategories.size > 0) {
      log(`  unknown categories  : ${[...stats.unknownCategories].join(', ')}`);
    }
  }
  log('-----------------');
  log(`Inserted total        : ${insTotal}`);
  log(`Updated total         : ${updTotal}`);
  log(`Skipped total         : ${skTotal}`);
  log(`Elapsed               : ${ms} ms`);
  if (flags.dryRun) log('DRY RUN - no DB writes performed.');

  if (skTotal > 0) {
    log('');
    log('Skipped rows (first 40):');
    for (const s of allSkipped.slice(0, 40)) {
      log(`  brand=${s.brand} line ${s.line}: ${s.displayName} (id="${s.gameUid}") - ${s.reason}`);
    }
    if (allSkipped.length > 40) log(`  ... and ${allSkipped.length - 40} more`);
  }

  log(`Provider status unchanged: ${provider.status}`);
}

main()
  .catch((err) => { console.error('[import-provider-games] FAILED', err); process.exit(1); })
  .finally(async () => { await db.$disconnect(); });
