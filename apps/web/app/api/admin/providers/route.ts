// Built by Anointed Coder.
//
// Admin external-provider management. GET lists providers with
// status; POST creates a new provider row. Secrets are encrypted on
// write and never echoed back; the response carries masked previews.

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { withAuth, ensurePermission, recordActivity } from '@/lib/auth/guard';
import { getCurrentSession } from '@/lib/auth/rbac';
import { jsonError, jsonOk } from '@/lib/auth/errors';
import { db } from '@/lib/db/client';
import { buildCredentialUpdate, maskSecret } from '@/lib/providers/credentials';
import { decryptString } from '@/lib/crypto/aead';
import { listAdapters } from '@/lib/providers/registry';

function previewSecret(blob: string | null | undefined): { set: boolean; preview: string } {
  if (!blob) return { set: false, preview: '' };
  try {
    return maskSecret(decryptString(blob));
  } catch {
    return { set: true, preview: '••••' };
  }
}

function rowToView(row: {
  id: string;
  name: string;
  providerKey: string | null;
  adapterKey: string | null;
  apiBase: string | null;
  apiKey: string | null;
  apiSecret: string | null;
  callbackSecret: string | null;
  callbackPath: string | null;
  ipWhitelist: string | null;
  clockSkewSeconds: number;
  currencyCode: string | null;
  language: string | null;
  callbackResponseMode: string | null;
  launchMode: string | null;
  launchTimestampOffsetMs: number;
  publicBaseUrl: string | null;
  launchMinBalance: Prisma.Decimal | number;
  secretEncoding: string | null;
  status: 'active' | 'maintenance';
  lastSyncAt: Date | null;
  lastHealthCheckAt: Date | null;
  lastHealthCheckOk: boolean | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: row.id,
    name: row.name,
    providerKey: row.providerKey,
    adapterKey: row.adapterKey,
    apiBase: row.apiBase,
    apiKey: previewSecret(row.apiKey),
    apiSecret: previewSecret(row.apiSecret),
    callbackSecret: previewSecret(row.callbackSecret),
    callbackPath: row.callbackPath,
    ipWhitelist: row.ipWhitelist,
    clockSkewSeconds: row.clockSkewSeconds,
    currencyCode: row.currencyCode,
    language: row.language,
    callbackResponseMode: row.callbackResponseMode,
    launchMode: row.launchMode,
    launchTimestampOffsetMs: row.launchTimestampOffsetMs,
    publicBaseUrl: row.publicBaseUrl,
    launchMinBalance: Number(row.launchMinBalance ?? 0),
    secretEncoding: row.secretEncoding,
    status: row.status,
    lastSyncAt: row.lastSyncAt,
    lastHealthCheckAt: row.lastHealthCheckAt,
    lastHealthCheckOk: row.lastHealthCheckOk,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function GET() {
  return withAuth(async () => {
    await ensurePermission('settings.write');
    // Providers are aggregated against children (brands + games) in
    // the joins below, so this list must be the full set. Take is
    // capped at 200 as a hard ceiling - the realistic operator
    // count is well under 50.
    const rows = await db.gameProvider.findMany({ orderBy: { name: 'asc' }, take: 200 });

    // Brand + game summaries so the overview card can show
    // "10 brands, 1228 games (1183 active)" plus the brand-name pill
    // strip without each card making N more requests on mount. Cheap
    // group-by; aggregated server-side.
    const providerIds = rows.map((r) => r.id);
    const [brandRows, gameStatusRows, brandGameCountRows] = await Promise.all([
      providerIds.length === 0 ? Promise.resolve([]) : db.providerBrand.findMany({
        where: { providerId: { in: providerIds } },
        select: { id: true, providerId: true, brandKey: true, displayName: true, status: true },
        orderBy: [{ displayName: 'asc' }],
      }),
      providerIds.length === 0 ? Promise.resolve([]) : db.externalGame.groupBy({
        by: ['providerId', 'status'],
        where: { providerId: { in: providerIds } },
        _count: { _all: true },
      }),
      providerIds.length === 0 ? Promise.resolve([]) : db.externalGame.groupBy({
        by: ['providerId', 'brandId'],
        where: { providerId: { in: providerIds } },
        _count: { _all: true },
      }),
    ]);

    type BrandRow = { id: string; providerId: string; brandKey: string; displayName: string; status: string };
    const brandsByProvider = new Map<string, BrandRow[]>();
    for (const b of brandRows as BrandRow[]) {
      const arr = brandsByProvider.get(b.providerId) ?? [];
      arr.push(b);
      brandsByProvider.set(b.providerId, arr);
    }

    const gamesByProvider = new Map<string, { total: number; active: number }>();
    for (const r of gameStatusRows as Array<{ providerId: string; status: string; _count: { _all: number } }>) {
      const prev = gamesByProvider.get(r.providerId) ?? { total: 0, active: 0 };
      prev.total += r._count._all;
      if (r.status === 'active') prev.active += r._count._all;
      gamesByProvider.set(r.providerId, prev);
    }

    const brandGameCounts = new Map<string, number>();
    for (const r of brandGameCountRows as Array<{ providerId: string; brandId: string | null; _count: { _all: number } }>) {
      if (!r.brandId) continue;
      brandGameCounts.set(`${r.providerId}:${r.brandId}`, r._count._all);
    }

    const summaries = rows.map((r) => {
      const brandList = brandsByProvider.get(r.id) ?? [];
      const games = gamesByProvider.get(r.id) ?? { total: 0, active: 0 };
      const brands = brandList.map((b) => ({
        id: b.id,
        brandKey: b.brandKey,
        displayName: b.displayName,
        status: b.status,
        gameCount: brandGameCounts.get(`${r.id}:${b.id}`) ?? 0,
      })).sort((a, b) => b.gameCount - a.gameCount || a.displayName.localeCompare(b.displayName));
      return {
        providerId: r.id,
        brandCount: brands.length,
        activeBrandCount: brands.filter((b) => b.status === 'active').length,
        totalGames: games.total,
        activeGames: games.active,
        brands,
      };
    });

    return jsonOk({
      adapters: listAdapters(),
      providers: rows.map(rowToView),
      summaries,
    });
  });
}

const createSchema = z.object({
  name: z.string().trim().min(2).max(60),
  providerKey: z.string().trim().toLowerCase().regex(/^[a-z0-9-]+$/, 'Lowercase letters, digits and hyphen only.').min(2).max(40),
  adapterKey: z.string().trim().min(2).max(40),
  apiBase: z.string().trim().url().max(400),
  apiKey: z.string().trim().min(1).max(2000),
  apiSecret: z.string().trim().min(1).max(2000),
  secretEncoding: z.enum(['utf8', 'hex', 'base64']).default('utf8'),
  callbackPath: z.string().trim().optional(),
  callbackSecret: z.string().trim().min(8).max(200),
  ipWhitelist: z.string().trim().optional().or(z.literal('')),
  clockSkewSeconds: z.coerce.number().int().min(0).max(3600).default(30),
  currencyCode: z.string().trim().toUpperCase().min(2).max(8).default('BDT'),
  language: z.string().trim().toLowerCase().min(2).max(8).default('bn'),
  callbackResponseMode: z.enum(['updated_balance', 'net_loss_amount']).default('updated_balance'),
  launchMode: z.enum(['redirect', 'iframe']).default('redirect'),
  launchTimestampOffsetMs: z.coerce.number().int().min(-86_400_000).max(86_400_000).default(0),
  publicBaseUrl: z.string().trim().url().max(400).optional().or(z.literal('')),
  launchMinBalance: z.coerce.number().min(0).max(1_000_000).default(0),
});

export async function POST(req: NextRequest) {
  return withAuth(async () => {
    await ensurePermission('settings.write');
    const claims = await getCurrentSession();
    if (!claims) return jsonError(401, 'UNAUTHENTICATED');

    const body = await req.json().catch(() => ({}));
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) return jsonError(400, 'VALIDATION', undefined, { issues: parsed.error.issues });

    const exists = await db.gameProvider.findFirst({
      where: { OR: [{ name: parsed.data.name }, { providerKey: parsed.data.providerKey }] },
      select: { id: true },
    });
    if (exists) return jsonError(409, 'PROVIDER_EXISTS', 'A provider with that name or key already exists.');

    const encrypted = buildCredentialUpdate({
      apiKey: parsed.data.apiKey,
      apiSecret: parsed.data.apiSecret,
      callbackSecret: parsed.data.callbackSecret,
    });

    const callbackPath = parsed.data.callbackPath?.trim() || `/api/providers/${parsed.data.providerKey}/callback`;

    const row = await db.gameProvider.create({
      data: {
        ...(encrypted as Prisma.GameProviderUncheckedCreateInput),
        name: parsed.data.name,
        providerKey: parsed.data.providerKey,
        adapterKey: parsed.data.adapterKey,
        apiBase: parsed.data.apiBase,
        secretEncoding: parsed.data.secretEncoding,
        callbackPath,
        ipWhitelist: parsed.data.ipWhitelist || null,
        clockSkewSeconds: parsed.data.clockSkewSeconds,
        currencyCode: parsed.data.currencyCode,
        language: parsed.data.language,
        callbackResponseMode: parsed.data.callbackResponseMode,
        launchMode: parsed.data.launchMode,
        launchTimestampOffsetMs: parsed.data.launchTimestampOffsetMs,
        publicBaseUrl: parsed.data.publicBaseUrl || null,
        launchMinBalance: parsed.data.launchMinBalance,
        status: 'maintenance', // operator must activate after Test connection + Sync
      },
    });

    await recordActivity({
      actorId: claims.sub,
      actorRole: claims.role,
      action: 'PROVIDER_CREATE',
      target: row.id,
      meta: { providerKey: row.providerKey, adapterKey: row.adapterKey, name: row.name },
    });

    return jsonOk({ provider: rowToView(row) }, 201);
  });
}
