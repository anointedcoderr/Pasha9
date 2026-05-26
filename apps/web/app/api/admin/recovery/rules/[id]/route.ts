// Built by Anointed Coder.

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { z } from 'zod';
import type { ContentStatus, Prisma } from '@prisma/client';
import { db } from '@/lib/db/client';
import { withAuth, ensurePermission, recordActivity } from '@/lib/auth/guard';
import { jsonError, jsonOk } from '@/lib/auth/errors';

const KINDS = ['no_login', 'no_deposit', 'no_bet', 'balance_below'] as const;
const STATUSES = ['active', 'hidden', 'paused'] as const;

const patchSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  kind: z.enum(KINDS as unknown as [string, ...string[]]).optional(),
  threshold: z.coerce.number().min(0).max(1_000_000_000).optional(),
  key: z.string().trim().min(1).max(60).nullable().optional(),
  segmentLabel: z.string().max(120).nullable().optional(),
  priority: z.coerce.number().int().min(0).max(1000).optional(),
  status: z.enum(STATUSES as unknown as [string, ...string[]]).optional(),
  autoCreateTasks: z.boolean().optional(),
  meta: z.record(z.unknown()).nullable().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  return withAuth(async () => {
    const session = await ensurePermission('users.update');
    const existing = await db.recoveryRule.findUnique({ where: { id: params.id } });
    if (!existing) return jsonError(404, 'NOT_FOUND');

    const body = await req.json().catch(() => ({}));
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) return jsonError(400, 'VALIDATION', undefined, { issues: parsed.error.issues });
    const data = parsed.data;

    if (data.key && data.key !== existing.key) {
      const dup = await db.recoveryRule.findUnique({ where: { key: data.key } });
      if (dup && dup.id !== existing.id) {
        return jsonError(409, 'KEY_TAKEN', `A rule with key "${data.key}" already exists.`);
      }
    }

    const updated = await db.recoveryRule.update({
      where: { id: params.id },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.kind !== undefined ? { kind: data.kind } : {}),
        ...(data.threshold !== undefined ? { threshold: data.threshold } : {}),
        ...(data.key !== undefined ? { key: data.key ?? null } : {}),
        ...(data.segmentLabel !== undefined ? { segmentLabel: data.segmentLabel ?? null } : {}),
        ...(data.priority !== undefined ? { priority: data.priority } : {}),
        ...(data.status !== undefined ? { status: data.status as ContentStatus } : {}),
        ...(data.autoCreateTasks !== undefined ? { autoCreateTasks: data.autoCreateTasks } : {}),
        ...(data.meta !== undefined ? { meta: (data.meta ?? null) as Prisma.InputJsonValue } : {}),
      },
    });

    await recordActivity({
      actorId: session.sub,
      actorRole: session.role,
      action: 'RECOVERY_RULE_UPDATE',
      target: updated.id,
      detail: updated.name,
    });

    return jsonOk({ rule: updated });
  });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  return withAuth(async () => {
    const session = await ensurePermission('users.update');
    const existing = await db.recoveryRule.findUnique({
      where: { id: params.id },
      include: { _count: { select: { tasks: true } } },
    });
    if (!existing) return jsonError(404, 'NOT_FOUND');

    // Tasks are kept for audit; rule deletion sets task.ruleId to null
    // via onDelete: SetNull. Block delete only when there are OPEN
    // tasks so admin must close or abandon them first.
    const openTasks = await db.recoveryTask.count({
      where: { ruleId: existing.id, status: { in: ['open', 'in_progress'] } },
    });
    if (openTasks > 0) {
      return jsonError(409, 'RULE_IN_USE', `Rule has ${openTasks} open/in-progress task(s). Close or abandon them first.`);
    }

    await db.recoveryRule.delete({ where: { id: params.id } });

    await recordActivity({
      actorId: session.sub,
      actorRole: session.role,
      action: 'RECOVERY_RULE_DELETE',
      target: params.id,
      detail: existing.name,
    });

    return jsonOk({ ok: true });
  });
}
