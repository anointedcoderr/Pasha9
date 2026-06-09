// Built by Anointed Coder.
//
// GET  /api/admin/site-sounds  - read current values for the admin page
// PUT  /api/admin/site-sounds  - bulk upsert
//
// All slots live in SystemSetting so there is no schema mutation
// required to onboard new sound categories - just add an entry to
// SOUND_SLOTS in lib/sounds/slots.ts.

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db/client';
import { withAuth, ensurePermission, recordActivity } from '@/lib/auth/guard';
import { jsonError, jsonOk } from '@/lib/auth/errors';
import { SOUND_SLOTS, MASTER_ENABLED_KEY, DEFAULT_VOLUME_KEY } from '@/lib/sounds/slots';

const optionalUrl = z.string().trim().max(600).optional().nullable().transform((v) => (v == null ? null : v));

const putSchema = z.object({
  enabled: z.boolean().optional(),
  defaultVolume: z.number().int().min(0).max(100).optional(),
  sounds: z.record(z.string(), optionalUrl).optional(),
});

export async function GET() {
  return withAuth(async () => {
    await ensurePermission('settings.write');
    const keys = [MASTER_ENABLED_KEY, DEFAULT_VOLUME_KEY, ...SOUND_SLOTS.map((s) => s.key)];
    const rows = await db.systemSetting.findMany({ where: { key: { in: keys } } });
    const map: Record<string, string> = {};
    for (const r of rows) if (r.value) map[r.key] = r.value;
    return jsonOk({
      enabled: map[MASTER_ENABLED_KEY] !== '0',
      defaultVolume: Number(map[DEFAULT_VOLUME_KEY] ?? '70'),
      sounds: Object.fromEntries(SOUND_SLOTS.map((s) => [s.id, map[s.key] ?? ''])),
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
    if (data.enabled !== undefined) writes.push({ key: MASTER_ENABLED_KEY, value: data.enabled ? '1' : '0' });
    if (data.defaultVolume !== undefined) writes.push({ key: DEFAULT_VOLUME_KEY, value: String(data.defaultVolume) });
    if (data.sounds) {
      for (const slot of SOUND_SLOTS) {
        const v = data.sounds[slot.id];
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
      action: 'SITE_SOUNDS_UPDATE',
      target: 'site_sounds',
      meta: { keys: writes.length },
    });

    return jsonOk({ ok: true });
  });
}
