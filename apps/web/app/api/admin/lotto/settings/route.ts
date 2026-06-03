// Built by Anointed Coder.
//
// GET   /api/admin/lotto/settings
// PATCH /api/admin/lotto/settings
//
// Reads / updates the four SystemSetting keys that drive the lotto
// engine at runtime: enabled, claimMode, ticketRateAmount,
// ticketRateCount.

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db/client';
import { withAuth, ensurePermission, recordActivity } from '@/lib/auth/guard';
import { getCurrentSession } from '@/lib/auth/rbac';
import { jsonError, jsonOk } from '@/lib/auth/errors';
import { loadLottoSettings } from '@/lib/lotto/settings';

const schema = z.object({
  enabled: z.boolean().optional(),
  claimMode: z.enum(['auto', 'manual']).optional(),
  ticketRateAmount: z.coerce.number().int().min(100).max(1_000_000).optional(),
  ticketRateCount: z.coerce.number().int().min(1).max(100).optional(),
});

export async function GET() {
  return withAuth(async () => {
    await ensurePermission('lotto.write');
    const settings = await loadLottoSettings();
    return jsonOk({ settings });
  });
}

export async function PATCH(req: NextRequest) {
  return withAuth(async () => {
    await ensurePermission('lotto.write');
    const claims = await getCurrentSession();
    if (!claims) return jsonError(401, 'UNAUTHENTICATED');

    const body = await req.json().catch(() => ({}));
    const parsed = schema.safeParse(body);
    if (!parsed.success) return jsonError(400, 'VALIDATION', undefined, { issues: parsed.error.issues });

    const writes: Promise<unknown>[] = [];
    if (parsed.data.enabled !== undefined) {
      const value = parsed.data.enabled ? 'true' : 'false';
      writes.push(db.systemSetting.upsert({
        where: { key: 'lotto_enabled' },
        update: { value, type: 'boolean' },
        create: { key: 'lotto_enabled', value, type: 'boolean' },
      }));
    }
    if (parsed.data.claimMode !== undefined) {
      writes.push(db.systemSetting.upsert({
        where: { key: 'lotto_claim_mode' },
        update: { value: parsed.data.claimMode, type: 'string' },
        create: { key: 'lotto_claim_mode', value: parsed.data.claimMode, type: 'string' },
      }));
    }
    if (parsed.data.ticketRateAmount !== undefined) {
      writes.push(db.systemSetting.upsert({
        where: { key: 'lotto_ticket_rate_amount' },
        update: { value: String(parsed.data.ticketRateAmount), type: 'number' },
        create: { key: 'lotto_ticket_rate_amount', value: String(parsed.data.ticketRateAmount), type: 'number' },
      }));
    }
    if (parsed.data.ticketRateCount !== undefined) {
      writes.push(db.systemSetting.upsert({
        where: { key: 'lotto_ticket_rate_count' },
        update: { value: String(parsed.data.ticketRateCount), type: 'number' },
        create: { key: 'lotto_ticket_rate_count', value: String(parsed.data.ticketRateCount), type: 'number' },
      }));
    }
    await Promise.all(writes);

    const settings = await loadLottoSettings();
    await recordActivity({
      actorId: claims.sub,
      actorRole: claims.role,
      action: 'LOTTO_SETTINGS_UPDATE',
      target: 'system',
      meta: parsed.data,
    });

    return jsonOk({ settings });
  });
}
