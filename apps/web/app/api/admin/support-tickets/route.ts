// Built by Anointed Coder.
//
// GET /api/admin/support-tickets[?status=open]
//
// Admin support queue. Returns up to 200 most recent tickets ordered
// by createdAt desc, joined to User for the submitter's username +
// phone. Optional status filter.

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { db } from '@/lib/db/client';
import { withAuth, ensurePermission } from '@/lib/auth/guard';
import { jsonOk } from '@/lib/auth/errors';

const STATUS_VALUES = ['open', 'pending', 'resolved', 'closed'] as const;
type Status = (typeof STATUS_VALUES)[number];

export async function GET(req: NextRequest) {
  return withAuth(async () => {
    await ensurePermission('support.write');

    const url = new URL(req.url);
    const statusFilter = url.searchParams.get('status');
    const where = statusFilter && (STATUS_VALUES as readonly string[]).includes(statusFilter)
      ? { status: statusFilter as Status }
      : {};

    const tickets = await db.supportTicket.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: { user: { select: { username: true, phone: true } } },
    });

    return jsonOk({
      tickets: tickets.map((t) => ({
        id: t.id,
        userId: t.userId,
        username: t.user?.username ?? null,
        userPhone: t.user?.phone ?? null,
        guestName: t.name,
        guestEmail: t.email,
        guestPhone: t.phone,
        subject: t.subject,
        body: t.body,
        status: t.status,
        adminNote: t.adminNote,
        resolvedAt: t.resolvedAt,
        resolvedBy: t.resolvedBy,
        ip: t.ip,
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
      })),
      counts: await loadCounts(),
    });
  });
}

async function loadCounts() {
  const rows = await db.supportTicket.groupBy({
    by: ['status'],
    _count: { _all: true },
  });
  const map: Record<string, number> = { open: 0, pending: 0, resolved: 0, closed: 0 };
  for (const r of rows) map[r.status] = r._count._all;
  return map;
}
