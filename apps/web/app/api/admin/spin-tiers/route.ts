// Built by Anointed Coder.
//
// GET   /api/admin/spin-tiers          list tiers + segment counts
// POST  /api/admin/spin-tiers          create a tier
// PATCH /api/admin/spin-tiers          body { id, ...patch }
// DELETE /api/admin/spin-tiers?id=...  remove a tier (segments fall to tierId=null)

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db/client';
import { withAuth, ensurePermission, recordActivity } from '@/lib/auth/guard';
import { jsonError, jsonOk } from '@/lib/auth/errors';

const createSchema = z.object({
  key: z.string().trim().min(1).max(40).regex(/^[a-z0-9_-]+$/, 'lowercase letters, digits, _ or - only'),
  nameEn: z.string().trim().min(1).max(80),
  nameBn: z.string().trim().max(80).optional().nullable(),
  descriptionEn: z.string().trim().max(400).optional().nullable(),
  descriptionBn: z.string().trim().max(400).optional().nullable(),
  costPerSpin: z.coerce.number().int().min(0).max(1_000_000),
  freeSpinsPerDay: z.coerce.number().int().min(0).max(100),
  color: z.string().trim().max(20).default('#FFCC00'),
  iconUrl: z.string().trim().max(500).optional().nullable(),
  position: z.coerce.number().int().min(0).max(99),
  isActive: z.boolean().optional().default(true),
});

const patchSchema = z.object({ id: z.string().min(1) }).and(createSchema.partial().omit({ key: true }));

export async function GET() {
  return withAuth(async () => {
    await ensurePermission('rewards.write');
    const tiers = await db.spinWheelTier.findMany({
      orderBy: [{ position: 'asc' }],
      take: 100,
      include: { _count: { select: { segments: true, results: true } } },
    });
    return jsonOk({
      tiers: tiers.map((t) => ({
        id: t.id,
        key: t.key,
        nameEn: t.nameEn,
        nameBn: t.nameBn,
        descriptionEn: t.descriptionEn,
        descriptionBn: t.descriptionBn,
        costPerSpin: t.costPerSpin,
        freeSpinsPerDay: t.freeSpinsPerDay,
        color: t.color,
        iconUrl: t.iconUrl,
        position: t.position,
        isActive: t.isActive,
        segmentCount: t._count.segments,
        resultCount: t._count.results,
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
    const dup = await db.spinWheelTier.findUnique({ where: { key: parsed.data.key } });
    if (dup) return jsonError(409, 'DUPLICATE_TIER', `Tier key ${parsed.data.key} already exists.`);
    const tier = await db.spinWheelTier.create({ data: parsed.data });
    await recordActivity({ actorId: session.sub, actorRole: session.role, action: 'SPIN_TIER_CREATE', target: tier.id, meta: { key: tier.key } });
    return jsonOk({ tier }, 201);
  });
}

export async function PATCH(req: NextRequest) {
  return withAuth(async () => {
    const session = await ensurePermission('rewards.write');
    const body = await req.json().catch(() => ({}));
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) return jsonError(400, 'VALIDATION', undefined, { issues: parsed.error.issues });
    const { id, ...patch } = parsed.data;
    const existing = await db.spinWheelTier.findUnique({ where: { id } });
    if (!existing) return jsonError(404, 'NOT_FOUND');
    const tier = await db.spinWheelTier.update({ where: { id }, data: patch });
    await recordActivity({ actorId: session.sub, actorRole: session.role, action: 'SPIN_TIER_PATCH', target: id, meta: { changes: patch } });
    return jsonOk({ tier });
  });
}

export async function DELETE(req: NextRequest) {
  return withAuth(async () => {
    const session = await ensurePermission('rewards.write');
    const url = new URL(req.url);
    const id = url.searchParams.get('id');
    if (!id) return jsonError(400, 'VALIDATION', 'id required');
    const existing = await db.spinWheelTier.findUnique({ where: { id } });
    if (!existing) return jsonError(404, 'NOT_FOUND');
    // onDelete: SetNull on SpinSegment.tierId means segments survive
    // the tier removal as "untiered". SpinResult.tierId likewise.
    await db.spinWheelTier.delete({ where: { id } });
    await recordActivity({ actorId: session.sub, actorRole: session.role, action: 'SPIN_TIER_DELETE', target: id, meta: { key: existing.key } });
    return jsonOk({ ok: true });
  });
}
