// Built by Anointed Coder.

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { withAuth, ensurePermission, recordActivity } from '@/lib/auth/guard';
import { jsonError, jsonOk } from '@/lib/auth/errors';
import { claimTask, releaseTask } from '@/lib/recovery/engine';

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  return withAuth(async () => {
    const session = await ensurePermission('users.read');
    const result = await claimTask(params.id, session.sub);
    if (!result.ok) {
      if (result.reason === 'TASK_NOT_FOUND') return jsonError(404, 'TASK_NOT_FOUND');
      if (result.reason === 'LOCKED_BY_OTHER') return jsonError(409, 'LOCKED_BY_OTHER', 'Another staff is currently working this task.');
      if (result.reason === 'TASK_CLOSED') return jsonError(400, 'TASK_CLOSED');
      return jsonError(400, result.reason ?? 'CLAIM_FAILED');
    }
    await recordActivity({
      actorId: session.sub,
      actorRole: session.role,
      action: 'RECOVERY_TASK_CLAIM',
      target: params.id,
      detail: `lockedUntil=${result.lockedUntil?.toISOString() ?? ''}`,
    });
    return jsonOk({ ok: true, lockedUntil: result.lockedUntil });
  });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  return withAuth(async () => {
    const session = await ensurePermission('users.read');
    await releaseTask(params.id, session.sub);
    await recordActivity({
      actorId: session.sub,
      actorRole: session.role,
      action: 'RECOVERY_TASK_RELEASE',
      target: params.id,
    });
    return jsonOk({ ok: true });
  });
}
