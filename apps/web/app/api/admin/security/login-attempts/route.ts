// Built by Anointed Coder.

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import type { Prisma } from '@prisma/client';
import { db } from '@/lib/db/client';
import { withAuth, ensurePermission } from '@/lib/auth/guard';
import { jsonOk } from '@/lib/auth/errors';

export async function GET(req: NextRequest) {
  return withAuth(async () => {
    await ensurePermission('activity.read');
    const url = req.nextUrl;
    const take = Math.min(200, Math.max(1, Number(url.searchParams.get('take') ?? 100)));
    const surface = url.searchParams.get('surface')?.trim();
    const success = url.searchParams.get('success');
    const userId = url.searchParams.get('userId')?.trim();
    const ip = url.searchParams.get('ip')?.trim();
    const q = url.searchParams.get('q')?.trim();
    const fromStr = url.searchParams.get('from');
    const toStr = url.searchParams.get('to');

    const where: Prisma.LoginAttemptWhereInput = {};
    if (surface === 'user' || surface === 'admin') where.surface = surface;
    if (success === 'true') where.success = true;
    if (success === 'false') where.success = false;
    if (userId) where.userId = userId;
    if (ip) where.ip = { contains: ip };
    if (q) where.identifier = { contains: q, mode: 'insensitive' };
    if (fromStr && !Number.isNaN(Date.parse(fromStr))) where.createdAt = { ...(where.createdAt as object ?? {}), gte: new Date(fromStr) };
    if (toStr && !Number.isNaN(Date.parse(toStr))) where.createdAt = { ...(where.createdAt as object ?? {}), lte: new Date(toStr) };

    const rows = await db.loginAttempt.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take,
      include: { user: { select: { username: true } } },
    });
    return jsonOk({
      attempts: rows.map((r) => ({
        id: r.id,
        identifier: r.identifier,
        userId: r.userId,
        username: r.user?.username ?? null,
        surface: r.surface,
        ip: r.ip,
        userAgent: r.userAgent,
        success: r.success,
        reason: r.reason,
        flags: r.flags ? r.flags.split(',') : [],
        createdAt: r.createdAt,
      })),
    });
  });
}
