// Built by Anointed Coder.
//
// POST /api/admin/providers/[id]/simulate-callback/direct
//
// Fallback admin-only endpoint that exposes the same simulation
// pipeline as /simulate-callback. Useful for direct API testing
// (curl, integration tests) when the admin UI is unreliable, and
// for ops verification on a fresh DB before any games are imported.
//
// Identical body, identical response shape. Same permission gate
// (settings.write). Same audit row (PROVIDER_CALLBACK_SIMULATE
// with a `viaDirect` flag so the operator can distinguish UI runs
// from direct API runs).

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAuth, ensurePermission, recordActivity } from '@/lib/auth/guard';
import { getCurrentSession } from '@/lib/auth/rbac';
import { jsonError, jsonOk } from '@/lib/auth/errors';
import { runSimulation } from '@/lib/providers/simulate';

const schema = z.object({
  gameUid: z.string().trim().min(1).max(120),
  userQuery: z.string().trim().min(1).max(160).optional(),
  betAmount: z.coerce.number().nonnegative().max(1_000_000).default(0),
  winAmount: z.coerce.number().nonnegative().max(1_000_000).default(0),
  gameRound: z.string().trim().min(1).max(120).optional(),
});

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  return withAuth(async () => {
    await ensurePermission('settings.write');
    const claims = await getCurrentSession();
    if (!claims) return jsonError(401, 'UNAUTHENTICATED');

    const body = await req.json().catch(() => ({}));
    const parsed = schema.safeParse(body);
    if (!parsed.success) return jsonError(400, 'VALIDATION', undefined, { issues: parsed.error.issues });

    const outcome = await runSimulation({
      providerId: params.id,
      callerUserId: claims.sub,
      gameUid: parsed.data.gameUid,
      userQuery: parsed.data.userQuery,
      betAmount: parsed.data.betAmount,
      winAmount: parsed.data.winAmount,
      gameRound: parsed.data.gameRound,
    });

    if (!outcome.ok) {
      return jsonError(outcome.httpStatus, outcome.code, outcome.message, outcome.meta);
    }

    await recordActivity({
      actorId: claims.sub,
      actorRole: claims.role,
      action: 'PROVIDER_CALLBACK_SIMULATE',
      target: parsed.data.gameUid,
      meta: {
        providerId: params.id,
        viaDirect: true,
        status: outcome.payload.status,
        type: outcome.payload.type,
        errorCode: outcome.payload.errorCode ?? null,
        callbackLogId: outcome.payload.callbackLogId ?? null,
        providerTransactionId: outcome.payload.providerTransactionId ?? null,
        gameRound: outcome.payload.gameRound,
      },
    });

    return jsonOk(outcome.payload);
  });
}
