// Built by Anointed Coder.
//
// M2F hotfix: idempotent seed for the canonical Daily 4D draw.
//
// Used by the /admin/lotto empty-state CTA to create a fresh draw
// in one click without forcing the operator to fill the New Draw
// form. Calling it when an active Daily 4D already exists is safe -
// the engine returns the existing row with created=false.

export const dynamic = 'force-dynamic';

import { withAuth, ensurePermission, recordActivity } from '@/lib/auth/guard';
import { jsonError, jsonOk } from '@/lib/auth/errors';
import { ensureDefaultDailyDraw, DEFAULT_DAILY_DRAW } from '@/lib/lotto/tickets';

export async function POST() {
  return withAuth(async () => {
    const session = await ensurePermission('lotto.write');
    try {
      const result = await ensureDefaultDailyDraw();
      if (result.created) {
        await recordActivity({
          actorId: session.sub,
          actorRole: session.role,
          action: 'LOTTO_DEFAULT_SEEDED',
          target: result.draw.id,
          detail: `${DEFAULT_DAILY_DRAW.name} @ ${result.draw.drawsAt?.toISOString() ?? 'no schedule'}`,
        });
      }
      return jsonOk({
        ok: true,
        created: result.created,
        draw: result.draw,
        message: result.created
          ? `Created the default ${DEFAULT_DAILY_DRAW.name} draw for ${result.draw.drawsAt?.toISOString() ?? 'tomorrow 19:30'}.`
          : `An active ${DEFAULT_DAILY_DRAW.name} draw already exists. Nothing to do.`,
      }, result.created ? 201 : 200);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[lotto-seed-default] failed', err);
      return jsonError(500, 'SEED_FAILED', msg);
    }
  });
}
