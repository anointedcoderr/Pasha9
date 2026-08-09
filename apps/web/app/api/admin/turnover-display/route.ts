// Built by Anointed Coder.
//
// GET  /api/admin/turnover-display   current per-section visibility flags
// PUT  /api/admin/turnover-display   { section, enabled }
//
// Controls whether the wagering-requirement TEXT is shown to players in each
// bonus/reward section. Display only - see lib/turnover/display-flags.ts.
// Turning a flag off never changes the requirement itself or the withdrawal
// gate, and each change is recorded with the responsible staff member so a
// disclosure being hidden is traceable.

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAuth, ensurePermission, recordActivity } from '@/lib/auth/guard';
import { jsonError, jsonOk } from '@/lib/auth/errors';
import {
  TURNOVER_DISPLAY_KEYS,
  loadTurnoverDisplayFlags,
  setTurnoverDisplayFlag,
  type TurnoverDisplaySection,
} from '@/lib/turnover/display-flags';

const SECTIONS = Object.keys(TURNOVER_DISPLAY_KEYS) as [TurnoverDisplaySection, ...TurnoverDisplaySection[]];

const schema = z.object({
  section: z.enum(SECTIONS),
  enabled: z.boolean(),
});

export async function GET() {
  return withAuth(async () => {
    await ensurePermission('settings.read');
    return jsonOk({ flags: await loadTurnoverDisplayFlags() });
  });
}

export async function PUT(req: NextRequest) {
  return withAuth(async () => {
    const session = await ensurePermission('settings.write');

    const body = await req.json().catch(() => ({}));
    const parsed = schema.safeParse(body);
    if (!parsed.success) return jsonError(400, 'VALIDATION', undefined, { issues: parsed.error.issues });

    await setTurnoverDisplayFlag(parsed.data.section, parsed.data.enabled);

    // Hiding a condition players are bound by is worth an audit entry.
    await recordActivity({
      actorId: session.sub,
      actorRole: session.role,
      action: 'TURNOVER_DISPLAY_TOGGLE',
      target: parsed.data.section,
      detail: `${parsed.data.section} = ${parsed.data.enabled ? 'shown' : 'hidden'}`,
      meta: { section: parsed.data.section, enabled: parsed.data.enabled },
    });

    return jsonOk({ ok: true, flags: await loadTurnoverDisplayFlags() });
  });
}
