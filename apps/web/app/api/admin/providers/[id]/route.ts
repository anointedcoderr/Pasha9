// Built by Anointed Coder.
//
// PATCH /api/admin/providers/[id]
// Edit a single provider. Secret fields ONLY update when the admin
// passes a non-empty value; otherwise the existing AEAD blob stays.

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

const patchSchema = z.object({
  name: z.string().trim().min(2).max(60).optional(),
  apiBase: z.string().trim().url().max(400).optional(),
  // Secrets: empty/undefined means "leave unchanged"; a non-empty
  // value re-encrypts and replaces the stored blob.
  apiKey: z.string().trim().min(1).max(2000).optional(),
  apiSecret: z.string().trim().min(1).max(2000).optional(),
  callbackSecret: z.string().trim().min(8).max(200).optional(),
  secretEncoding: z.enum(['utf8', 'hex', 'base64']).optional(),
  callbackPath: z.string().trim().optional(),
  ipWhitelist: z.string().trim().optional().or(z.literal('')),
  clockSkewSeconds: z.coerce.number().int().min(0).max(3600).optional(),
  currencyCode: z.string().trim().toUpperCase().min(2).max(8).optional(),
  language: z.string().trim().toLowerCase().min(2).max(8).optional(),
  callbackResponseMode: z.enum(['updated_balance', 'net_loss_amount']).optional(),
  launchMode: z.enum(['redirect', 'iframe']).optional(),
  status: z.enum(['active', 'maintenance']).optional(),
});

function previewSecret(blob: string | null | undefined): { set: boolean; preview: string } {
  if (!blob) return { set: false, preview: '' };
  try { return maskSecret(decryptString(blob)); } catch { return { set: true, preview: '••••' }; }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  return withAuth(async () => {
    await ensurePermission('settings.write');
    const claims = await getCurrentSession();
    if (!claims) return jsonError(401, 'UNAUTHENTICATED');

    const before = await db.gameProvider.findUnique({ where: { id: params.id } });
    if (!before) return jsonError(404, 'NOT_FOUND');

    const body = await req.json().catch(() => ({}));
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) return jsonError(400, 'VALIDATION', undefined, { issues: parsed.error.issues });

    const enc = buildCredentialUpdate({
      apiKey: parsed.data.apiKey,
      apiSecret: parsed.data.apiSecret,
      callbackSecret: parsed.data.callbackSecret,
    });

    const data: Prisma.GameProviderUncheckedUpdateInput = {
      ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
      ...(parsed.data.apiBase !== undefined ? { apiBase: parsed.data.apiBase } : {}),
      ...(parsed.data.secretEncoding !== undefined ? { secretEncoding: parsed.data.secretEncoding } : {}),
      ...(parsed.data.callbackPath !== undefined ? { callbackPath: parsed.data.callbackPath || null } : {}),
      ...(parsed.data.ipWhitelist !== undefined ? { ipWhitelist: parsed.data.ipWhitelist || null } : {}),
      ...(parsed.data.clockSkewSeconds !== undefined ? { clockSkewSeconds: parsed.data.clockSkewSeconds } : {}),
      ...(parsed.data.currencyCode !== undefined ? { currencyCode: parsed.data.currencyCode } : {}),
      ...(parsed.data.language !== undefined ? { language: parsed.data.language } : {}),
      ...(parsed.data.callbackResponseMode !== undefined ? { callbackResponseMode: parsed.data.callbackResponseMode } : {}),
      ...(parsed.data.launchMode !== undefined ? { launchMode: parsed.data.launchMode } : {}),
      ...(parsed.data.status !== undefined ? { status: parsed.data.status } : {}),
      ...enc,
    };

    const updated = await db.gameProvider.update({ where: { id: params.id }, data });

    await recordActivity({
      actorId: claims.sub,
      actorRole: claims.role,
      action: 'PROVIDER_UPDATE',
      target: updated.id,
      meta: {
        // Mask which secrets were touched without logging values
        secretsChanged: {
          apiKey: parsed.data.apiKey !== undefined,
          apiSecret: parsed.data.apiSecret !== undefined,
          callbackSecret: parsed.data.callbackSecret !== undefined,
        },
        statusChange: parsed.data.status !== undefined ? { from: before.status, to: parsed.data.status } : null,
        fieldChanges: Object.keys(parsed.data).filter((k) => !['apiKey', 'apiSecret', 'callbackSecret'].includes(k)),
      },
    });

    return jsonOk({
      provider: {
        id: updated.id,
        name: updated.name,
        providerKey: updated.providerKey,
        adapterKey: updated.adapterKey,
        apiBase: updated.apiBase,
        apiKey: previewSecret(updated.apiKey),
        apiSecret: previewSecret(updated.apiSecret),
        callbackSecret: previewSecret(updated.callbackSecret),
        secretEncoding: updated.secretEncoding,
        callbackPath: updated.callbackPath,
        ipWhitelist: updated.ipWhitelist,
        clockSkewSeconds: updated.clockSkewSeconds,
        currencyCode: updated.currencyCode,
        language: updated.language,
        callbackResponseMode: updated.callbackResponseMode,
        launchMode: updated.launchMode,
        status: updated.status,
        lastSyncAt: updated.lastSyncAt,
        lastHealthCheckAt: updated.lastHealthCheckAt,
        lastHealthCheckOk: updated.lastHealthCheckOk,
      },
    });
  });
}
