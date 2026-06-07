// Built by Anointed Coder.
//
// Admin review for manual referral claims.

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAuth, ensurePermission } from '@/lib/auth/guard';
import { getCurrentSession } from '@/lib/auth/rbac';
import { jsonError, jsonOk } from '@/lib/auth/errors';
import { reviewManualReferralClaim } from '@/lib/affiliate/settlement';

const schema = z.object({
  action: z.enum(['approve', 'reject']),
  adminNote: z.string().max(500).optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  return withAuth(async () => {
    await ensurePermission('users.read');
    const session = await getCurrentSession();
    if (!session) return jsonError(401, 'UNAUTHENTICATED');

    const body = await req.json().catch(() => ({}));
    const parsed = schema.safeParse(body);
    if (!parsed.success) return jsonError(400, 'VALIDATION', undefined, { issues: parsed.error.issues });

    try {
      const result = await reviewManualReferralClaim({
        claimId: params.id,
        action: parsed.data.action,
        actorId: session.sub,
        actorRole: session.role,
        adminNote: parsed.data.adminNote,
      });
      return jsonOk({ ok: true, ...result });
    } catch (err) {
      const code = err instanceof Error ? err.message : String(err);
      if (code === 'REFERRAL_CLAIM_NOT_FOUND') return jsonError(404, 'NOT_FOUND');
      if (code === 'REFERRAL_CLAIM_NOT_PENDING') return jsonError(409, 'NOT_PENDING');
      if (code === 'REFERRAL_PAYOUT_MISSING' || code === 'REFERRAL_RESERVED_COMMISSIONS_MISSING') {
        return jsonError(409, code);
      }
      console.error('[admin/referral-claims/review] failed', err);
      return jsonError(500, 'REVIEW_FAILED');
    }
  });
}
