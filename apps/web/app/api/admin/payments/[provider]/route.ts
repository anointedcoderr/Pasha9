// Built by Anointed Coder.
//
// Save the SystemSetting rows for one payment provider. Per-provider
// to keep the diff small + auditable. Toggle and text fields are
// stored as-is; secret fields are only overwritten when the admin
// posts a non-empty new value (so they can save unrelated fields
// without re-entering the secret).

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db/client';
import { withAuth, ensurePermission, recordActivity } from '@/lib/auth/guard';
import { jsonError, jsonOk } from '@/lib/auth/errors';
import { PROVIDER_KEYS, getSettingsSchema } from '@/lib/payments/registry';
import type { ProviderKey } from '@/lib/payments/types';

const schema = z.object({
  updates: z.array(z.object({ key: z.string().min(1).max(80), value: z.string().max(4000) })).max(40),
});

export async function PATCH(req: NextRequest, { params }: { params: { provider: string } }) {
  return withAuth(async () => {
    const session = await ensurePermission('settings.write');
    if (!PROVIDER_KEYS.includes(params.provider as ProviderKey)) {
      return jsonError(404, 'UNKNOWN_PROVIDER');
    }
    const body = await req.json().catch(() => ({}));
    const parsed = schema.safeParse(body);
    if (!parsed.success) return jsonError(400, 'VALIDATION', undefined, { issues: parsed.error.issues });

    const fieldSpec = getSettingsSchema(params.provider as ProviderKey).fields;
    const allowedKeys = new Set(fieldSpec.map((f) => f.key));
    const secretKeys = new Set(fieldSpec.filter((f) => f.kind === 'secret').map((f) => f.key));

    const ops = [];
    const auditKeys: string[] = [];
    for (const u of parsed.data.updates) {
      if (!allowedKeys.has(u.key)) continue;
      // Skip empty secret updates so the admin does not accidentally
      // wipe stored credentials by saving the rest of the form.
      if (secretKeys.has(u.key) && u.value.trim() === '') continue;
      ops.push(
        db.systemSetting.upsert({
          where: { key: u.key },
          update: { value: u.value },
          create: { key: u.key, value: u.value },
        }),
      );
      auditKeys.push(u.key);
    }

    if (ops.length === 0) return jsonOk({ ok: true, updated: 0 });

    await db.$transaction(ops);
    await recordActivity({
      actorId: session.sub,
      actorRole: session.role,
      action: 'PAYMENT_SETTINGS_UPDATE',
      target: params.provider,
      detail: auditKeys.join(','),
    });

    return jsonOk({ ok: true, updated: ops.length });
  });
}
