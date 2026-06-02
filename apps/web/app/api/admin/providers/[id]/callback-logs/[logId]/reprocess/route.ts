// Built by Anointed Coder.
//
// POST /api/admin/providers/[id]/callback-logs/[logId]/reprocess
// Body: { reason: string }
//
// Super-admin replay of a previously-rejected ProviderCallbackLog
// row through the CURRENT adapter parseCallback + wallet pipeline.
// Use case: when the parser was upgraded after old callbacks
// rejected, the saved encrypted payload can now be decrypted and
// the wallet credited.
//
// Idempotency comes from processProviderCallback: the new attempt
// computes its own (providerKey, gameRound, type) key. If the same
// callback was already replayed once, the second attempt short-
// circuits as duplicate. The original log row is left untouched;
// a new ProviderCallbackLog is written with the replay outcome.

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { withAuth, recordActivity } from '@/lib/auth/guard';
import { requireSuperAdmin } from '@/lib/auth/rbac';
import { jsonError, jsonOk } from '@/lib/auth/errors';
import { db } from '@/lib/db/client';
import { loadProviderCredsById } from '@/lib/providers/credentials';
import { getAdapter } from '@/lib/providers/registry';
import { processProviderCallback } from '@/lib/providers/wallet';
import { maskPayload } from '@/lib/providers/mask';
import { ProviderAdapterError } from '@/lib/providers/types';

const schema = z.object({ reason: z.string().trim().min(3).max(500) });

export async function POST(req: NextRequest, { params }: { params: { id: string; logId: string } }) {
  return withAuth(async () => {
    const claims = await requireSuperAdmin();

    const body = await req.json().catch(() => ({}));
    const parsed = schema.safeParse(body);
    if (!parsed.success) return jsonError(400, 'VALIDATION', undefined, { issues: parsed.error.issues });

    const provider = await db.gameProvider.findUnique({ where: { id: params.id }, select: { id: true, name: true, providerKey: true } });
    if (!provider) return jsonError(404, 'PROVIDER_NOT_FOUND');

    const log = await db.providerCallbackLog.findUnique({ where: { id: params.logId } });
    if (!log || log.providerId !== provider.id) return jsonError(404, 'LOG_NOT_FOUND');

    const creds = await loadProviderCredsById(params.id);
    if (!creds) return jsonError(404, 'CREDENTIALS_MISSING');
    const adapter = getAdapter(creds.adapterKey);
    if (!adapter) return jsonError(500, 'ADAPTER_NOT_REGISTERED');

    if (!log.body || typeof log.body !== 'object') {
      return jsonError(409, 'LOG_BODY_MISSING', 'Stored body is not a JSON object; cannot reprocess.');
    }

    try {
      const normalized = await adapter.parseCallback(creds, {}, log.body);
      const result = await processProviderCallback(creds, normalized);

      const envelope = adapter.buildCallbackResponse(creds, {
        newBalance: result.walletAfter,
        betAmount: normalized.betAmount,
        winAmount: normalized.winAmount,
        responseMode: creds.callbackResponseMode,
        ok: result.status === 'accepted' || result.status === 'duplicate',
        errorCode: result.errorCode,
      });

      // Write a new callback log entry for the replay so the audit
      // chain stays complete. The original row is untouched.
      await db.providerCallbackLog.create({
        data: {
          providerId: provider.id,
          ip: 'reprocess',
          method: 'POST',
          callbackKeyValid: true,
          ipValid: true,
          timestampValid: null,
          body: (maskPayload(log.body) ?? Prisma.JsonNull) as Prisma.InputJsonValue,
          response: {
            ...(envelope.body as Record<string, unknown>),
            _reprocess: {
              originalLogId: log.id,
              actorId: claims.sub,
              reason: parsed.data.reason,
              diagnostics: normalized.diagnostics ?? null,
              walletBefore: result.walletBefore,
              walletAfter: result.walletAfter,
              status: result.status,
              errorCode: result.errorCode ?? null,
            },
          } as Prisma.InputJsonValue,
          processedTxId: result.providerTxId,
          error: result.status === 'rejected' ? (result.errorCode ?? 'REJECTED') : null,
        },
      });

      await recordActivity({
        actorId: claims.sub,
        actorRole: claims.role,
        action: 'PROVIDER_CALLBACK_REPROCESS',
        target: log.id,
        meta: {
          providerKey: provider.providerKey ?? null,
          originalLogId: log.id,
          gameRound: normalized.gameRound,
          status: result.status,
          errorCode: result.errorCode ?? null,
          walletBefore: result.walletBefore,
          walletAfter: result.walletAfter,
          reason: parsed.data.reason,
        },
      });

      return jsonOk({
        result: {
          status: result.status,
          errorCode: result.errorCode ?? null,
          providerTxId: result.providerTxId,
          walletBefore: result.walletBefore,
          walletAfter: result.walletAfter,
        },
        diagnostics: normalized.diagnostics ?? null,
        envelope: envelope.body,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const code = err instanceof ProviderAdapterError ? err.code : 'REPROCESS_FAILED';
      return jsonError(err instanceof ProviderAdapterError ? err.status : 500, code, msg);
    }
  });
}
