// Built by Anointed Coder.

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db/client';
import { withAuth, ensurePermission, recordActivity } from '@/lib/auth/guard';
import { jsonOk } from '@/lib/auth/errors';

const createSchema = z.object({
  title: z.string().min(1).max(120),
  titleEn: z.string().max(120).optional().nullable(),
  subtitle: z.string().max(240).optional().nullable(),
  subtitleEn: z.string().max(240).optional().nullable(),
  imageUrl: z.string().max(500).optional().nullable(),
  link: z.string().max(500).optional().nullable(),
  ctaLabel: z.string().max(60).optional().nullable(),
  accent: z.enum(['gold', 'neon', 'mixed', 'royal', 'red']).default('gold'),
  position: z.coerce.number().int().min(0).max(99).default(0),
  status: z.enum(['active', 'hidden', 'paused']).default('active'),
});

export async function GET() {
  return withAuth(async () => {
    await ensurePermission('banners.write');
    const banners = await db.banner.findMany({ orderBy: [{ position: 'asc' }, { createdAt: 'desc' }] });
    return jsonOk({ banners });
  });
}

export async function POST(req: NextRequest) {
  return withAuth(async () => {
    const session = await ensurePermission('banners.write');
    const body = await req.json().catch(() => ({}));
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) return jsonOk({ ok: false, code: 'VALIDATION', issues: parsed.error.issues }, 400);
    const banner = await db.banner.create({ data: parsed.data });
    await recordActivity({ actorId: session.sub, actorRole: session.role, action: 'BANNER_CREATE', target: banner.id });
    return jsonOk({ banner }, 201);
  });
}
