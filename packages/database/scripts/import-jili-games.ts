/**
 * JILI catalog importer.
 *
 * Reads a CSV exported from the iGamingAPIs / SoftAPI provider
 * panel and upserts the rows into ExternalGame for the iGamingAPIs
 * provider, attached to the JILI brand. Idempotent: running it
 * twice does not duplicate rows; the second run reports inserted=0
 * and updated=N.
 *
 * CSV columns (header required):
 *   brandKey,gameUid,displayName,category,imageUrl
 *
 * Rules:
 *  - Rows with a non-numeric gameUid are skipped, not imported.
 *  - Category is normalized: slot/slots -> slots, casino/card/table
 *    -> table, fish/fishing -> fishing, flash -> flash, crash -> crash.
 *    Original value is preserved on rawMeta.
 *  - status defaults to 'active'.
 *  - Provider status is NOT changed.
 *
 * Run:
 *   pnpm --filter @pasha9/database import:jili
 *   pnpm --filter @pasha9/database import:jili ./path/to/catalog.csv
 *
 * Built by Anointed Coder.
 */

import { PrismaClient, Prisma } from '@prisma/client';
import * as fs from 'node:fs';
import * as path from 'node:path';

const db = new PrismaClient();
const log = (msg: string) => console.log(`[import-jili] ${msg}`);

const DEFAULT_CSV_PATH = path.resolve(__dirname, '..', 'seed-data', 'jili_games_import_ready.csv');
const PROVIDER_KEY = 'igamingapis';
const BRAND_KEY = 'JILI';
const BRAND_DISPLAY = 'JILI';

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

// -------- Local normalizers (kept in-sync with apps/web/lib/providers/category.ts) --------

const CATEGORY_MAP: Record<string, string> = {
  slot: 'slots', slots: 'slots',
  flash: 'flash', instant: 'flash',
  table: 'table', card: 'table', cards: 'table', casino: 'table', poker: 'table', baccarat: 'table', blackjack: 'table',
  fish: 'fishing', fishing: 'fishing',
  crash: 'crash',
};

function normalizeCategory(raw: string | null | undefined): string {
  const key = (raw ?? '').trim().toLowerCase();
  if (!key) return 'slots';
  if (CATEGORY_MAP[key]) return CATEGORY_MAP[key];
  const singular = key.endsWith('s') ? key.slice(0, -1) : key;
  if (CATEGORY_MAP[singular]) return CATEGORY_MAP[singular];
  return 'slots';
}

function isNumericGameUid(v: string | null | undefined): boolean {
  if (!v) return false;
  return /^\d+$/.test(String(v).trim());
}

// -------- Importer --------

interface SkippedRow { line: number; reason: string; displayName: string; gameUid: string }

async function main() {
  const argPath = process.argv[2];
  const csvPath = argPath ? path.resolve(process.cwd(), argPath) : DEFAULT_CSV_PATH;

  if (!fs.existsSync(csvPath)) {
    console.error(`[import-jili] CSV not found at ${csvPath}`);
    process.exit(1);
  }
  log(`reading ${csvPath}`);

  const text = fs.readFileSync(csvPath, 'utf8');
  const rows = parseCsv(text);
  log(`parsed ${rows.length} rows`);

  const provider = await db.gameProvider.findUnique({
    where: { providerKey: PROVIDER_KEY },
    select: { id: true, name: true, status: true, providerKey: true },
  });
  if (!provider) {
    console.error(`[import-jili] GameProvider with providerKey=${PROVIDER_KEY} not found. Create it from /admin/providers first.`);
    process.exit(1);
  }
  log(`provider ${provider.name} (id=${provider.id}, status=${provider.status})`);

  // Find or create the JILI brand. Status defaults to 'active' so
  // it shows up in admin without an extra click; the operator can
  // hide it later if needed.
  const brand = await db.providerBrand.upsert({
    where: { providerId_brandKey: { providerId: provider.id, brandKey: BRAND_KEY } },
    create: { providerId: provider.id, brandKey: BRAND_KEY, displayName: BRAND_DISPLAY, status: 'active' },
    update: {},
    select: { id: true, brandKey: true },
  });
  log(`brand ${brand.brandKey} (id=${brand.id})`);

  let inserted = 0;
  let updated = 0;
  const skipped: SkippedRow[] = [];
  const now = new Date();

  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    const lineNo = i + 2; // header line + 1-indexed body
    const gameUid = String(row.gameUid ?? row.game_uid ?? row['Game ID'] ?? '').trim();
    const displayName = String(row.displayName ?? row['Game Name'] ?? row.name ?? '').trim();
    const rowBrand = String(row.brandKey ?? row.Brand ?? '').trim();
    const category = String(row.category ?? row.Category ?? '').trim();
    const imageUrl = String(row.imageUrl ?? row['Image URL'] ?? '').trim();

    if (!isNumericGameUid(gameUid)) {
      skipped.push({ line: lineNo, reason: 'non-numeric gameUid', displayName: displayName || '-', gameUid: gameUid || '(empty)' });
      continue;
    }
    if (!displayName) {
      skipped.push({ line: lineNo, reason: 'missing displayName', displayName: '-', gameUid });
      continue;
    }
    // Defensive: this importer is JILI-only. Refuse to silently
    // accept rows aimed at a different brand if the CSV is mixed.
    if (rowBrand && rowBrand.toUpperCase() !== BRAND_KEY) {
      skipped.push({ line: lineNo, reason: `brandKey "${rowBrand}" is not ${BRAND_KEY}`, displayName, gameUid });
      continue;
    }

    const rawMeta: Prisma.InputJsonValue = {
      source: 'jili_games_import_ready.csv',
      originalRow: { brandKey: rowBrand, gameUid, displayName, category, imageUrl },
    };

    const existing = await db.externalGame.findUnique({
      where: { providerId_gameUid: { providerId: provider.id, gameUid } },
      select: { id: true },
    });

    if (existing) {
      await db.externalGame.update({
        where: { id: existing.id },
        data: {
          brandId: brand.id,
          displayName,
          category: normalizeCategory(category),
          imageUrl: imageUrl || null,
          rawMeta,
          lastSyncAt: now,
        },
      });
      updated += 1;
    } else {
      await db.externalGame.create({
        data: {
          providerId: provider.id,
          brandId: brand.id,
          gameUid,
          displayName,
          category: normalizeCategory(category),
          imageUrl: imageUrl || null,
          status: 'active',
          rawMeta,
          lastSyncAt: now,
        },
      });
      inserted += 1;
    }
  }

  await db.providerBrand.update({ where: { id: brand.id }, data: { lastSyncAt: now } });

  console.log('');
  log('=================================');
  log(`Total rows processed : ${rows.length}`);
  log(`Inserted             : ${inserted}`);
  log(`Updated              : ${updated}`);
  log(`Skipped              : ${skipped.length}`);
  log('=================================');
  if (skipped.length > 0) {
    log('Skipped rows:');
    for (const s of skipped) {
      log(`  line ${s.line}: ${s.displayName} (gameUid="${s.gameUid}") - ${s.reason}`);
    }
  }
  log(`Provider status unchanged: ${provider.status}`);
}

main()
  .catch((err) => { console.error('[import-jili] FAILED', err); process.exit(1); })
  .finally(async () => { await db.$disconnect(); });
