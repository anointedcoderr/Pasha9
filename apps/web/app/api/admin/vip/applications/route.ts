// Built by Anointed Coder.
//
// GET /api/admin/vip/applications - list applications (default: pending only)
//   ?status=pending|approved|rejected|all

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { db } from '@/lib/db/client';
import { withAuth, ensurePermission } from '@/lib/auth/guard';
import { jsonOk } from '@/lib/auth/errors';

export async function GET(req: NextRequest) {
  return withAuth(async () => {
    await ensurePermission('users.read');
    const status = (req.nextUrl.searchParams.get('status') ?? 'pending').toLowerCase();
    const where = status === 'all' ? {} : { status };
    const rows = await db.vipApplication.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }],
      take: 200,
      include: {
        user: { select: { id: true, username: true, phone: true, vipTierId: true } },
        tier: { select: { id: true, name: true } },
      },
    });
    return jsonOk({
      applications: rows.map((a) => ({
        id: a.id,
        userId: a.userId,
        username: a.user.username,
        phone: a.user.phone,
        currentTierId: a.user.vipTierId,
        requestedTierId: a.tierId,
        requestedTierName: a.tier?.name ?? null,
        status: a.status,
        notes: a.notes,
        reviewNote: a.reviewNote,
        reviewerId: a.reviewerId,
        reviewedAt: a.reviewedAt,
        appliedAt: a.appliedAt,
      })),
    });
  });
}
