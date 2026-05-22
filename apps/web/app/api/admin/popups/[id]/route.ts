// Built by Anointed Coder.

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db/client';
import { withAuth, ensurePermission, recordActivity } from '@/lib/auth/guard';
import { jsonError, jsonOk } from '@/lib/auth/errors';

const updateSchema = z.object({
  title: z.string().min(1).max(120).optional(),
  body: z.string().min(1).max(2000).optional(),
  ctaLabel: z.string().max(60).optional().nullable(),
  ctaHref: z.string().max(500).optional().nullable(),
  startAt: z.string().datetime().optional().nullable(),
  endAt: z.string().datetime().optional().nullable(),
  status: z.enum(['active', 'hidden', 'paused']).optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  return withAuth(async () => {
    const session = await ensurePermission('popups.write');
    const body = await req.json().catch(() => ({}));
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) return jsonError(400, 'VALIDATION', undefined, { issues: parsed.error.issues });
    const data = {
      ...parsed.data,
      startAt: parsed.data.startAt === undefined ? undefined : parsed.data.startAt ? new Date(parsed.data.startAt) : null,
      endAt: parsed.data.endAt === undefined ? undefined : parsed.data.endAt ? new Date(parsed.data.endAt) : null,
    };
    const popup = await db.popupAnnouncement.update({ where: { id: params.id }, data });
    await recordActivity({ actorId: session.sub, actorRole: session.role, action: 'POPUP_UPDATE', target: popup.id });
    return jsonOk({ popup });
  });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  return withAuth(async () => {
    const session = await ensurePermission('popups.write');
    await db.popupAnnouncement.delete({ where: { id: params.id } });
    await recordActivity({ actorId: session.sub, actorRole: session.role, action: 'POPUP_DELETE', target: params.id });
    return jsonOk({ deleted: true });
  });
}
