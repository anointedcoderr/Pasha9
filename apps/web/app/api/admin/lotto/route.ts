// Built by Anointed Coder.

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db/client';
import { withAuth, ensurePermission, recordActivity } from '@/lib/auth/guard';
import { jsonError, jsonOk } from '@/lib/auth/errors';

const createSchema = z.object({
  name: z.string().min(2).max(80),
  schedule: z.string().max(80).optional().nullable(),
  drawsAt: z.string().datetime().optional().nullable(),
  digitsCount: z.coerce.number().int().min(1).max(10).default(4),
  ticketPrice: z.coerce.number().min(0).max(1_000_000).default(5),
  prizePool: z.coerce.number().min(0).max(1_000_000_000).default(0),
  accent: z.enum(['yellow', 'blue', 'red', 'royal']).default('yellow'),
  position: z.coerce.number().int().min(0).max(99).default(0),
  status: z.enum(['active', 'hidden', 'paused']).default('active'),
});

export async function GET() {
  return withAuth(async () => {
    await ensurePermission('lotto.write');
    const draws = await db.lottoDraw.findMany({ orderBy: [{ position: 'asc' }, { createdAt: 'desc' }] });
    return jsonOk({ draws });
  });
}

export async function POST(req: NextRequest) {
  return withAuth(async () => {
    const session = await ensurePermission('lotto.write');
    const body = await req.json().catch(() => ({}));
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) return jsonError(400, 'VALIDATION', undefined, { issues: parsed.error.issues });
    const draw = await db.lottoDraw.create({
      data: {
        ...parsed.data,
        drawsAt: parsed.data.drawsAt ? new Date(parsed.data.drawsAt) : null,
      },
    });
    await recordActivity({
      actorId: session.sub,
      actorRole: session.role,
      action: 'LOTTO_CREATE',
      target: draw.id,
    });
    return jsonOk({ draw }, 201);
  });
}
