// Built by Anointed Coder.
//
// Append a RecoveryContactLog entry to a task. POST records the
// attempt (channel + outcome + notes) and optionally closes the task
// as won / lost / abandoned. GET returns the full attempt log for a
// task (timeline view in the admin drawer).

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db/client';
import { withAuth, ensurePermission, recordActivity } from '@/lib/auth/guard';
import { jsonError, jsonOk } from '@/lib/auth/errors';
import { recordAttempt } from '@/lib/recovery/engine';

const VALID_CHANNELS = ['call', 'sms', 'whatsapp', 'email', 'other'] as const;
const VALID_OUTCOMES = ['no_answer', 'callback', 'not_interested', 'converted', 'wrong_number', 'other'] as const;
const CLOSE_AS = ['won', 'lost', 'abandoned'] as const;

const postSchema = z.object({
  channel: z.enum(VALID_CHANNELS as unknown as [string, ...string[]]),
  outcome: z.enum(VALID_OUTCOMES as unknown as [string, ...string[]]),
  notes: z.string().max(2000).optional(),
  closeAs: z.enum(CLOSE_AS as unknown as [string, ...string[]]).optional(),
  closeReason: z.string().max(240).optional(),
});

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  return withAuth(async () => {
    await ensurePermission('users.read');
    const attempts = await db.recoveryContactLog.findMany({
      where: { taskId: params.id },
      orderBy: { attemptedAt: 'asc' },
    });
    if (attempts.length === 0) return jsonOk({ attempts: [] });
    const staffIds = Array.from(new Set(attempts.map((a) => a.staffId)));
    const staff = await db.user.findMany({ where: { id: { in: staffIds } }, select: { id: true, username: true } });
    const staffMap = new Map(staff.map((s) => [s.id, s.username]));
    return jsonOk({
      attempts: attempts.map((a) => ({
        id: a.id,
        staffId: a.staffId,
        staffUsername: staffMap.get(a.staffId) ?? null,
        channel: a.channel,
        outcome: a.outcome,
        notes: a.notes,
        meta: a.meta,
        attemptedAt: a.attemptedAt,
      })),
    });
  });
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  return withAuth(async () => {
    const session = await ensurePermission('users.read');
    const body = await req.json().catch(() => ({}));
    const parsed = postSchema.safeParse(body);
    if (!parsed.success) return jsonError(400, 'VALIDATION', undefined, { issues: parsed.error.issues });

    try {
      const result = await recordAttempt({
        taskId: params.id,
        staffId: session.sub,
        channel: parsed.data.channel as 'call' | 'sms' | 'whatsapp' | 'email' | 'other',
        outcome: parsed.data.outcome as 'no_answer' | 'callback' | 'not_interested' | 'converted' | 'wrong_number' | 'other',
        notes: parsed.data.notes,
        closeAs: parsed.data.closeAs as 'won' | 'lost' | 'abandoned' | undefined,
        closeReason: parsed.data.closeReason,
      });

      await recordActivity({
        actorId: session.sub,
        actorRole: session.role,
        action: parsed.data.closeAs
          ? (parsed.data.closeAs === 'won' ? 'RECOVERY_TASK_WON'
            : parsed.data.closeAs === 'lost' ? 'RECOVERY_TASK_LOST'
            : 'RECOVERY_TASK_ABANDONED')
          : 'RECOVERY_ATTEMPT',
        target: params.id,
        detail: `${parsed.data.channel}/${parsed.data.outcome}${parsed.data.notes ? ` . ${parsed.data.notes.slice(0, 120)}` : ''}`,
      });

      return jsonOk({ ...result }, 201);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const known = ['TASK_NOT_FOUND', 'TASK_CLOSED', 'LOCKED_BY_OTHER'];
      if (known.includes(msg)) return jsonError(400, msg);
      console.error('[recovery-attempt] failed', err);
      return jsonError(500, 'ATTEMPT_FAILED', msg);
    }
  });
}
