// Built by Anointed Coder.
//
// POST /api/admin/providers/[id]/manual-games
//
// Two modes detected by request shape:
//
//   single: { brandKey?, gameUid, displayName, category?, imageUrl?, status? }
//   bulk:   { brandKey?, format: 'csv' | 'json', data: string }
//
// Upserts on (providerId, gameUid). Manual rows let the operator
// surface JILI games sourced from the provider panel when the
// upstream games endpoint is gated. The provider is NOT auto-
// activated; status flag stays under operator control.

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { withAuth, ensurePermission, recordActivity } from '@/lib/auth/guard';
import { getCurrentSession } from '@/lib/auth/rbac';
import { jsonError, jsonOk } from '@/lib/auth/errors';
import { db } from '@/lib/db/client';
import { isNumericGameUid, normalizeCategory } from '@/lib/providers/category';

// ----- Schemas -----

const singleSchema = z.object({
  brandKey: z.string().trim().max(120).optional().or(z.literal('')),
  gameUid: z.string().trim().min(1).max(120),
  displayName: z.string().trim().min(1).max(200),
  category: z.string().trim().max(60).optional().or(z.literal('')),
  imageUrl: z.string().trim().max(500).optional().or(z.literal('')),
  status: z.enum(['active', 'maintenance', 'hidden']).default('active'),
});

const bulkSchema = z.object({
  brandKey: z.string().trim().max(120).optional().or(z.literal('')),
  format: z.enum(['csv', 'json']),
  data: z.string().trim().min(1).max(200_000),
});

interface GameInput {
  gameUid: string;
  displayName: string;
  category?: string;
  imageUrl?: string;
  status?: 'active' | 'maintenance' | 'hidden';
}

// ----- CSV parser (minimal, no dependency) -----

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

function normalizeStatus(raw: unknown): GameInput['status'] {
  const s = String(raw ?? '').trim().toLowerCase();
  if (s === 'maintenance' || s === 'hidden') return s;
  return 'active';
}

interface SkippedRow { line: number; reason: string; displayName: string; gameUid: string }

function rowToGame(row: Record<string, unknown>, idx: number): { ok: true; value: GameInput } | { ok: false; skip: SkippedRow } {
  const lineNo = idx + 2; // header line + 1-indexed body
  const gameUid = String(row.gameUid ?? row.game_uid ?? row['Game ID'] ?? row.id ?? '').trim();
  const displayName = String(row.displayName ?? row.display_name ?? row['Game Name'] ?? row.name ?? '').trim();
  if (!isNumericGameUid(gameUid)) {
    return { ok: false, skip: { line: lineNo, reason: 'non-numeric gameUid', displayName: displayName || '-', gameUid: gameUid || '(empty)' } };
  }
  if (!displayName) {
    return { ok: false, skip: { line: lineNo, reason: 'missing displayName', displayName: '-', gameUid } };
  }
  return {
    ok: true,
    value: {
      gameUid,
      displayName,
      category: row.category ? String(row.category).trim() : row.Category ? String(row.Category).trim() : undefined,
      imageUrl: row.imageUrl ? String(row.imageUrl).trim() : row.image_url ? String(row.image_url).trim() : row['Image URL'] ? String(row['Image URL']).trim() : undefined,
      status: normalizeStatus(row.status),
    },
  };
}

// ----- Handler -----

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  return withAuth(async () => {
    await ensurePermission('settings.write');
    const claims = await getCurrentSession();
    if (!claims) return jsonError(401, 'UNAUTHENTICATED');

    const provider = await db.gameProvider.findUnique({ where: { id: params.id }, select: { id: true } });
    if (!provider) return jsonError(404, 'NOT_FOUND');

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const isBulk = typeof body?.format === 'string' && typeof body?.data === 'string';

    // Resolve target brand. brandKey is optional; if supplied, must
    // resolve to an existing ProviderBrand row.
    const brandKeyRaw = typeof body?.brandKey === 'string' ? body.brandKey.trim() : '';
    let brandId: string | null = null;
    if (brandKeyRaw) {
      const brand = await db.providerBrand.findUnique({
        where: { providerId_brandKey: { providerId: provider.id, brandKey: brandKeyRaw } },
        select: { id: true },
      });
      if (!brand) return jsonError(400, 'BRAND_NOT_FOUND', `Brand "${brandKeyRaw}" is not synced for this provider. Add it on the Brands tab first.`);
      brandId = brand.id;
    }

    let inputs: GameInput[] = [];
    const skipped: SkippedRow[] = [];

    if (isBulk) {
      const parsed = bulkSchema.safeParse(body);
      if (!parsed.success) return jsonError(400, 'VALIDATION', undefined, { issues: parsed.error.issues });
      const raw = parsed.data.data;
      const rows: Array<Record<string, unknown>> = [];
      if (parsed.data.format === 'csv') {
        rows.push(...parseCsv(raw));
      } else {
        let json: unknown;
        try { json = JSON.parse(raw); } catch (err) {
          return jsonError(400, 'BULK_INVALID_JSON', err instanceof Error ? err.message : 'JSON parse failed');
        }
        if (!Array.isArray(json)) return jsonError(400, 'BULK_INVALID_JSON', 'Bulk JSON must be an array of objects.');
        rows.push(...(json as Array<Record<string, unknown>>));
      }
      rows.forEach((row, i) => {
        const r = rowToGame(row, i);
        if (r.ok) inputs.push(r.value);
        else skipped.push(r.skip);
      });
      if (inputs.length === 0) {
        const head = skipped.slice(0, 3).map((s) => `line ${s.line}: ${s.reason}`).join('; ');
        return jsonError(400, 'BULK_EMPTY', `Parsed 0 valid rows. ${head}`);
      }
    } else {
      const parsed = singleSchema.safeParse(body);
      if (!parsed.success) return jsonError(400, 'VALIDATION', undefined, { issues: parsed.error.issues });
      if (!isNumericGameUid(parsed.data.gameUid)) {
        return jsonError(400, 'VALIDATION', `gameUid must be numeric (got "${parsed.data.gameUid}").`);
      }
      inputs = [{
        gameUid: parsed.data.gameUid,
        displayName: parsed.data.displayName,
        category: parsed.data.category || undefined,
        imageUrl: parsed.data.imageUrl || undefined,
        status: parsed.data.status,
      }];
    }

    let inserted = 0;
    let updated = 0;
    const now = new Date();
    for (const g of inputs) {
      const existing = await db.externalGame.findUnique({
        where: { providerId_gameUid: { providerId: provider.id, gameUid: g.gameUid } },
        select: { id: true },
      });
      const meta: Prisma.InputJsonValue = { source: 'manual', importedAt: now.toISOString() };
      if (existing) {
        await db.externalGame.update({
          where: { id: existing.id },
          data: {
            displayName: g.displayName,
            category: normalizeCategory(g.category),
            imageUrl: g.imageUrl ?? null,
            status: g.status ?? 'active',
            brandId: brandId ?? undefined, // null brandId means "do not overwrite"
            rawMeta: meta,
            lastSyncAt: now,
          },
        });
        updated += 1;
      } else {
        await db.externalGame.create({
          data: {
            providerId: provider.id,
            brandId,
            gameUid: g.gameUid,
            displayName: g.displayName,
            category: normalizeCategory(g.category),
            imageUrl: g.imageUrl ?? null,
            status: g.status ?? 'active',
            rawMeta: meta,
            lastSyncAt: now,
          },
        });
        inserted += 1;
      }
    }

    await recordActivity({
      actorId: claims.sub,
      actorRole: claims.role,
      action: 'PROVIDER_GAME_MANUAL',
      target: provider.id,
      meta: { brandKey: brandKeyRaw || null, count: inputs.length, inserted, updated, skipped: skipped.length, mode: isBulk ? 'bulk' : 'single' },
    });

    return jsonOk({
      mode: isBulk ? 'bulk' : 'single',
      count: inputs.length,
      inserted,
      updated,
      skipped: skipped.length,
      skippedRows: skipped.slice(0, 20).map((s) => `line ${s.line}: ${s.displayName} (gameUid="${s.gameUid}") - ${s.reason}`),
    }, isBulk ? 200 : (inserted > 0 ? 201 : 200));
  });
}
