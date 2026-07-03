// Built by Anointed Coder.

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db/client';
import { withAuth, ensurePermission, recordActivity } from '@/lib/auth/guard';
import { jsonError, jsonOk } from '@/lib/auth/errors';

// Secret-shaped keys (telegram_bot_token, sms_*_api_token, CAPI
// tokens, ...) must never leave this route in full. Same regex and
// masked form as the notifications snapshot route. Masking in place
// (instead of dropping the rows) is safe here because every consumer
// of this GET (/admin/settings, /admin/website,
// /admin/withdrawal-limits) filters to its own non-secret keys and
// PATCHes only those keys back from local state, so a masked value
// can never round-trip into a save.
const SECRET_KEY = /(token|secret|api_key|api_token|auth_token)/i;

function maskSecret(value: string): string {
  if (!value) return '';
  if (value.length <= 8) return '****';
  return `${value.slice(0, 4)}...${value.slice(-2)}`;
}

export async function GET() {
  return withAuth(async () => {
    await ensurePermission('settings.write');
    const settings = await db.systemSetting.findMany({ orderBy: { key: 'asc' } });
    const safe = settings.map((s) =>
      SECRET_KEY.test(s.key) ? { ...s, value: maskSecret(s.value ?? '') } : s,
    );
    return jsonOk({ settings: safe });
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
