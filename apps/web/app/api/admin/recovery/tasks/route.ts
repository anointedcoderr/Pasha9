// Built by Anointed Coder.
//
// M2H task list + manual create. Filters:
//   status            open | in_progress | won | lost | abandoned | all (default 'open,in_progress')
//   assignedToMe      'true' to show only tasks claimed by the current staff
//   ruleId            scope to a specific rule
//   q                 search by user username / phone
//   take              1..200 (default 100)
//
// Permission: users.read for listing, users.update for manual create.
// The list orders by lockedUntil ASC (so freshly-unlocked tasks
// surface first), then createdAt DESC.

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { db } from '@/lib/db/client';
import { withAuth, ensurePermission, recordActivity } from '@/lib/auth/guard';
import { jsonError, jsonOk } from '@/lib/auth/errors';

const ALL_STATUSES = ['open', 'in_progress', 'won', 'lost', 'abandoned'];

const createSchema = z.object({
  userId: z.string().min(1),
  ruleId: z.string().optional().nullable(),
  assignedToStaffId: z.string().optional().nullable(),
});

export async function GET(req: NextRequest) {
  return withAuth(async () => {
    const session = await ensurePermission('users.read');
    const url = new URL(req.url);
    const statusParam = url.searchParams.get('status') ?? 'open,in_progress';
    const assignedToMe = url.searchParams.get('assignedToMe') === 'true';
    const ruleId = url.searchParams.get('ruleId')?.trim();
    const q = url.searchParams.get('q')?.trim().toLowerCase();
    const take = Math.min(200, Math.max(1, Number(url.searchParams.get('take') ?? 100)));

    const statuses = statusParam === 'all'
      ? ALL_STATUSES
      : statusParam.split(',').map((s) => s.trim()).filter((s) => ALL_STATUSES.includes(s));

    const where: Prisma.RecoveryTaskWhereInput = {
      ...(statuses.length > 0 ? { status: { in: statuses } } : {}),
      ...(ruleId ? { ruleId } : {}),
      ...(assignedToMe ? { OR: [{ assignedToStaffId: session.sub }, { lockedByStaffId: session.sub }] } : {}),
    };

    if (q) {
      // Subquery via relation filter; case-insensitive username + phone substring.
      where.user = {
        OR: [
          { username: { contains: q, mode: 'insensitive' } },
          { phone: { contains: q } },
        ],
      } as Prisma.UserWhereInput;
    }

    const rows = await db.recoveryTask.findMany({
      where,
      orderBy: [{ lockedUntil: 'asc' }, { createdAt: 'desc' }],
      take,
      include: {
        rule: { select: { id: true, name: true, kind: true } },
      },
    });

    // Hydrate user identities + staff usernames in batched queries.
    const userIds = Array.from(new Set(rows.map((r) => r.userId)));
    const staffIds = Array.from(new Set(rows.flatMap((r) => [r.assignedToStaffId, r.lockedByStaffId, r.closedByStaffId]).filter(Boolean) as string[]));
    const [users, staff] = await Promise.all([
      db.user.findMany({
        where: { id: { in: userIds } },
        select: {
          id: true,
          username: true,
          phone: true,
          lastLoginAt: true,
          wallet: { select: { balance: true, lottoBalance: true } },
        },
      }),
      staffIds.length > 0
        ? db.user.findMany({ where: { id: { in: staffIds } }, select: { id: true, username: true } })
        : Promise.resolve([]),
    ]);
    const userMap = new Map(users.map((u) => [u.id, u]));
    const staffMap = new Map(staff.map((s) => [s.id, s.username]));

    return jsonOk({
      tasks: rows.map((r) => {
        const u = userMap.get(r.userId);
        return {
          id: r.id,
          userId: r.userId,
          username: u?.username ?? null,
          phone: u?.phone ?? null,
          lastLoginAt: u?.lastLoginAt ?? null,
          balance: u?.wallet ? Number(u.wallet.balance) : 0,
          lottoBalance: u?.wallet ? Number(u.wallet.lottoBalance) : 0,
          rule: r.rule ? { id: r.rule.id, name: r.rule.name, kind: r.rule.kind } : null,
          status: r.status,
          assignedToStaffId: r.assignedToStaffId,
          assignedToStaffName: r.assignedToStaffId ? (staffMap.get(r.assignedToStaffId) ?? null) : null,
          lockedByStaffId: r.lockedByStaffId,
          lockedByStaffName: r.lockedByStaffId ? (staffMap.get(r.lockedByStaffId) ?? null) : null,
          lockedUntil: r.lockedUntil,
          lastAttemptAt: r.lastAttemptAt,
          lastAttemptOutcome: r.lastAttemptOutcome,
          attemptCount: r.attemptCount,
          closeReason: r.closeReason,
          closedAt: r.closedAt,
          closedByStaffId: r.closedByStaffId,
          closedByStaffName: r.closedByStaffId ? (staffMap.get(r.closedByStaffId) ?? null) : null,
          createdAt: r.createdAt,
        };
      }),
    });
  });
}

export async function POST(req: NextRequest) {
  return withAuth(async () => {
    const session = await ensurePermission('users.update');
    const body = await req.json().catch(() => ({}));
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) return jsonError(400, 'VALIDATION', undefined, { issues: parsed.error.issues });

    const user = await db.user.findUnique({ where: { id: parsed.data.userId }, select: { id: true, role: { select: { key: true } } } });
    if (!user) return jsonError(404, 'USER_NOT_FOUND');
    if (user.role.key !== 'user') return jsonError(400, 'NOT_A_PLAYER', 'Recovery tasks can only target player accounts.');

    // Refuse if an open task already exists for this user + rule combo
    // (or any open task if ruleId is null).
    const dupWhere: Prisma.RecoveryTaskWhereInput = {
      userId: user.id,
      status: { in: ['open', 'in_progress'] },
      ...(parsed.data.ruleId ? { ruleId: parsed.data.ruleId } : { ruleId: null }),
    };
    const dup = await db.recoveryTask.findFirst({ where: dupWhere });
    if (dup) return jsonError(409, 'OPEN_TASK_EXISTS', 'An open task already exists for this user / rule.');

    const created = await db.recoveryTask.create({
      data: {
        userId: user.id,
        ruleId: parsed.data.ruleId ?? null,
        assignedToStaffId: parsed.data.assignedToStaffId ?? null,
        status: 'open',
      },
    });

    await recordActivity({
      actorId: session.sub,
      actorRole: session.role,
      action: 'RECOVERY_TASK_CREATE',
      target: created.id,
      detail: `userId=${user.id}${parsed.data.ruleId ? ` ruleId=${parsed.data.ruleId}` : ' (manual)'}`,
    });

    return jsonOk({ ok: true, task: created }, 201);
  });
}
