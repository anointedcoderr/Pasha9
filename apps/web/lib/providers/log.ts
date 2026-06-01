// Built by Anointed Coder.
//
// Thin wrappers around ProviderRequestLog / ProviderCallbackLog
// inserts. Every request body is masked before storage.

import { Prisma } from '@prisma/client';
import { db } from '@/lib/db/client';
import { maskPayload } from './mask';

interface RequestLogInput {
  providerId: string;
  direction: 'outbound' | 'inbound';
  endpoint: string;
  method: string;
  status?: number;
  durationMs?: number;
  requestPayload?: unknown;
  responsePayload?: unknown;
  errorMessage?: string;
}

export async function logRequest(input: RequestLogInput): Promise<void> {
  try {
    await db.providerRequestLog.create({
      data: {
        providerId: input.providerId,
        direction: input.direction,
        endpoint: input.endpoint,
        method: input.method,
        status: input.status ?? null,
        durationMs: input.durationMs ?? null,
        requestPayload: input.requestPayload != null ? (maskPayload(input.requestPayload) as Prisma.InputJsonValue) : Prisma.JsonNull,
        responsePayload: input.responsePayload != null ? (maskPayload(input.responsePayload) as Prisma.InputJsonValue) : Prisma.JsonNull,
        errorMessage: input.errorMessage ?? null,
      },
    });
  } catch (err) {
    console.error('[providers] failed to write request log', err);
  }
}
