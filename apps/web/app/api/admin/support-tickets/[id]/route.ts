// Built by Anointed Coder.
//
// PATCH /api/admin/support-tickets/[id]
//
// Update status and/or admin note on a ticket. Setting status to
// 'resolved' or 'closed' stamps resolvedAt + resolvedBy with the
// current admin's id. Idempotent: reapplying the same status is a no-op
// but writes adminNote when provided.

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db/client';
import { withAuth, ensurePermission, recordActivity } from '@/lib/auth/guard';
import { jsonError, jsonOk } from '@/lib/auth/errors';

const patchSchema = z.object({
  status: z.enum(['open', 'pending', 'resolved', 'closed']).optional(),
  adminNote: z.string().trim().max(4000).optional().nullable(),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  return withAuth(async () => {
    const session = await ensurePermission('support.write');
    const body = await req.json().catch(() => ({}));
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) return jsonError(400, 'VALIDATION', undefined, { issues: parsed.error.issues });
    if (parsed.data.status === undefined && parsed.data.adminNote === undefined) {
      return jsonError(400, 'VALIDATION', 'Provide a status change or an admin note.');
    }

    const existing = await db.supportTicket.findUnique({ where: { id: params.id } });
    if (!existing) return jsonError(404, 'NOT_FOUND');

    const data: Record<string, unknown> = {};
    if (parsed.data.status !== undefined) {
      data.status = parsed.data.status;
      if (parsed.data.status === 'resolved' || parsed.data.status === 'closed') {
        data.resolvedAt = new Date();
        data.resolvedBy = session.sub;
      } else {
        // Reopen the ticket. Clear the resolved metadata.
        data.resolvedAt = null;
        data.resolvedBy = null;
      }
    }
    if (parsed.data.adminNote !== undefined) {
      data.adminNote = parsed.data.adminNote;
    }

    const ticket = await db.supportTicket.update({
      where: { id: params.id },
      data,
    });

    await recordActivity({
      actorId: session.sub,
      actorRole: session.role,
      action: 'SUPPORT_TICKET_PATCH',
      target: ticket.id,
      meta: { status: ticket.status, hasNote: Boolean(ticket.adminNote) },
    });

    return jsonOk({ ok: true, ticket });
  });
}
