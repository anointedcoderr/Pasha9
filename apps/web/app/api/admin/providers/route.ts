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
    const rows = await db.gameProvider.findMany({ orderBy: { name: 'asc' } });
    return jsonOk({
      adapters: listAdapters(),
      providers: rows.map(rowToView),
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
