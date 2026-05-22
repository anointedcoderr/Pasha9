// Built by Anointed Coder.

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { db } from '@/lib/db/client';
import { withAuth, ensurePermission } from '@/lib/auth/guard';
import { jsonOk } from '@/lib/auth/errors';

export async function GET(req: NextRequest) {
  return withAuth(async () => {
    await ensurePermission('users.read');
    const q = req.nextUrl.searchParams.get('q')?.trim();
    const take = Math.min(200, Number(req.nextUrl.searchParams.get('take') ?? 50));

    const users = await db.user.findMany({
      where: q
        ? {
            OR: [
              { username: { contains: q, mode: 'insensitive' } },
              { phone: { contains: q } },
              { referralCode: { contains: q, mode: 'insensitive' } },
            ],
          }
        : undefined,
      orderBy: { createdAt: 'desc' },
      take,
      include: {
        role: { select: { key: true, label: true } },
        wallet: { select: { balance: true, bonusBalance: true, lockedBalance: true } },
      },
    });
    return jsonOk({ users });
  });
}
