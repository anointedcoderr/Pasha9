// Built by Anointed Coder.

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db/client';
import { withAuth, ensurePermission, recordActivity } from '@/lib/auth/guard';
import { jsonError, jsonOk } from '@/lib/auth/errors';
import { invalidateIpBlockCache } from '@/lib/security/ip-block';

const createSchema = z.object({
  ip: z.string().trim().min(7).max(64).regex(/^\d{1,3}(\.\d{1,3}){3}(\/\d{1,2})?$/, 'IPv4 or CIDR'),
  reason: z.string().max(240).optional().nullable(),
  expiresAt: z.string().datetime().optional().nullable(),
});

export async function GET() {
  return withAuth(async () => {
    await ensurePermission('activity.read');
    const rows = await db.ipBlockRule.findMany({ orderBy: { createdAt: 'desc' } });
    return jsonOk({ rules: rows });
  });
}

export async function POST(req: NextRequest) {
  return withAuth(async () => {
    const session = await ensurePermission('staff.manage');
    const body = await req.json().catch(() => ({}));
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) return jsonError(400, 'VALIDATION', undefined, { issues: parsed.error.issues });

    const created = await db.ipBlockRule.create({
      data: {
        ip: parsed.data.ip,
        reason: parsed.data.reason ?? null,
        expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null,
        createdById: session.sub,
      },
    });
    invalidateIpBlockCache();
    await recordActivity({
      actorId: session.sub,
      actorRole: session.role,
      action: 'IP_BLOCK_ADD',
      target: created.id,
      detail: `${parsed.data.ip}${parsed.data.reason ? ' - ' + parsed.data.reason : ''}`,
    });
    return jsonOk({ rule: created }, 201);
  });
}
