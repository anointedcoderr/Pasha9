// Built by Anointed Coder.
//
// M2G: filterable activity feed. Query params:
//   actorId    exact match on the actor user id
//   action     case-insensitive contains match on the action key
//              (e.g. 'BONUS' matches BONUS_GRANTED, BONUS_NOT_GRANTED)
//   target     case-insensitive contains match on the target id
//   from       ISO datetime, lower bound on createdAt
//   to         ISO datetime, upper bound on createdAt
//   q          free-text search across action, target, detail
//   take       1..200 (default 100)

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import type { Prisma } from '@prisma/client';
import { db } from '@/lib/db/client';
import { withAuth } from '@/lib/auth/guard';
import { requireSuperAdmin } from '@/lib/auth/rbac';
import { jsonOk } from '@/lib/auth/errors';

export async function GET(req: NextRequest) {
  return withAuth(async () => {
    // Super Admin only, by explicit client requirement: the audit trail
    // records what staff did, so staff must not be able to read it. It was
    // previously grantable to any staff member through the Activity Log
    // section, which let someone review - and quietly learn the shape of -
    // the log that exists to hold them accountable.
    //
    // Neither ActivityLog nor WalletLedger has any update or delete path
    // anywhere in the codebase, so they are already append-only; this closes
    // the read side.
    await requireSuperAdmin();
    const url = req.nextUrl;
    const take = Math.min(200, Math.max(1, Number(url.searchParams.get('take') ?? 100)));

    const actorId = url.searchParams.get('actorId')?.trim();
    const action = url.searchParams.get('action')?.trim();
    const target = url.searchParams.get('target')?.trim();
    const from = url.searchParams.get('from')?.trim();
    const to = url.searchParams.get('to')?.trim();
    const q = url.searchParams.get('q')?.trim();

    const where: Prisma.ActivityLogWhereInput = {};
    if (actorId) where.actorId = actorId;
    if (action) where.action = { contains: action, mode: 'insensitive' };
    if (target) where.target = { contains: target, mode: 'insensitive' };
    const created: Prisma.DateTimeFilter = {};
    if (from && !Number.isNaN(Date.parse(from))) created.gte = new Date(from);
    if (to && !Number.isNaN(Date.parse(to))) created.lte = new Date(to);
    if (created.gte || created.lte) where.createdAt = created;
    if (q) {
      where.OR = [
        { action: { contains: q, mode: 'insensitive' } },
        { target: { contains: q, mode: 'insensitive' } },
        { detail: { contains: q, mode: 'insensitive' } },
      ];
    }

    const logs = await db.activityLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take,
      include: { actor: { select: { username: true } } },
    });
    return jsonOk({ logs, count: logs.length });
  });
}
