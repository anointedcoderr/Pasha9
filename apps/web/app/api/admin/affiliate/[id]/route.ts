// Built by Anointed Coder.

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db/client';
import { withAuth, ensurePermission, recordActivity } from '@/lib/auth/guard';
import { jsonError, jsonOk } from '@/lib/auth/errors';

const patchSchema = z.object({
  action: z.enum(['approve', 'reject', 'reset', 'suspend', 'activate']),
  tierId: z.string().optional(),
  notes: z.string().max(500).optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  return withAuth(async () => {
    const session = await ensurePermission('affiliate.write');
    const body = await req.json().catch(() => ({}));
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) return jsonError(400, 'VALIDATION', undefined, { issues: parsed.error.issues });

    const application = await db.affiliateApplication.findUnique({ where: { id: params.id }, include: { user: true } });
    if (!application) return jsonError(404, 'NOT_FOUND', 'Application not found');

    const userId = application.userId;
    const ops: Promise<unknown>[] = [];
    let newStatus = application.status;
    let action = '';

    switch (parsed.data.action) {
      case 'approve':
        newStatus = 'approved';
        action = 'AFFILIATE_APPROVE';
        ops.push(
          db.affiliateApplication.update({
            where: { id: params.id },
            data: { status: 'approved', reviewerId: session.sub, reviewedAt: new Date() },
          }),
          db.user.update({
            where: { id: userId },
            data: { isAffiliate: true, affiliateTierId: parsed.data.tierId ?? application.user.affiliateTierId ?? undefined },
          }),
        );
        break;
      case 'reject':
        newStatus = 'rejected';
        action = 'AFFILIATE_REJECT';
        ops.push(
          db.affiliateApplication.update({
            where: { id: params.id },
            data: { status: 'rejected', reviewerId: session.sub, reviewedAt: new Date(), notes: parsed.data.notes ?? application.notes },
          }),
          db.user.update({
            where: { id: userId },
            data: { isAffiliate: false },
          }),
        );
        break;
      case 'reset':
        newStatus = 'pending';
        action = 'AFFILIATE_RESET';
        ops.push(
          db.affiliateApplication.update({
            where: { id: params.id },
            data: { status: 'pending', reviewerId: null, reviewedAt: null },
          }),
        );
        break;
      case 'suspend':
        action = 'AFFILIATE_SUSPEND';
        ops.push(
          db.user.update({ where: { id: userId }, data: { isAffiliate: false } }),
        );
        break;
      case 'activate':
        action = 'AFFILIATE_ACTIVATE';
        ops.push(
          db.user.update({
            where: { id: userId },
            data: {
              isAffiliate: true,
              affiliateTierId: parsed.data.tierId ?? application.user.affiliateTierId ?? undefined,
            },
          }),
        );
        break;
    }

    await db.$transaction(ops as never);

    await recordActivity({
      actorId: session.sub,
      actorRole: session.role,
      action,
      target: userId,
      detail: `application ${application.id} now ${newStatus}`,
    });

    return jsonOk({ ok: true, action: parsed.data.action, status: newStatus });
  });
}
