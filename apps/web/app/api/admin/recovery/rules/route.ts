// Built by Anointed Coder.
//
// M2H rules CRUD. GET lists every rule (any status), POST creates a
// new rule. Permission gate: users.update (admin-only by default;
// super_admin bypass via rbac).

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { z } from 'zod';
import type { ContentStatus, Prisma } from '@prisma/client';
import { db } from '@/lib/db/client';
import { withAuth, ensurePermission, recordActivity } from '@/lib/auth/guard';
import { jsonError, jsonOk } from '@/lib/auth/errors';

const KINDS = ['no_login', 'no_deposit', 'no_bet', 'balance_below'] as const;
const STATUSES = ['active', 'hidden', 'paused'] as const;

const createSchema = z.object({
  name: z.string().trim().min(1).max(120),
  kind: z.enum(KINDS as unknown as [string, ...string[]]),
  threshold: z.coerce.number().min(0).max(1_000_000_000),
  key: z.string().trim().min(1).max(60).optional().nullable(),
  segmentLabel: z.string().max(120).optional().nullable(),
  priority: z.coerce.number().int().min(0).max(1000).default(0),
  status: z.enum(STATUSES as unknown as [string, ...string[]]).default('active'),
  autoCreateTasks: z.boolean().default(false),
  meta: z.record(z.unknown()).optional().nullable(),
});

function serialize(r: Awaited<ReturnType<typeof db.recoveryRule.findMany>>[number]) {
  return {
    id: r.id,
    key: r.key,
    name: r.name,
    kind: r.kind,
    threshold: Number(r.threshold),
    segmentLabel: r.segmentLabel,
    priority: r.priority,
    status: r.status,
    autoCreateTasks: r.autoCreateTasks,
    meta: r.meta,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

export async function GET() {
  return withAuth(async () => {
    await ensurePermission('users.read');
    const rows = await db.recoveryRule.findMany({
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
    });
    return jsonOk({ rules: rows.map(serialize) });
  });
}

export async function POST(req: NextRequest) {
  return withAuth(async () => {
    const session = await ensurePermission('users.update');
    const body = await req.json().catch(() => ({}));
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) return jsonError(400, 'VALIDATION', undefined, { issues: parsed.error.issues });
    const data = parsed.data;

    if (data.key) {
      const dup = await db.recoveryRule.findUnique({ where: { key: data.key } });
      if (dup) return jsonError(409, 'KEY_TAKEN', `A rule with key "${data.key}" already exists.`);
    }

    const created = await db.recoveryRule.create({
      data: {
        name: data.name,
        kind: data.kind,
        threshold: data.threshold,
        key: data.key ?? null,
        segmentLabel: data.segmentLabel ?? null,
        priority: data.priority,
        status: data.status as ContentStatus,
        autoCreateTasks: data.autoCreateTasks,
        meta: (data.meta ?? null) as Prisma.InputJsonValue,
      },
    });

    await recordActivity({
      actorId: session.sub,
      actorRole: session.role,
      action: 'RECOVERY_RULE_CREATE',
      target: created.id,
      detail: `${created.name} . kind=${created.kind} threshold=${Number(created.threshold)}`,
    });

    return jsonOk({ rule: serialize(created) }, 201);
  });
}
