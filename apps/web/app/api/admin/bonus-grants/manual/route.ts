// Built by Anointed Coder.
//
// Admin manually grants a bonus to a specific user. Engine handles
// wallet credit + transaction log + turnover lock + immediate
// release when the picked rule has turnoverX = 0.

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAuth, ensurePermission, recordActivity } from '@/lib/auth/guard';
import { jsonError, jsonOk } from '@/lib/auth/errors';
import { manualGrant } from '@/lib/bonuses/engine';

const schema = z.object({
  userId: z.string().min(1),
  ruleId: z.string().min(1),
  amount: z.coerce.number().min(1).max(10_000_000),
  note: z.string().max(500).optional(),
});

export async function POST(req: NextRequest) {
  return withAuth(async () => {
    const session = await ensurePermission('bonuses.write');
    const body = await req.json().catch(() => ({}));
    const parsed = schema.safeParse(body);
    if (!parsed.success) return jsonError(400, 'VALIDATION', undefined, { issues: parsed.error.issues });

    try {
      const result = await manualGrant({
        userId: parsed.data.userId,
        ruleId: parsed.data.ruleId,
        amount: parsed.data.amount,
        note: parsed.data.note,
        actorId: session.sub,
      });

      if (!result) return jsonError(400, 'GRANT_FAILED');

      await recordActivity({
        actorId: session.sub,
        actorRole: session.role,
        action: 'BONUS_MANUAL_GRANT',
        target: result.grantId,
        meta: {
          userId: parsed.data.userId,
          ruleId: parsed.data.ruleId,
          amount: result.amount,
        },
      });

      return jsonOk({ grantId: result.grantId, amount: result.amount }, 201);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'GRANT_FAILED';
      const known = ['RULE_NOT_FOUND', 'RULE_INACTIVE', 'USER_NOT_FOUND', 'USER_BLOCKED', 'AMOUNT_INVALID'];
      if (known.includes(msg)) return jsonError(400, msg);
      console.error('manual grant failed', err);
      return jsonError(500, 'SERVER_ERROR');
    }
  });
}
