// Built by Anointed Coder.
//
// GET  /api/admin/staff/[id]/points   current balance + recent ledger
// POST /api/admin/staff/[id]/points   { amount, reason }  grant more points
//
// Granting points is hard-gated to super_admin, not just staff.manage: the
// same rule this file's sibling route already applies to granting the
// staff.manage permission itself (a lower-tier admin should not be able to
// hand out the one thing that limits a staff member's reach into player
// wallets). GET is read-only and stays behind the ordinary permission.

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { db } from '@/lib/db/client';
import { withAuth, ensurePermission, recordActivity } from '@/lib/auth/guard';
import { jsonError, jsonOk } from '@/lib/auth/errors';
import { applyStaffPointMovement, loadStaffPointBalance, STAFF_POINT_TYPE } from '@/lib/staff/points';

const schema = z.object({
  amount: z.coerce.number().positive('Amount must be greater than zero.').max(100_000_000),
  reason: z.string().trim().min(3, 'A reason is required.').max(500),
});

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  return withAuth(async () => {
    await ensurePermission('staff.manage');

    const staff = await db.user.findUnique({ where: { id: params.id }, select: { id: true, username: true, role: { select: { key: true } } } });
    if (!staff) return jsonError(404, 'NOT_FOUND', 'Staff account not found.');

    const [balance, wallet, history] = await Promise.all([
      loadStaffPointBalance(db, params.id),
      db.staffPointWallet.findUnique({ where: { staffId: params.id }, select: { turnoverMultiplier: true } }),
      db.staffPointLedger.findMany({
        where: { staffId: params.id },
        orderBy: { createdAt: 'desc' },
        take: 50,
        select: {
          id: true, type: true, amount: true, balanceBefore: true, balanceAfter: true,
          actorId: true, targetUserId: true, reason: true, createdAt: true,
        },
      }),
    ]);

    // Resolve names for the actor (who granted/spent) and target (which
    // player was credited) so the panel reads usernames, not ids.
    const ids = [...new Set(history.flatMap((h) => [h.actorId, h.targetUserId]).filter((v): v is string => Boolean(v)))];
    const named = ids.length
      ? new Map((await db.user.findMany({ where: { id: { in: ids } }, select: { id: true, username: true } })).map((u) => [u.id, u.username]))
      : new Map<string, string>();

    return jsonOk({
      balance: Number(balance),
      // null means "no per-staff override, the global setting applies".
      turnoverMultiplier: wallet?.turnoverMultiplier == null ? null : Number(wallet.turnoverMultiplier),
      history: history.map((h) => ({
        id: h.id,
        type: h.type,
        amount: Number(h.amount),
        before: Number(h.balanceBefore),
        after: Number(h.balanceAfter),
        actorUsername: h.actorId ? (named.get(h.actorId) ?? h.actorId) : null,
        targetUsername: h.targetUserId ? (named.get(h.targetUserId) ?? h.targetUserId) : null,
        reason: h.reason,
        createdAt: h.createdAt,
      })),
    });
  });
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  return withAuth(async () => {
    const session = await ensurePermission('staff.manage');
    if (session.role !== 'super_admin') {
      return jsonError(403, 'SUPER_ADMIN_ONLY', 'Only a Super Admin can grant staff points.');
    }

    const body = await req.json().catch(() => ({}));
    const parsed = schema.safeParse(body);
    if (!parsed.success) return jsonError(400, 'VALIDATION', undefined, { issues: parsed.error.issues });

    const staff = await db.user.findUnique({ where: { id: params.id }, select: { id: true, username: true } });
    if (!staff) return jsonError(404, 'NOT_FOUND', 'Staff account not found.');

    const result = await db.$transaction(async (tx) =>
      applyStaffPointMovement({
        tx,
        staffId: params.id,
        amount: new Prisma.Decimal(parsed.data.amount),
        type: STAFF_POINT_TYPE.grant,
        actorId: session.sub,
        actorRole: session.role,
        reason: parsed.data.reason,
      }),
    );

    await recordActivity({
      actorId: session.sub,
      actorRole: session.role,
      action: 'STAFF_POINTS_GRANT',
      target: params.id,
      detail: `${staff.username}: +${parsed.data.amount} (${result.before.toFixed(2)} -> ${result.after.toFixed(2)})`,
      meta: {
        staffId: params.id,
        staffUsername: staff.username,
        amount: parsed.data.amount,
        balanceBefore: Number(result.before),
        balanceAfter: Number(result.after),
        reason: parsed.data.reason,
      },
    });

    return jsonOk({ ok: true, balance: { before: Number(result.before), after: Number(result.after) } });
  });
}

const multiplierSchema = z.object({
  // Nullable on purpose: null clears the per-staff override so the global
  // staff_balance_turnover_x applies again. 0 is a real value meaning "this
  // staff member's credits carry no turnover", which is NOT the same thing.
  turnoverMultiplier: z.coerce.number().min(0).max(1000).nullable(),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  return withAuth(async () => {
    const session = await ensurePermission('staff.manage');
    if (session.role !== 'super_admin') {
      return jsonError(403, 'SUPER_ADMIN_ONLY', 'Only a Super Admin can set a staff turnover multiplier.');
    }

    const body = await req.json().catch(() => ({}));
    const parsed = multiplierSchema.safeParse(body);
    if (!parsed.success) return jsonError(400, 'VALIDATION', undefined, { issues: parsed.error.issues });

    const staff = await db.user.findUnique({ where: { id: params.id }, select: { id: true, username: true } });
    if (!staff) return jsonError(404, 'NOT_FOUND', 'Staff account not found.');

    const value = parsed.data.turnoverMultiplier;
    // Upsert so a staff member who has never been granted points can still
    // have their multiplier configured ahead of time.
    await db.staffPointWallet.upsert({
      where: { staffId: params.id },
      update: { turnoverMultiplier: value },
      create: { staffId: params.id, balance: 0, turnoverMultiplier: value },
    });

    await recordActivity({
      actorId: session.sub,
      actorRole: session.role,
      action: 'STAFF_TURNOVER_MULTIPLIER_SET',
      target: params.id,
      detail: `${staff.username}: ${value == null ? 'cleared (global default applies)' : `${value}x`}`,
      meta: { staffId: params.id, staffUsername: staff.username, turnoverMultiplier: value },
    });

    return jsonOk({ ok: true, turnoverMultiplier: value });
  });
}
