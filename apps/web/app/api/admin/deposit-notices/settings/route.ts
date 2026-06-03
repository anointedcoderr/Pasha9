// Built by Anointed Coder.
//
// PATCH /api/admin/deposit-notices/settings
// Body: { globalEnabled: boolean }
//
// Toggles the global `deposit_notice_enabled` SystemSetting. The
// public /api/content/deposit-notice respects this flag.

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAuth, ensurePermission, recordActivity } from '@/lib/auth/guard';
import { getCurrentSession } from '@/lib/auth/rbac';
import { jsonError, jsonOk } from '@/lib/auth/errors';
import { db } from '@/lib/db/client';

const schema = z.object({ globalEnabled: z.boolean() });

export async function PATCH(req: NextRequest) {
  return withAuth(async () => {
    await ensurePermission('settings.write');
    const claims = await getCurrentSession();
    if (!claims) return jsonError(401, 'UNAUTHENTICATED');

    const body = await req.json().catch(() => ({}));
    const parsed = schema.safeParse(body);
    if (!parsed.success) return jsonError(400, 'VALIDATION', undefined, { issues: parsed.error.issues });

    const value = parsed.data.globalEnabled ? 'true' : 'false';
    await db.systemSetting.upsert({
      where: { key: 'deposit_notice_enabled' },
      update: { value, type: 'boolean' },
      create: { key: 'deposit_notice_enabled', value, type: 'boolean' },
    });

    await recordActivity({
      actorId: claims.sub,
      actorRole: claims.role,
      action: 'DEPOSIT_NOTICE_TOGGLE',
      target: 'deposit_notice_enabled',
      meta: { globalEnabled: parsed.data.globalEnabled },
    });

    return jsonOk({ globalEnabled: parsed.data.globalEnabled });
  });
}
