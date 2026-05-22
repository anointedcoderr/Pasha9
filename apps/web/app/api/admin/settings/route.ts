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

    const ops = parsed.data.updates.map((u) =>
      db.systemSetting.update({ where: { key: u.key }, data: { value: u.value } }),
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
