// Built by Anointed Coder.

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { db } from '@/lib/db/client';
import { withAuth, ensurePermission, recordActivity } from '@/lib/auth/guard';
import { jsonError, jsonOk } from '@/lib/auth/errors';
import { invalidateIpBlockCache } from '@/lib/security/ip-block';

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  return withAuth(async () => {
    const session = await ensurePermission('staff.manage');
    const existing = await db.ipBlockRule.findUnique({ where: { id: params.id } });
    if (!existing) return jsonError(404, 'NOT_FOUND');
    await db.ipBlockRule.delete({ where: { id: params.id } });
    invalidateIpBlockCache();
    await recordActivity({
      actorId: session.sub,
      actorRole: session.role,
      action: 'IP_BLOCK_REMOVE',
      target: params.id,
      detail: existing.ip,
    });
    return jsonOk({ ok: true });
  });
}
