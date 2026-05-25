// Built by Anointed Coder.

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db/client';
import { requireActiveUser } from '@/lib/auth/rbac';
import { withAuth, recordActivity } from '@/lib/auth/guard';
import { jsonError, jsonOk } from '@/lib/auth/errors';
import { rateLimit } from '@/lib/auth/rate-limit';

const schema = z.object({
  channel: z.string().trim().min(2).max(60).optional(),
  audience: z.string().trim().max(60).optional(),
  notes: z.string().trim().max(1000).optional(),
});

export async function POST(req: NextRequest) {
  return withAuth(async () => {
    const session = await requireActiveUser();
    const limit = rateLimit(`affiliate-apply:${session.sub}`, 3, 60_000);
    if (!limit.ok) return jsonError(429, 'RATE_LIMITED');

    const body = await req.json().catch(() => ({}));
    const parsed = schema.safeParse(body);
    if (!parsed.success) return jsonError(400, 'VALIDATION', undefined, { issues: parsed.error.issues });

    // If already approved or pending, return the existing record.
    const existing = await db.affiliateApplication.findUnique({ where: { userId: session.sub } });
    if (existing && existing.status !== 'rejected') {
      return jsonOk({ application: existing, alreadyApplied: true });
    }

    // Upsert so a rejected user can reapply with new info.
    const application = await db.affiliateApplication.upsert({
      where: { userId: session.sub },
      update: {
        status: 'pending',
        channel: parsed.data.channel,
        audience: parsed.data.audience,
        notes: parsed.data.notes,
        reviewerId: null,
        reviewedAt: null,
      },
      create: {
        userId: session.sub,
        status: 'pending',
        channel: parsed.data.channel,
        audience: parsed.data.audience,
        notes: parsed.data.notes,
      },
    });

    await recordActivity({
      actorId: session.sub,
      actorRole: session.role,
      action: 'AFFILIATE_APPLY',
      target: application.id,
      detail: parsed.data.channel ?? undefined,
    });

    return jsonOk({ application }, 201);
  });
}
