// Built by Anointed Coder.
//
// GET /api/admin/providers/[id]/logs?kind=request|callback&limit=50
// Returns the most recent request or callback log rows.

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { withAuth, ensurePermission } from '@/lib/auth/guard';
import { jsonOk } from '@/lib/auth/errors';
import { db } from '@/lib/db/client';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  return withAuth(async () => {
    await ensurePermission('users.read');
    const url = new URL(req.url);
    const kind = url.searchParams.get('kind') === 'callback' ? 'callback' : 'request';
    const limit = Math.min(Math.max(Number(url.searchParams.get('limit') ?? 50) || 50, 1), 200);

    if (kind === 'callback') {
      const rows = await db.providerCallbackLog.findMany({
        where: { providerId: params.id },
        orderBy: { receivedAt: 'desc' },
        take: limit,
      });
      return jsonOk({ kind, rows });
    }
    const rows = await db.providerRequestLog.findMany({
      where: { providerId: params.id },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    return jsonOk({ kind, rows });
  });
}
