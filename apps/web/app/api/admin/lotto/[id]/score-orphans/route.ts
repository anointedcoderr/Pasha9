// Built by Anointed Coder.
//
// POST /api/admin/lotto/[id]/score-orphans
//
// Re-scores orphan tickets (drawId IS NULL OR drawId=this draw AND
// status='issued') against an already-settled draw's result. Recovery
// path for the "ticket matched but no credit" scenario where tickets
// were created before the draw existed (drawId=null) and the draw
// settled with 0 attached tickets. Idempotent: re-running after a
// successful pass finds nothing to do.

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { withAuth, ensurePermission, recordActivity } from '@/lib/auth/guard';
import { jsonError, jsonOk } from '@/lib/auth/errors';
import { scoreOrphanTicketsAgainstResult } from '@/lib/lotto/tickets';

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  return withAuth(async () => {
    const session = await ensurePermission('lotto.write');
    try {
      const out = await scoreOrphanTicketsAgainstResult({ drawId: params.id });
      await recordActivity({
        actorId: session.sub,
        actorRole: session.role,
        action: 'LOTTO_SCORE_ORPHANS',
        target: params.id,
        meta: {
          attached: out.attached,
          scored: out.scored,
          winners: out.winners,
          paid: out.paid,
        },
      });
      return jsonOk(out);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg === 'DRAW_NOT_SETTLED') {
        return jsonError(409, 'DRAW_NOT_SETTLED', 'This draw has not been settled yet. Score-orphans only runs after a draw has a published winning number.');
      }
      if (msg === 'LOTTO_ORPHANS_ALREADY_SCORED') {
        return jsonError(409, 'ORPHANS_ALREADY_SCORED', 'Another scoring pass already claimed these tickets (double click or a second admin). No double credit happened - refresh the draw list to see the result of the first run.');
      }
      console.error('[admin/lotto/score-orphans] failed', err);
      return jsonError(500, 'SCORE_FAILED', msg);
    }
  });
}
