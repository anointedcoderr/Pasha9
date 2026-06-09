// Built by Anointed Coder.
//
// Admin spin wheel segment manager. The spin engine picks rows by
// weight; the operator can mix coin payouts, bonus wallet credits,
// freespin tokens and consolation no-prize wedges.

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db/client';
import { withAuth, ensurePermission, recordActivity } from '@/lib/auth/guard';
import { jsonError, jsonOk } from '@/lib/auth/errors';

const PAYOUT_TYPES = ['coins', 'bonus', 'freebet', 'freespin', 'nothing'] as const;

const createSchema = z.object({
  label: z.string().trim().min(1).max(60),
  color: z.string().trim().max(20).default('#FFCC00'),
  weight: z.coerce.number().int().min(1).max(1_000_000).default(1),
  payoutType: z.enum(PAYOUT_TYPES).default('coins'),
  payoutAmount: z.coerce.number().int().min(0).max(10_000_000).default(0),
  turnoverX: z.coerce.number().min(0).max(50).default(0),
  position: z.coerce.number().int().min(0).max(99).default(0),
  isActive: z.boolean().default(true),
  tierId: z.string().trim().min(1).max(60).nullable().optional(),
});

const patchSchema = createSchema.partial();

export async function GET(req: NextRequest) {
  return withAuth(async () => {
    await ensurePermission('rewards.write');
    const url = new URL(req.url);
    const tierFilter = url.searchParams.get('tierId');
    const where = tierFilter === 'null'
      ? { tierId: null }
      : tierFilter
        ? { tierId: tierFilter }
        : {};
    const rows = await db.spinSegment.findMany({ where, orderBy: [{ position: 'asc' }], take: 200 });
    return jsonOk({
      segments: rows.map((s) => ({
        id: s.id,
        label: s.label,
        color: s.color,
        weight: s.weight,
        payoutType: s.payoutType,
        payoutAmount: s.payoutAmount,
        turnoverX: Number(s.turnoverX),
        position: s.position,
        isActive: s.isActive,
        tierId: s.tierId,
      })),
    });
  });
}

export async function POST(req: NextRequest) {
  return withAuth(async () => {
    const session = await ensurePermission('rewards.write');
    const body = await req.json().catch(() => ({}));
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) return jsonError(400, 'VALIDATION', undefined, { issues: parsed.error.issues });
    const row = await db.spinSegment.create({ data: parsed.data });
    await recordActivity({ actorId: session.sub, actorRole: session.role, action: 'SPIN_SEGMENT_CREATE', target: row.id });
    return jsonOk({ segment: row }, 201);
  });
}

export async function PATCH(req: NextRequest) {
  return withAuth(async () => {
    const session = await ensurePermission('rewards.write');
    const body = await req.json().catch(() => ({}));
    const idRaw = typeof body?.id === 'string' ? body.id : null;
    if (!idRaw) return jsonError(400, 'VALIDATION', 'id required');
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) return jsonError(400, 'VALIDATION', undefined, { issues: parsed.error.issues });
    const row = await db.spinSegment.update({ where: { id: idRaw }, data: parsed.data });
    await recordActivity({ actorId: session.sub, actorRole: session.role, action: 'SPIN_SEGMENT_PATCH', target: row.id });
    return jsonOk({ segment: row });
  });
}

export async function DELETE(req: NextRequest) {
  return withAuth(async () => {
    const session = await ensurePermission('rewards.write');
    const url = new URL(req.url);
    const id = url.searchParams.get('id');
    if (!id) return jsonError(400, 'VALIDATION', 'id required');
    await db.spinSegment.delete({ where: { id } });
    await recordActivity({ actorId: session.sub, actorRole: session.role, action: 'SPIN_SEGMENT_DELETE', target: id });
    return jsonOk({ deleted: true });
  });
}
