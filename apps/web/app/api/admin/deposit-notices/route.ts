// Built by Anointed Coder.
//
// GET  /api/admin/deposit-notices              list rows
// POST /api/admin/deposit-notices              create new row
//
// The master enable flag lives in SystemSetting 'deposit_notice_enabled'
// and is toggled via /api/admin/deposit-notices/settings (PATCH).

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAuth, ensurePermission, recordActivity } from '@/lib/auth/guard';
import { getCurrentSession } from '@/lib/auth/rbac';
import { jsonError, jsonOk } from '@/lib/auth/errors';
import { db } from '@/lib/db/client';

const createSchema = z.object({
  titleEn: z.string().trim().min(1).max(200),
  titleBn: z.string().trim().max(200).nullable().optional(),
  bodyEn: z.string().trim().min(1).max(4000),
  bodyBn: z.string().trim().max(4000).nullable().optional(),
  ctaLabelEn: z.string().trim().min(1).max(60).default('I understand'),
  ctaLabelBn: z.string().trim().max(60).nullable().optional(),
  position: z.number().int().min(0).max(9999).optional(),
  isEnabled: z.boolean().optional(),
});

export async function GET() {
  return withAuth(async () => {
    await ensurePermission('settings.write');
    const [rows, flag] = await Promise.all([
      db.depositNotice.findMany({ orderBy: [{ position: 'asc' }, { updatedAt: 'desc' }] }),
      db.systemSetting.findUnique({ where: { key: 'deposit_notice_enabled' } }),
    ]);
    return jsonOk({
      notices: rows,
      globalEnabled: (flag?.value ?? 'false').toLowerCase() === 'true',
    });
  });
}

export async function POST(req: NextRequest) {
  return withAuth(async () => {
    await ensurePermission('settings.write');
    const claims = await getCurrentSession();
    if (!claims) return jsonError(401, 'UNAUTHENTICATED');

    const body = await req.json().catch(() => ({}));
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) return jsonError(400, 'VALIDATION', undefined, { issues: parsed.error.issues });

    const next = ((await db.depositNotice.aggregate({ _max: { position: true } }))._max.position ?? 0) + 10;
    const row = await db.depositNotice.create({
      data: {
        titleEn: parsed.data.titleEn,
        titleBn: parsed.data.titleBn ?? null,
        bodyEn: parsed.data.bodyEn,
        bodyBn: parsed.data.bodyBn ?? null,
        ctaLabelEn: parsed.data.ctaLabelEn,
        ctaLabelBn: parsed.data.ctaLabelBn ?? null,
        position: parsed.data.position ?? next,
        isEnabled: parsed.data.isEnabled ?? false,
      },
    });

    await recordActivity({
      actorId: claims.sub,
      actorRole: claims.role,
      action: 'DEPOSIT_NOTICE_CREATE',
      target: row.id,
      meta: { titleEn: row.titleEn, isEnabled: row.isEnabled },
    });

    return jsonOk({ notice: row }, 201);
  });
}
