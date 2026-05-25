// Built by Anointed Coder.

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db/client';
import { withAuth, ensurePermission, recordActivity } from '@/lib/auth/guard';
import { jsonError, jsonOk } from '@/lib/auth/errors';
import { PAYOUT_PROVIDER_KEYS, getPayoutSettings } from '@/lib/payouts/registry';
import type { PayoutProviderKey } from '@/lib/payouts/types';

const schema = z.object({
  updates: z.array(z.object({ key: z.string().min(1).max(80), value: z.string().max(4000) })).max(40),
});

export async function PATCH(req: NextRequest, { params }: { params: { provider: string } }) {
  return withAuth(async () => {
    const session = await ensurePermission('settings.write');
    if (!PAYOUT_PROVIDER_KEYS.includes(params.provider as PayoutProviderKey)) {
      return jsonError(404, 'UNKNOWN_PROVIDER');
    }
    const body = await req.json().catch(() => ({}));
    const parsed = schema.safeParse(body);
    if (!parsed.success) return jsonError(400, 'VALIDATION', undefined, { issues: parsed.error.issues });

    const fieldSpec = getPayoutSettings(params.provider as PayoutProviderKey).fields;
    const allowedKeys = new Set(fieldSpec.map((f) => f.key));
    const secretKeys = new Set(fieldSpec.filter((f) => f.kind === 'secret').map((f) => f.key));

    const ops = [];
    const auditKeys: string[] = [];
    for (const u of parsed.data.updates) {
      if (!allowedKeys.has(u.key)) continue;
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
      action: 'PAYOUT_SETTINGS_UPDATE',
      target: params.provider,
      detail: auditKeys.join(','),
    });

    return jsonOk({ ok: true, updated: ops.length });
  });
}
