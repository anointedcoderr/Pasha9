// Built by Anointed Coder.
//
// M2F dry-run for the admin Lotto Settlement modal. POST a winning
// number and (optionally) multiplier overrides, get back the per-tier
// breakdown the engine WOULD produce against the current ticket pool
// for this draw. Nothing is written. Useful to verify a winning
// number before pulling the trigger on real wallet credits.

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAuth, ensurePermission } from '@/lib/auth/guard';
import { jsonError, jsonOk } from '@/lib/auth/errors';
import { diagnoseSettlement } from '@/lib/lotto/tickets';

const schema = z.object({
  winningNumber: z.string().regex(/^\d{4}$/, 'Must be 4 digits'),
  ticketBaseValue: z.coerce.number().min(0).max(100000).optional(),
  prize1xMult: z.coerce.number().min(0).max(100000).optional(),
  prize2xMult: z.coerce.number().min(0).max(100000).optional(),
  prize3xMult: z.coerce.number().min(0).max(100000).optional(),
  prizeSpecialMult: z.coerce.number().min(0).max(100000).optional(),
  prizeConsoMult: z.coerce.number().min(0).max(100000).optional(),
});

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  return withAuth(async () => {
    await ensurePermission('lotto.write');
    const body = await req.json().catch(() => ({}));
    const parsed = schema.safeParse(body);
    if (!parsed.success) return jsonError(400, 'VALIDATION', undefined, { issues: parsed.error.issues });

    try {
      const result = await diagnoseSettlement(params.id, parsed.data.winningNumber, {
        baseValue: parsed.data.ticketBaseValue,
        firstMult: parsed.data.prize1xMult,
        secondMult: parsed.data.prize2xMult,
        thirdMult: parsed.data.prize3xMult,
        specialMult: parsed.data.prizeSpecialMult,
        consoMult: parsed.data.prizeConsoMult,
      });
      return jsonOk(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Diagnose failed';
      console.error('[lotto-diagnose] failed', err);
      return jsonError(400, 'DIAGNOSE_FAILED', message);
    }
  });
}
