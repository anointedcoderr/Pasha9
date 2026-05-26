// Built by Anointed Coder.
//
// Dry-run: returns the users currently matching one rule WITHOUT
// creating tasks. Same pattern as the M2D/M2E diagnose endpoints.

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { db } from '@/lib/db/client';
import { withAuth, ensurePermission } from '@/lib/auth/guard';
import { jsonError, jsonOk } from '@/lib/auth/errors';
import { evaluateSegment } from '@/lib/recovery/engine';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  return withAuth(async () => {
    await ensurePermission('users.read');
    const rule = await db.recoveryRule.findUnique({ where: { id: params.id } });
    if (!rule) return jsonError(404, 'NOT_FOUND');
    const url = new URL(req.url);
    const limit = Math.min(2000, Math.max(1, Number(url.searchParams.get('limit') ?? 200)));
    try {
      const users = await evaluateSegment(rule, limit);
      return jsonOk({
        rule: { id: rule.id, name: rule.name, kind: rule.kind, threshold: Number(rule.threshold) },
        matched: users.length,
        users,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[recovery-preview] failed', err);
      return jsonError(500, 'PREVIEW_FAILED', msg);
    }
  });
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  return withAuth(async () => {
    const session = await ensurePermission('users.update');
    const rule = await db.recoveryRule.findUnique({ where: { id: params.id } });
    if (!rule) return jsonError(404, 'NOT_FOUND');
    try {
      const { materializeTasks } = await import('@/lib/recovery/engine');
      const result = await materializeTasks(rule);
      const { recordActivity } = await import('@/lib/auth/guard');
      await recordActivity({
        actorId: session.sub,
        actorRole: session.role,
        action: 'RECOVERY_MATERIALIZE',
        target: rule.id,
        detail: `${result.created} created . ${result.skippedExisting} skipped (already open) . matched ${result.matched}`,
        meta: { ...result },
      });
      return jsonOk({ ok: true, ...result });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[recovery-materialize] failed', err);
      return jsonError(500, 'MATERIALIZE_FAILED', msg);
    }
  });
}
