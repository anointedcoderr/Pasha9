// Built by Anointed Coder.

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { db } from '@/lib/db/client';
import { withAuth, ensurePermission } from '@/lib/auth/guard';
import { jsonOk } from '@/lib/auth/errors';

export async function GET(req: NextRequest) {
  return withAuth(async () => {
    await ensurePermission('activity.read');
    const take = Math.min(200, Number(req.nextUrl.searchParams.get('take') ?? 50));
    const logs = await db.activityLog.findMany({
      orderBy: { createdAt: 'desc' },
      take,
      include: { actor: { select: { username: true } } },
    });
    return jsonOk({ logs });
  });
}
