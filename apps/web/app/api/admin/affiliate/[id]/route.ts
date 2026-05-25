// Built by Anointed Coder.

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db/client';
import { withAuth, ensurePermission, recordActivity } from '@/lib/auth/guard';
import { jsonError, jsonOk } from '@/lib/auth/errors';

const patchSchema = z.object({
  action: z.enum(['approve', 'reject', 'reset', 'suspend', 'activate', 'assign_tier']),
  tierId: z.string().optional(),
  notes: z.string().max(500).optional(),
});

// Returns the lowest-position active tier so we never leave an
// approved affiliate without a tier (which silently zeroes their
// commissions on every deposit). When no active tier exists, the
// caller surfaces NO_TIER_AVAILABLE so admin knows to create one.
async function pickDefaultTier(): Promise<{ id: string; name: string } | null> {
  const tier = await db.commissionTier.findFirst({
    where: { status: 'active' },
    orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
    select: { id: true, name: true },
  });
  return tier ?? null;
}

async function resolveTierForActivation(application: {
  user: { affiliateTierId: string | null };
}, providedTierId: string | undefined): Promise<{ tierId: string | null; tierName: string | null; defaulted: boolean; missing: boolean }> {
  if (providedTierId) {
    const t = await db.commissionTier.findUnique({ where: { id: providedTierId }, select: { id: true, name: true } });
    if (!t) return { tierId: null, tierName: null, defaulted: false, missing: true };
    return { tierId: t.id, tierName: t.name, defaulted: false, missing: false };
  }
  if (application.user.affiliateTierId) {
    const t = await db.commissionTier.findUnique({ where: { id: application.user.affiliateTierId }, select: { id: true, name: true } });
    if (t) return { tierId: t.id, tierName: t.name, defaulted: false, missing: false };
  }
  const fallback = await pickDefaultTier();
  if (!fallback) return { tierId: null, tierName: null, defaulted: false, missing: true };
  return { tierId: fallback.id, tierName: fallback.name, defaulted: true, missing: false };
}

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
    let assignedTier: { id: string | null; name: string | null; defaulted: boolean } = { id: null, name: null, defaulted: false };

    switch (parsed.data.action) {
      case 'approve': {
        const t = await resolveTierForActivation(application, parsed.data.tierId);
        if (t.missing) return jsonError(400, 'NO_TIER_AVAILABLE', 'No active commission tier exists. Create at least one tier before approving affiliates.');
        assignedTier = { id: t.tierId, name: t.tierName, defaulted: t.defaulted };
        newStatus = 'approved';
        action = 'AFFILIATE_APPROVE';
        ops.push(
          db.affiliateApplication.update({
            where: { id: params.id },
            data: { status: 'approved', reviewerId: session.sub, reviewedAt: new Date() },
          }),
          db.user.update({
            where: { id: userId },
            data: { isAffiliate: true, affiliateTierId: t.tierId },
          }),
        );
        break;
      }
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
      case 'activate': {
        const t = await resolveTierForActivation(application, parsed.data.tierId);
        if (t.missing) return jsonError(400, 'NO_TIER_AVAILABLE', 'No active commission tier exists. Create at least one tier before activating affiliates.');
        assignedTier = { id: t.tierId, name: t.tierName, defaulted: t.defaulted };
        action = 'AFFILIATE_ACTIVATE';
        ops.push(
          db.user.update({
            where: { id: userId },
            data: { isAffiliate: true, affiliateTierId: t.tierId },
          }),
        );
        break;
      }
      case 'assign_tier': {
        if (!parsed.data.tierId) return jsonError(400, 'TIER_REQUIRED', 'tierId is required for assign_tier action.');
        const t = await db.commissionTier.findUnique({ where: { id: parsed.data.tierId }, select: { id: true, name: true } });
        if (!t) return jsonError(404, 'TIER_NOT_FOUND', 'The selected tier does not exist.');
        assignedTier = { id: t.id, name: t.name, defaulted: false };
        action = 'AFFILIATE_TIER_ASSIGN';
        ops.push(
          db.user.update({ where: { id: userId }, data: { affiliateTierId: t.id } }),
        );
        break;
      }
    }

    await db.$transaction(ops as never);

    await recordActivity({
      actorId: session.sub,
      actorRole: session.role,
      action,
      target: userId,
      detail: assignedTier.id
        ? `application ${application.id} now ${newStatus} . tier=${assignedTier.name}${assignedTier.defaulted ? ' (defaulted)' : ''}`
        : `application ${application.id} now ${newStatus}`,
      meta: { applicationId: application.id, assignedTierId: assignedTier.id, defaulted: assignedTier.defaulted },
    });

    return jsonOk({
      ok: true,
      action: parsed.data.action,
      status: newStatus,
      assignedTier: assignedTier.id ? assignedTier : null,
    });
  });
}
