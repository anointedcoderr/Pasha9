// Built by Anointed Coder.
//
// GET   /api/admin/password-resets               list pending + recent
// POST  /api/admin/password-resets/[id]/approve  generate one-time token
// POST  /api/admin/password-resets/[id]/reject   close request

export const dynamic = 'force-dynamic';

import { db } from '@/lib/db/client';
import { withAuth, ensurePermission } from '@/lib/auth/guard';
import { jsonOk } from '@/lib/auth/errors';

export async function GET() {
  return withAuth(async () => {
    await ensurePermission('users.write');
    const rows = await db.passwordResetToken.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: { user: { select: { username: true, phone: true, email: true } } },
    });
    return jsonOk({
      requests: rows.map((r) => ({
        id: r.id,
        userId: r.userId,
        username: r.user?.username ?? null,
        phone: r.user?.phone ?? null,
        email: r.user?.email ?? null,
        identifier: r.identifier ?? null,
        status: r.status,
        adminNote: r.adminNote ?? null,
        createdAt: r.createdAt,
        approvedAt: r.approvedAt,
        expiresAt: r.expiresAt,
      })),
    });
  });
}
