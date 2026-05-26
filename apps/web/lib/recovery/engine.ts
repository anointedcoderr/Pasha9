// Built by Anointed Coder.
//
// M2H Player Recovery CRM engine.
//
// Surfaces (every helper returns observability-friendly counts so the
// admin UI + ActivityLog can show what actually happened, matching
// the M2D/M2E pattern):
//
//   evaluateSegment(rule)          users currently matching a rule
//   materializeTasks(rule)         create RecoveryTask rows for new
//                                  matches (idempotent: skips users
//                                  with an open task for this rule)
//   materializeAllAuto()           sweep across every active rule that
//                                  has autoCreateTasks=true
//   claimTask(taskId, staffId)     lock task for N minutes
//   releaseTask(taskId, staffId)   manual unlock by holder
//   releaseExpiredLocks()          cron sweep
//   recordAttempt(...)             append RecoveryContactLog +
//                                  increment counters + (optional)
//                                  close task as won/lost
//   getStaffPerformance(from, to)  per-staff KPIs

import { Prisma } from '@prisma/client';
import type { RecoveryRule } from '@prisma/client';
import { db } from '@/lib/db/client';

// How long a staff member holds a task before the lock auto-expires.
// Short enough to prevent abandonment, long enough for a real call.
export const CLAIM_TTL_MINUTES = 30;

const ACTIVE_TASK_STATUSES = ['open', 'in_progress'] as const;

function nowPlusMinutes(min: number): Date {
  return new Date(Date.now() + min * 60_000);
}

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 86_400_000);
}

// ---------- Segment evaluation ----------

export interface SegmentUser {
  id: string;
  username: string;
  phone: string | null;
  lastLoginAt: Date | null;
  balance: number;
  bonusBalance: number;
  lottoBalance: number;
  totalApprovedDeposits: number;
  lastApprovedDepositAt: Date | null;
}

export async function evaluateSegment(rule: RecoveryRule, limit = 500): Promise<SegmentUser[]> {
  const threshold = Number(rule.threshold);

  // Build the user-filter for the rule kind. We then enrich with
  // wallet + deposit aggregates in JS so each kind branch stays
  // readable.
  let userIds: string[] = [];

  if (rule.kind === 'no_login') {
    const cutoff = daysAgo(threshold);
    const rows = await db.user.findMany({
      where: {
        role: { key: 'user' },
        status: 'active',
        OR: [
          { lastLoginAt: null },
          { lastLoginAt: { lt: cutoff } },
        ],
      },
      select: { id: true },
      orderBy: { lastLoginAt: 'asc' },
      take: limit,
    });
    userIds = rows.map((r) => r.id);
  } else if (rule.kind === 'no_deposit') {
    const cutoff = daysAgo(threshold);
    // Players whose MOST RECENT approved deposit is older than the
    // cutoff (or who have none).
    const rows = await db.$queryRawUnsafe<Array<{ id: string }>>(
      `
      SELECT u.id
      FROM "User" u
      JOIN "Role" r ON r.id = u."roleId"
      LEFT JOIN (
        SELECT "userId", MAX("createdAt") AS last_dep
        FROM "Deposit"
        WHERE "status" = 'approved'
        GROUP BY "userId"
      ) d ON d."userId" = u.id
      WHERE r.key = 'user' AND u.status = 'active'
        AND (d.last_dep IS NULL OR d.last_dep < $1)
      LIMIT $2
      `,
      cutoff,
      limit,
    );
    userIds = rows.map((r) => r.id);
  } else if (rule.kind === 'no_bet') {
    const cutoff = daysAgo(threshold);
    const rows = await db.$queryRawUnsafe<Array<{ id: string }>>(
      `
      SELECT u.id
      FROM "User" u
      JOIN "Role" r ON r.id = u."roleId"
      LEFT JOIN (
        SELECT "userId", MAX("createdAt") AS last_act
        FROM "Transaction"
        WHERE "type" IN ('bet', 'win')
        GROUP BY "userId"
      ) t ON t."userId" = u.id
      WHERE r.key = 'user' AND u.status = 'active'
        AND (t.last_act IS NULL OR t.last_act < $1)
      LIMIT $2
      `,
      cutoff,
      limit,
    );
    userIds = rows.map((r) => r.id);
  } else if (rule.kind === 'balance_below') {
    const rows = await db.user.findMany({
      where: {
        role: { key: 'user' },
        status: 'active',
        wallet: { balance: { lt: new Prisma.Decimal(threshold) } },
      },
      select: { id: true },
      orderBy: { wallet: { balance: 'asc' } },
      take: limit,
    });
    userIds = rows.map((r) => r.id);
  } else {
    return [];
  }

  if (userIds.length === 0) return [];

  // Enrich.
  const users = await db.user.findMany({
    where: { id: { in: userIds } },
    select: {
      id: true,
      username: true,
      phone: true,
      lastLoginAt: true,
      wallet: { select: { balance: true, bonusBalance: true, lottoBalance: true } },
    },
  });
  const depAgg = await db.deposit.groupBy({
    by: ['userId'],
    where: { userId: { in: userIds }, status: 'approved' },
    _sum: { amount: true },
    _max: { createdAt: true },
  });
  const aggMap = new Map(depAgg.map((d) => [d.userId, d]));

  // Preserve the order returned by the kind-specific query.
  const userMap = new Map(users.map((u) => [u.id, u]));
  const enriched: SegmentUser[] = [];
  for (const id of userIds) {
    const u = userMap.get(id);
    if (!u) continue;
    const agg = aggMap.get(id);
    enriched.push({
      id: u.id,
      username: u.username,
      phone: u.phone,
      lastLoginAt: u.lastLoginAt,
      balance: u.wallet ? Number(u.wallet.balance) : 0,
      bonusBalance: u.wallet ? Number(u.wallet.bonusBalance) : 0,
      lottoBalance: u.wallet ? Number(u.wallet.lottoBalance) : 0,
      totalApprovedDeposits: agg ? Number(agg._sum.amount ?? 0) : 0,
      lastApprovedDepositAt: agg?._max.createdAt ?? null,
    });
  }
  return enriched;
}

// ---------- Task materialization ----------

export interface MaterializeResult {
  ruleId: string;
  ruleName: string;
  matched: number;
  created: number;
  skippedExisting: number;
}

export async function materializeTasks(rule: RecoveryRule, limit = 500): Promise<MaterializeResult> {
  const segment = await evaluateSegment(rule, limit);
  if (segment.length === 0) {
    return { ruleId: rule.id, ruleName: rule.name, matched: 0, created: 0, skippedExisting: 0 };
  }

  // Skip users that already have an open task for this rule (no
  // matter who they are assigned to). Idempotent so a sweep can run
  // every minute without piling up duplicates.
  const existing = await db.recoveryTask.findMany({
    where: {
      ruleId: rule.id,
      userId: { in: segment.map((s) => s.id) },
      status: { in: ACTIVE_TASK_STATUSES as unknown as string[] },
    },
    select: { userId: true },
  });
  const blocked = new Set(existing.map((e) => e.userId));
  const toCreate = segment.filter((s) => !blocked.has(s.id));

  if (toCreate.length === 0) {
    return { ruleId: rule.id, ruleName: rule.name, matched: segment.length, created: 0, skippedExisting: blocked.size };
  }

  await db.recoveryTask.createMany({
    data: toCreate.map((s) => ({
      userId: s.id,
      ruleId: rule.id,
      status: 'open',
    })),
  });

  return {
    ruleId: rule.id,
    ruleName: rule.name,
    matched: segment.length,
    created: toCreate.length,
    skippedExisting: blocked.size,
  };
}

export async function materializeAllAuto(): Promise<MaterializeResult[]> {
  const rules = await db.recoveryRule.findMany({
    where: { status: 'active', autoCreateTasks: true },
    orderBy: { priority: 'desc' },
  });
  const out: MaterializeResult[] = [];
  for (const rule of rules) {
    try {
      out.push(await materializeTasks(rule));
    } catch (err) {
      console.error('[recovery] materialize failed for', rule.id, err);
      out.push({ ruleId: rule.id, ruleName: rule.name, matched: 0, created: 0, skippedExisting: 0 });
    }
  }
  return out;
}

// ---------- Task claim / lock ----------

export async function claimTask(taskId: string, staffId: string, ttlMinutes = CLAIM_TTL_MINUTES): Promise<{
  ok: boolean;
  reason?: string;
  lockedUntil?: Date;
}> {
  return await db.$transaction(async (tx) => {
    const t = await tx.recoveryTask.findUnique({ where: { id: taskId } });
    if (!t) return { ok: false, reason: 'TASK_NOT_FOUND' };
    if (t.status === 'won' || t.status === 'lost' || t.status === 'abandoned') {
      return { ok: false, reason: 'TASK_CLOSED' };
    }
    const now = new Date();
    if (t.lockedByStaffId && t.lockedByStaffId !== staffId && t.lockedUntil && t.lockedUntil > now) {
      return { ok: false, reason: 'LOCKED_BY_OTHER' };
    }
    const lockedUntil = nowPlusMinutes(ttlMinutes);
    await tx.recoveryTask.update({
      where: { id: taskId },
      data: {
        status: 'in_progress',
        lockedByStaffId: staffId,
        lockedUntil,
        assignedToStaffId: t.assignedToStaffId ?? staffId,
      },
    });
    return { ok: true, lockedUntil };
  });
}

export async function releaseTask(taskId: string, staffId: string): Promise<void> {
  const t = await db.recoveryTask.findUnique({ where: { id: taskId } });
  if (!t) return;
  if (t.lockedByStaffId !== staffId) return;
  await db.recoveryTask.update({
    where: { id: taskId },
    data: {
      lockedByStaffId: null,
      lockedUntil: null,
      status: t.status === 'in_progress' ? 'open' : t.status,
    },
  });
}

// Cron sweep: every task whose lockedUntil is in the past gets
// unlocked and (if still in_progress) flipped back to open so another
// staff can pick it up.
export async function releaseExpiredLocks(): Promise<{ released: number }> {
  const now = new Date();
  const rows = await db.recoveryTask.findMany({
    where: { lockedUntil: { lt: now, not: null } },
    select: { id: true, status: true },
  });
  let released = 0;
  for (const t of rows) {
    await db.recoveryTask.update({
      where: { id: t.id },
      data: {
        lockedByStaffId: null,
        lockedUntil: null,
        status: t.status === 'in_progress' ? 'open' : t.status,
      },
    });
    released += 1;
  }
  return { released };
}

// ---------- Contact attempts ----------

const VALID_OUTCOMES = ['no_answer', 'callback', 'not_interested', 'converted', 'wrong_number', 'other'] as const;
const VALID_CHANNELS = ['call', 'sms', 'whatsapp', 'email', 'other'] as const;

export interface RecordAttemptOpts {
  taskId: string;
  staffId: string;
  channel: typeof VALID_CHANNELS[number];
  outcome: typeof VALID_OUTCOMES[number];
  notes?: string;
  closeAs?: 'won' | 'lost' | 'abandoned';
  closeReason?: string;
}

export async function recordAttempt(opts: RecordAttemptOpts): Promise<{ ok: boolean; attemptId: string; taskStatus: string }> {
  return await db.$transaction(async (tx) => {
    const t = await tx.recoveryTask.findUnique({ where: { id: opts.taskId } });
    if (!t) throw new Error('TASK_NOT_FOUND');
    if (t.status === 'won' || t.status === 'lost' || t.status === 'abandoned') {
      throw new Error('TASK_CLOSED');
    }
    // Lock guard: only the staff currently holding the lock OR an
    // unlocked task may record an attempt.
    const now = new Date();
    if (t.lockedByStaffId && t.lockedByStaffId !== opts.staffId && t.lockedUntil && t.lockedUntil > now) {
      throw new Error('LOCKED_BY_OTHER');
    }

    const attempt = await tx.recoveryContactLog.create({
      data: {
        taskId: opts.taskId,
        staffId: opts.staffId,
        channel: opts.channel,
        outcome: opts.outcome,
        notes: opts.notes ?? null,
        meta: (opts.closeAs ? { closedAs: opts.closeAs, closeReason: opts.closeReason ?? null } : null) as Prisma.InputJsonValue,
      },
    });

    const nextStatus = opts.closeAs ?? t.status;
    const closeFields = opts.closeAs
      ? { closedAt: now, closedByStaffId: opts.staffId, closeReason: opts.closeReason ?? `attempt:${opts.outcome}` }
      : {};

    await tx.recoveryTask.update({
      where: { id: opts.taskId },
      data: {
        status: nextStatus,
        lastAttemptAt: now,
        lastAttemptOutcome: opts.outcome,
        attemptCount: { increment: 1 },
        // Releasing the lock on close so other staff can move on.
        ...(opts.closeAs ? { lockedByStaffId: null, lockedUntil: null } : {}),
        ...closeFields,
      },
    });

    return { ok: true, attemptId: attempt.id, taskStatus: nextStatus };
  });
}

// ---------- Performance ----------

export interface StaffPerformanceRow {
  staffId: string;
  staffUsername: string | null;
  totalAttempts: number;
  uniqueTasks: number;
  closedWon: number;
  closedLost: number;
  closedAbandoned: number;
  outcomeBreakdown: Record<string, number>;
  conversionRate: number;
}

export async function getStaffPerformance(from?: Date, to?: Date): Promise<StaffPerformanceRow[]> {
  const where: Prisma.RecoveryContactLogWhereInput = {};
  if (from || to) {
    where.attemptedAt = {};
    if (from) where.attemptedAt.gte = from;
    if (to) where.attemptedAt.lte = to;
  }

  const attempts = await db.recoveryContactLog.findMany({
    where,
    select: { staffId: true, taskId: true, outcome: true },
  });
  if (attempts.length === 0) return [];

  // Group in JS so the response shape is easy to render.
  const map = new Map<string, {
    staffId: string;
    totalAttempts: number;
    uniqueTasks: Set<string>;
    outcomeBreakdown: Record<string, number>;
  }>();
  for (const a of attempts) {
    let bucket = map.get(a.staffId);
    if (!bucket) {
      bucket = { staffId: a.staffId, totalAttempts: 0, uniqueTasks: new Set(), outcomeBreakdown: {} };
      map.set(a.staffId, bucket);
    }
    bucket.totalAttempts += 1;
    bucket.uniqueTasks.add(a.taskId);
    bucket.outcomeBreakdown[a.outcome] = (bucket.outcomeBreakdown[a.outcome] ?? 0) + 1;
  }

  const staffIds = Array.from(map.keys());
  const usernames = await db.user.findMany({
    where: { id: { in: staffIds } },
    select: { id: true, username: true },
  });
  const userMap = new Map(usernames.map((u) => [u.id, u.username]));

  // Closed-by counts (from RecoveryTask), so we know who actually
  // converted vs who just attempted.
  const closes = await db.recoveryTask.groupBy({
    by: ['closedByStaffId', 'status'],
    where: { closedByStaffId: { in: staffIds } },
    _count: { _all: true },
  });
  const closeMap = new Map<string, { won: number; lost: number; abandoned: number }>();
  for (const c of closes) {
    if (!c.closedByStaffId) continue;
    const cur = closeMap.get(c.closedByStaffId) ?? { won: 0, lost: 0, abandoned: 0 };
    if (c.status === 'won') cur.won = c._count._all;
    if (c.status === 'lost') cur.lost = c._count._all;
    if (c.status === 'abandoned') cur.abandoned = c._count._all;
    closeMap.set(c.closedByStaffId, cur);
  }

  const out: StaffPerformanceRow[] = Array.from(map.values()).map((b) => {
    const closes = closeMap.get(b.staffId) ?? { won: 0, lost: 0, abandoned: 0 };
    const conversion = b.uniqueTasks.size > 0 ? closes.won / b.uniqueTasks.size : 0;
    return {
      staffId: b.staffId,
      staffUsername: userMap.get(b.staffId) ?? null,
      totalAttempts: b.totalAttempts,
      uniqueTasks: b.uniqueTasks.size,
      closedWon: closes.won,
      closedLost: closes.lost,
      closedAbandoned: closes.abandoned,
      outcomeBreakdown: b.outcomeBreakdown,
      conversionRate: Number((conversion * 100).toFixed(2)),
    };
  });

  out.sort((a, b) => b.closedWon - a.closedWon);
  return out;
}
