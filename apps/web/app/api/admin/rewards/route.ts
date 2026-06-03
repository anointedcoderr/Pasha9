// Built by Anointed Coder.

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db/client';
import { withAuth, ensurePermission, recordActivity } from '@/lib/auth/guard';
import { jsonError, jsonOk } from '@/lib/auth/errors';

const createSchema = z.object({
  title: z.string().min(2).max(120),
  titleBn: z.string().max(120).optional().nullable(),
  description: z.string().max(500).optional().nullable(),
  descriptionBn: z.string().max(500).optional().nullable(),
  cost: z.coerce.number().int().min(0).max(100_000_000).default(1000),
  category: z.enum(['recharge', 'spin', 'bet', 'physical', 'misc']).default('misc'),
  rewardType: z.enum(['recharge', 'physical', 'digital']).default('digital'),
  accent: z.enum(['yellow', 'blue', 'red', 'green']).default('yellow'),
  imageUrl: z.string().trim().max(500).optional().nullable(),
  bannerUrl: z.string().trim().max(500).optional().nullable(),
  shortInstructionEn: z.string().max(1000).optional().nullable(),
  shortInstructionBn: z.string().max(1000).optional().nullable(),
  position: z.coerce.number().int().min(0).max(99).default(0),
  status: z.enum(['active', 'hidden', 'paused']).default('active'),
});

export async function GET() {
  return withAuth(async () => {
    await ensurePermission('rewards.write');
    const items = await db.rewardItem.findMany({ orderBy: [{ position: 'asc' }, { createdAt: 'desc' }] });
    return jsonOk({ items });
  });
}

export async function POST(req: NextRequest) {
  return withAuth(async () => {
    const session = await ensurePermission('rewards.write');
    const body = await req.json().catch(() => ({}));
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) return jsonError(400, 'VALIDATION', undefined, { issues: parsed.error.issues });
    const item = await db.rewardItem.create({ data: parsed.data });
    await recordActivity({ actorId: session.sub, actorRole: session.role, action: 'REWARD_CREATE', target: item.id });
    return jsonOk({ item }, 201);
  });
}
