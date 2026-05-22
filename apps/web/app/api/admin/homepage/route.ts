// Built by Anointed Coder.

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db/client';
import { withAuth, ensurePermission, recordActivity } from '@/lib/auth/guard';
import { jsonError, jsonOk } from '@/lib/auth/errors';

const upsertSchema = z.object({
  section: z.string().min(1).max(60),
  titleBn: z.string().max(200).optional().nullable(),
  titleEn: z.string().max(200).optional().nullable(),
  bodyBn: z.string().max(4000).optional().nullable(),
  bodyEn: z.string().max(4000).optional().nullable(),
  imageUrl: z.string().max(500).optional().nullable(),
  link: z.string().max(500).optional().nullable(),
});

export async function GET() {
  return withAuth(async () => {
    await ensurePermission('homepage.write');
    const sections = await db.homepageContent.findMany();
    return jsonOk({ sections });
  });
}

export async function PUT(req: NextRequest) {
  return withAuth(async () => {
    const session = await ensurePermission('homepage.write');
    const body = await req.json().catch(() => ({}));
    const parsed = upsertSchema.safeParse(body);
    if (!parsed.success) return jsonError(400, 'VALIDATION', undefined, { issues: parsed.error.issues });
    const { section, ...rest } = parsed.data;
    const row = await db.homepageContent.upsert({
      where: { section },
      update: rest,
      create: { section, ...rest },
    });
    await recordActivity({ actorId: session.sub, actorRole: session.role, action: 'HOMEPAGE_UPDATE', target: row.section });
    return jsonOk({ section: row });
  });
}
