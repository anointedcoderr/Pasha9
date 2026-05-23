// Built by Anointed Coder.
//
// Admin settles a draw by publishing the winning 4-digit number.
// Tickets attached to that draw are evaluated (exact + iBox), each
// winning ticket gets a LotteryWinning row, and the user's
// Wallet.lottoBalance is incremented in the same transaction.

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAuth, ensurePermission, recordActivity } from '@/lib/auth/guard';
import { jsonOk, jsonError } from '@/lib/auth/errors';
import { settleDraw } from '@/lib/lotto/tickets';

const schema = z.object({
  winningNumber: z.string().regex(/^\d{4}$/, 'Must be 4 digits'),
  ticketBaseValue: z.coerce.number().min(1).max(100000).optional(),
  prize1xMult: z.coerce.number().min(1).max(100000).optional(),
  prize2xMult: z.coerce.number().min(1).max(100000).optional(),
  prize3xMult: z.coerce.number().min(1).max(100000).optional(),
  prizeSpecialMult: z.coerce.number().min(1).max(100000).optional(),
  prizeConsoMult: z.coerce.number().min(1).max(100000).optional(),
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
      });

      await recordActivity({
        actorId: session.sub,
        actorRole: session.role,
        action: 'LOTTO_SETTLE',
        target: params.id,
        meta: { winningNumber: parsed.data.winningNumber, ...result },
      });

      return jsonOk({ ok: true, ...result });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Settle failed';
      return jsonError(400, 'SETTLE_FAILED', message);
    }
  });
}
