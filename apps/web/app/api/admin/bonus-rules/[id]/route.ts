// Built by Anointed Coder.

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { z } from 'zod';
import type { BonusType, ContentStatus, Prisma } from '@prisma/client';
import { db } from '@/lib/db/client';
import { withAuth, ensurePermission, recordActivity } from '@/lib/auth/guard';
import { jsonError, jsonOk } from '@/lib/auth/errors';

const ALLOWED_TYPES: BonusType[] = ['first_deposit', 'daily', 'weekly', 'referral', 'vip', 'invite', 'reload', 'manual', 'promo'];
const ALLOWED_STATUSES: ContentStatus[] = ['active', 'hidden', 'paused'];

const patchSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  type: z.enum(ALLOWED_TYPES as [BonusType, ...BonusType[]]).optional(),
  code: z.string().trim().min(1).max(60).nullable().optional(),
  amount: z.coerce.number().min(0).max(10_000_000).optional(),
  percentage: z.coerce.number().min(0).max(1000).optional(),
  minDeposit: z.coerce.number().min(0).max(10_000_000).optional(),
  maxBonus: z.coerce.number().min(0).max(10_000_000).optional(),
  turnoverX: z.coerce.number().min(0).max(100).optional(),
  validityDays: z.coerce.number().int().min(0).max(365).optional(),
  priority: z.coerce.number().int().min(0).max(1000).optional(),
  status: z.enum(ALLOWED_STATUSES as [ContentStatus, ...ContentStatus[]]).optional(),
  description: z.string().max(1000).nullable().optional(),
  startsAt: z.string().datetime().nullable().optional(),
  endsAt: z.string().datetime().nullable().optional(),
  meta: z.record(z.unknown()).nullable().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  return withAuth(async () => {
    const session = await ensurePermission('bonuses.write');
    const existing = await db.bonusRule.findUnique({ where: { id: params.id } });
    if (!existing) return jsonError(404, 'NOT_FOUND');

    const body = await req.json().catch(() => ({}));
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) return jsonError(400, 'VALIDATION', undefined, { issues: parsed.error.issues });
    const data = parsed.data;

    if (data.code && data.code !== existing.code) {
      const dup = await db.bonusRule.findUnique({ where: { code: data.code } });
      if (dup && dup.id !== existing.id) {
        return jsonError(409, 'CODE_TAKEN', `A rule with code "${data.code}" already exists.`);
      }
    }

    const updated = await db.bonusRule.update({
      where: { id: params.id },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.type !== undefined ? { type: data.type } : {}),
        ...(data.code !== undefined ? { code: data.code ?? null } : {}),
        ...(data.amount !== undefined ? { amount: data.amount } : {}),
        ...(data.percentage !== undefined ? { percentage: data.percentage } : {}),
        ...(data.minDeposit !== undefined ? { minDeposit: data.minDeposit } : {}),
        ...(data.maxBonus !== undefined ? { maxBonus: data.maxBonus } : {}),
        ...(data.turnoverX !== undefined ? { turnoverX: data.turnoverX } : {}),
        ...(data.validityDays !== undefined ? { validityDays: data.validityDays } : {}),
        ...(data.priority !== undefined ? { priority: data.priority } : {}),
        ...(data.status !== undefined ? { status: data.status } : {}),
        ...(data.description !== undefined ? { description: data.description } : {}),
        ...(data.startsAt !== undefined ? { startsAt: data.startsAt ? new Date(data.startsAt) : null } : {}),
        ...(data.endsAt !== undefined ? { endsAt: data.endsAt ? new Date(data.endsAt) : null } : {}),
        ...(data.meta !== undefined ? { meta: (data.meta ?? null) as Prisma.InputJsonValue } : {}),
      },
    });

    await recordActivity({
      actorId: session.sub,
      actorRole: session.role,
      action: 'BONUS_RULE_UPDATE',
      target: updated.id,
      detail: updated.name,
    });

    return jsonOk({ rule: updated });
  });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  return withAuth(async () => {
    const session = await ensurePermission('bonuses.write');
    const existing = await db.bonusRule.findUnique({
      where: { id: params.id },
      include: { _count: { select: { userBonuses: true } } },
    });
    if (!existing) return jsonError(404, 'NOT_FOUND');

    // Soft policy: if grants exist, refuse delete to preserve audit
    // trail. Admin can flip status to 'hidden' instead.
    if (existing._count.userBonuses > 0) {
      return jsonError(409, 'RULE_IN_USE', 'Rule has issued grants. Hide it instead of deleting to preserve audit history.');
    }

    await db.bonusRule.delete({ where: { id: params.id } });

    await recordActivity({
      actorId: session.sub,
      actorRole: session.role,
      action: 'BONUS_RULE_DELETE',
      target: params.id,
      detail: existing.name,
    });

    return jsonOk({ ok: true });
  });
}
