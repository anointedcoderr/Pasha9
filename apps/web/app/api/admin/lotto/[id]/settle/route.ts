// Built by Anointed Coder.
//
// Admin settles a draw by publishing the winning 4-digit number.
// M2F: settlement now evaluates 6 tiers (1st exact / 1st iBox /
// special / 2nd / 3rd / consolation) with no-double-pay precedence.
// Each ticket gets at most one LotteryWinning row at the highest
// tier it qualifies for.
//
// Response carries a per-tier `breakdown` array so the admin UI can
// render the same shape the diagnose modal produces. The settle
// itself is wrapped in the existing transaction inside lib/lotto/
// tickets.ts - failure returns SETTLE_FAILED + the engine error
// (e.g. DRAW_ALREADY_SETTLED).

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAuth, ensurePermission, recordActivity } from '@/lib/auth/guard';
import { jsonOk, jsonError } from '@/lib/auth/errors';
import { settleDraw } from '@/lib/lotto/tickets';

const fourDigit = z.string().regex(/^\d{4}$/);

const schema = z.object({
  winningNumber: z.string().regex(/^\d{4}$/, 'Must be 4 digits'),
  ticketBaseValue: z.coerce.number().min(1).max(100000).optional(),
  prize1xMult: z.coerce.number().min(1).max(100000).optional(),
  prize2xMult: z.coerce.number().min(1).max(100000).optional(),
  prize3xMult: z.coerce.number().min(1).max(100000).optional(),
  prizeSpecialMult: z.coerce.number().min(1).max(100000).optional(),
  prizeConsoMult: z.coerce.number().min(1).max(100000).optional(),
  // M4 Phase F additive payload. extraNumbers carries the Babu88-
  // style display blob (separate prize numbers per tier). claimMode
  // optionally overrides the SystemSetting `lotto_claim_mode`.
  extraNumbers: z
    .object({
      second: fourDigit.nullable().optional(),
      third: fourDigit.nullable().optional(),
      specials: z.array(fourDigit).max(20).optional(),
      consolations: z.array(fourDigit).max(20).optional(),
    })
    .nullable()
    .optional(),
  claimMode: z.enum(['auto', 'manual']).optional(),
});

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  return withAuth(async () => {
    const session = await ensurePermission('lotto.write');
    const body = await req.json().catch(() => ({}));
    const parsed = schema.safeParse(body);
    if (!parsed.success) return jsonError(400, 'VALIDATION', undefined, { issues: parsed.error.issues });

    try {
      const result = await settleDraw({
        drawId: params.id,
        winningNumber: parsed.data.winningNumber,
        publishedById: session.sub,
        ticketBaseValue: parsed.data.ticketBaseValue,
        prize1xMult: parsed.data.prize1xMult,
        prize2xMult: parsed.data.prize2xMult,
        prize3xMult: parsed.data.prize3xMult,
        prizeSpecialMult: parsed.data.prizeSpecialMult,
        prizeConsoMult: parsed.data.prizeConsoMult,
        extraNumbers: parsed.data.extraNumbers ?? null,
        claimMode: parsed.data.claimMode,
      });

      await recordActivity({
        actorId: session.sub,
        actorRole: session.role,
        action: 'LOTTO_SETTLE',
        target: params.id,
        meta: { winningNumber: parsed.data.winningNumber, ...result },
      });

      // Surface a clear warning when the settle landed but no ticket
      // matched - the operator needs to know this happened so they
      // can investigate (wrong drawId, ticket attached to a
      // different draw, drawid=null orphans) before assuming the
      // engine is broken. Without this flag the admin UI shows
      // "settled" with no indication that 0 BDT went out.
      const warning = result.totalWinners === 0
        ? 'Settled successfully but ZERO tickets matched. If you expected winners, the tickets are probably attached to a different draw or are still orphaned. Click "Score orphans" on this draw card to score any drawId=null tickets against this result.'
        : null;

      return jsonOk({ ok: true, ...result, warning });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Settle failed';
      if (message === 'DRAW_ALREADY_SETTLED') {
        return jsonError(409, 'DRAW_ALREADY_SETTLED', 'This draw has already been settled. Re-running settle is not allowed.');
      }
      if (message === 'WINNING_NUMBER_INVALID') {
        return jsonError(400, 'WINNING_NUMBER_INVALID', 'Winning number must be exactly 4 digits.');
      }
      return jsonError(400, 'SETTLE_FAILED', message);
    }
  });
}
