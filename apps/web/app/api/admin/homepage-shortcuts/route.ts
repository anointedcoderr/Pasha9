// Built by Anointed Coder.
//
// GET /api/admin/homepage-shortcuts        read current overrides
// PUT /api/admin/homepage-shortcuts        bulk upsert
//   body: { icons: { [key]: string | null } }
//
// Each homepage shortcut (Jackpot, Hot, Slot, Casino, Crash, Sports,
// Fishing, Table) can have its lucide icon replaced by an admin-
// uploaded image stored as a SystemSetting row. Null or empty strings
// clear the override and the public surface falls back to the lucide
// icon.

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db/client';
import { withAuth, ensurePermission, recordActivity } from '@/lib/auth/guard';
import { jsonError, jsonOk } from '@/lib/auth/errors';

const SHORTCUT_KEYS = ['jackpot', 'hot', 'slot', 'casino', 'crash', 'sports', 'fishing', 'table'] as const;
type ShortcutKey = (typeof SHORTCUT_KEYS)[number];
const settingKey = (key: string) => `homepage_shortcut_icon_${key}`;

const putSchema = z.object({
  icons: z.record(z.string().trim().max(500).nullable().optional()),
});

export async function GET() {
  return withAuth(async () => {
    await ensurePermission('homepage.write');
    const rows = await db.systemSetting.findMany({
      where: { key: { in: SHORTCUT_KEYS.map(settingKey) } },
    });
    const icons: Record<string, string> = {};
    for (const r of rows) {
      if (r.value && r.value.trim()) {
        const k = r.key.replace('homepage_shortcut_icon_', '');
        icons[k] = r.value.trim();
      }
    }
    return jsonOk({ icons, keys: SHORTCUT_KEYS });
  });
}

export async function PUT(req: NextRequest) {
  return withAuth(async () => {
    const session = await ensurePermission('homepage.write');
    const body = await req.json().catch(() => ({}));
    const parsed = putSchema.safeParse(body);
    if (!parsed.success) return jsonError(400, 'VALIDATION', undefined, { issues: parsed.error.issues });

    const ops: Array<Promise<unknown>> = [];
    for (const [k, v] of Object.entries(parsed.data.icons)) {
      if (!(SHORTCUT_KEYS as readonly string[]).includes(k)) continue;
      const value = (v ?? '').trim();
      ops.push(
        db.systemSetting.upsert({
          where: { key: settingKey(k) },
          create: { key: settingKey(k), value },
          update: { value },
        }),
      );
    }
    if (ops.length === 0) return jsonOk({ ok: true, updated: 0 });
    await db.$transaction(ops as Array<Promise<unknown>> as never);

    await recordActivity({
      actorId: session.sub,
      actorRole: session.role,
      action: 'HOMEPAGE_SHORTCUT_ICONS_UPDATE',
      target: 'homepage_shortcuts',
      meta: { changedKeys: Object.keys(parsed.data.icons) as ShortcutKey[] },
    });

    return jsonOk({ ok: true, updated: ops.length });
  });
}
