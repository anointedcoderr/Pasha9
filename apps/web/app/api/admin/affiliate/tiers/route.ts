// Built by Anointed Coder.

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db/client';
import { withAuth, ensurePermission, recordActivity } from '@/lib/auth/guard';
import { jsonError, jsonOk } from '@/lib/auth/errors';

const createSchema = z.object({
  name: z.string().trim().min(2).max(60),
  description: z.string().trim().max(500).optional().nullable(),
  level1Pct: z.coerce.number().min(0).max(100),
  level2Pct: z.coerce.number().min(0).max(100),
  level3Pct: z.coerce.number().min(0).max(100),
  minActiveReferrals: z.coerce.number().int().min(0).max(100000).default(0),
  minMonthlyVolume: z.coerce.number().min(0).max(1_000_000_000).default(0),
  position: z.coerce.number().int().min(0).max(99).default(0),
  status: z.enum(['active', 'hidden', 'paused']).default('active'),
});

export async function GET() {
  return withAuth(async () => {
    await ensurePermission('affiliate.read');
    const tiers = await db.commissionTier.findMany({
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
    });
    return jsonOk({ tiers });
  });
}

export async function POST(req: NextRequest) {
  return withAuth(async () => {
    const session = await ensurePermission('affiliate.tiers.write');
    const body = await req.json().catch(() => ({}));
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) return jsonError(400, 'VALIDATION', undefined, { issues: parsed.error.issues });
    const tier = await db.commissionTier.create({
      data: {
        ...parsed.data,
        description: parsed.data.description ?? null,
      },
    });
    await recordActivity({
      actorId: session.sub,
      actorRole: session.role,
      action: 'COMMISSION_TIER_CREATE',
      target: tier.id,
    });
    return jsonOk({ tier }, 201);
  });
}
