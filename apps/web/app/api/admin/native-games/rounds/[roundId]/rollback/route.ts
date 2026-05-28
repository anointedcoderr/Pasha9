// Built by Anointed Coder.
//
// Super-admin only. Reverses one native game round:
//   - bet refunded to wallet
//   - win (if any) clawed back from wallet
//   - GameRound.outcome flipped to CANCELLED
//   - one `adjust` Transaction row for the net delta
//
// 409 if the round is already CANCELLED (idempotent guard).

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAuth, ensurePermission, recordActivity } from '@/lib/auth/guard';
import { requireSuperAdmin } from '@/lib/auth/rbac';
import { jsonError, jsonOk } from '@/lib/auth/errors';
import { rollbackRound, NATIVE_ERRORS } from '@/lib/native-games/service';

const schema = z.object({ note: z.string().trim().max(500).optional() });

export async function POST(req: NextRequest, { params }: { params: { roundId: string } }) {
  return withAuth(async () => {
    await requireSuperAdmin();
    await ensurePermission('users.balance.adjust');
    const claims = await requireSuperAdmin();

    const body = await req.json().catch(() => ({}));
    const parsed = schema.safeParse(body);
    if (!parsed.success) return jsonError(400, 'VALIDATION', undefined, { issues: parsed.error.issues });

    try {
      const result = await rollbackRound({
        roundId: params.roundId,
        actorId: claims.sub,
        note: parsed.data.note,
      });
      await recordActivity({
        actorId: claims.sub,
        actorRole: claims.role,
        action: 'NATIVE_ROUND_ROLLBACK',
        target: result.roundId,
        meta: {
          reversedBet: result.reversedBet,
          reversedWin: result.reversedWin,
          newBalance: result.newBalance,
          note: parsed.data.note ?? null,
        },
      });
      return jsonOk(result);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg === NATIVE_ERRORS.ROUND_NOT_FOUND) return jsonError(404, msg, 'Round not found.');
      if (msg === NATIVE_ERRORS.ROUND_ALREADY_CANCELLED) return jsonError(409, msg, 'Round has already been cancelled.');
      console.error('[native-games] rollback failed', err);
      return jsonError(500, 'SERVER_ERROR');
    }
  });
}
