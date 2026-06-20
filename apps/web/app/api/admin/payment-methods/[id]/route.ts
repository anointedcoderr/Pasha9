// Built by Anointed Coder.

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db/client';
import { withAuth, ensurePermission, recordActivity } from '@/lib/auth/guard';
import { jsonError, jsonOk } from '@/lib/auth/errors';

const updateSchema = z.object({
  name: z.string().trim().min(1).max(60).optional(),
  type: z.enum(['mobile', 'bank', 'crypto']).optional(),
  status: z.enum(['active', 'hidden', 'paused']).optional(),
  number: z.string().trim().min(1).max(120).optional(),
  instruction: z.string().trim().min(1).max(2000).optional(),
  instructionBn: z.string().trim().max(2000).optional().nullable(),
  payoutInstruction: z.string().trim().max(2000).optional().nullable(),
  payoutInstructionBn: z.string().trim().max(2000).optional().nullable(),
  iconUrl: z.string().trim().max(500).optional().nullable(),
  bannerUrl: z.string().trim().max(500).optional().nullable(),
  position: z.coerce.number().int().min(0).max(99).optional(),
  depositEnabled: z.boolean().optional(),
  payoutEnabled: z.boolean().optional(),
  minDeposit: z.coerce.number().min(0).max(10_000_000).optional().nullable(),
  maxDeposit: z.coerce.number().min(0).max(10_000_000).optional().nullable(),
  minWithdrawal: z.coerce.number().min(0).max(10_000_000).optional().nullable(),
  maxWithdrawal: z.coerce.number().min(0).max(10_000_000).optional().nullable(),
  badgeLabelEn: z.string().trim().max(24).optional().nullable(),
  badgeLabelBn: z.string().trim().max(24).optional().nullable(),
  badgeEnabled: z.boolean().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  return withAuth(async () => {
    const session = await ensurePermission('settings.write');
    const body = await req.json().catch(() => ({}));
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) return jsonError(400, 'VALIDATION', undefined, { issues: parsed.error.issues });
    const method = await db.paymentMethod.update({ where: { id: params.id }, data: parsed.data });
    await recordActivity({
      actorId: session.sub,
      actorRole: session.role,
      action: 'PAYMENT_METHOD_UPDATE',
      target: method.id,
    });
    return jsonOk({ method });
  });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  return withAuth(async () => {
    const session = await ensurePermission('settings.write');
    await db.paymentMethod.delete({ where: { id: params.id } });
    await recordActivity({
      actorId: session.sub,
      actorRole: session.role,
      action: 'PAYMENT_METHOD_DELETE',
      target: params.id,
    });
    return jsonOk({ deleted: true });
  });
}
