// Built by Anointed Coder.
//
// GET  /api/admin/atelier   read current values
// PUT  /api/admin/atelier   bulk upsert
//
// SystemSetting-backed asset URL map for the premium Spin and
// Lotto modules. Mirrors the site-sounds admin endpoint.

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db/client';
import { withAuth, ensurePermission, recordActivity } from '@/lib/auth/guard';
import { jsonError, jsonOk } from '@/lib/auth/errors';
import { ATELIER_SLOTS } from '@/lib/atelier/slots';

const optionalUrl = z.string().trim().max(600).optional().nullable().transform((v) => (v == null ? null : v));

const putSchema = z.object({
  assets: z.record(z.string(), optionalUrl).optional(),
});

export async function GET() {
  return withAuth(async () => {
    await ensurePermission('settings.write');
    const keys = ATELIER_SLOTS.map((s) => s.key);
    const rows = await db.systemSetting.findMany({ where: { key: { in: keys } } });
    const map: Record<string, string> = {};
    for (const r of rows) if (r.value) map[r.key] = r.value;
    return jsonOk({
      assets: Object.fromEntries(ATELIER_SLOTS.map((s) => [s.id, map[s.key] ?? ''])),
    });
  });
}

export async function PUT(req: NextRequest) {
  return withAuth(async () => {
    const session = await ensurePermission('settings.write');
    const body = await req.json().catch(() => ({}));
    const parsed = putSchema.safeParse(body);
    if (!parsed.success) return jsonError(400, 'VALIDATION', undefined, { issues: parsed.error.issues });
    const data = parsed.data;

    const writes: Array<{ key: string; value: string }> = [];
    if (data.assets) {
      for (const slot of ATELIER_SLOTS) {
        const v = data.assets[slot.id];
        if (v !== undefined) writes.push({ key: slot.key, value: v ?? '' });
      }
    }

    if (writes.length > 0) {
      await db.$transaction(
        writes.map((w) =>
          db.systemSetting.upsert({
            where: { key: w.key },
            create: { key: w.key, value: w.value },
            update: { value: w.value },
          }),
        ),
      );
    }

    await recordActivity({
      actorId: session.sub,
      actorRole: session.role,
      action: 'ATELIER_UPDATE',
      target: 'atelier',
      meta: { keys: writes.length },
    });

    return jsonOk({ ok: true });
  });
}
