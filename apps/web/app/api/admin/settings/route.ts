// Built by Anointed Coder.

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db/client';
import { withAuth, ensurePermission, recordActivity } from '@/lib/auth/guard';
import { jsonError, jsonOk } from '@/lib/auth/errors';

export async function GET() {
  return withAuth(async () => {
    await ensurePermission('settings.write');
    const settings = await db.systemSetting.findMany({ orderBy: { key: 'asc' } });
    return jsonOk({ settings });
  });
}

const patchSchema = z.object({
  updates: z.array(
    z.object({
      key: z.string().min(1).max(80),
      value: z.string().max(4000),
    }),
  ).min(1).max(100),
});

export async function PATCH(req: NextRequest) {
  return withAuth(async () => {
    const session = await ensurePermission('settings.write');
    const body = await req.json().catch(() => ({}));
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) return jsonError(400, 'VALIDATION', undefined, { issues: parsed.error.issues });

    // Upsert (not update) so admin-driven keys like logo_url that the
    // initial seed may not have created can be set from the UI on day
    // one without a re-seed.
    const ops = parsed.data.updates.map((u) =>
      db.systemSetting.upsert({
        where: { key: u.key },
        update: { value: u.value },
        create: { key: u.key, value: u.value },
      }),
    );
    await db.$transaction(ops);
    await recordActivity({
      actorId: session.sub,
      actorRole: session.role,
      action: 'SETTINGS_UPDATE',
      target: 'systemSetting',
      detail: parsed.data.updates.map((u) => u.key).join(','),
    });
    return jsonOk({ updated: parsed.data.updates.length });
  });
}
