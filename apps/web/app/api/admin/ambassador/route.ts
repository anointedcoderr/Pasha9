// Built by Anointed Coder.

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db/client';
import { withAuth, ensurePermission, recordActivity } from '@/lib/auth/guard';
import { jsonError, jsonOk } from '@/lib/auth/errors';

const KEYS = [
  'ambassador_name',
  'ambassador_caption',
  'ambassador_image_url',
  'ambassador_active',
  'video_promo_title',
  'video_promo_caption',
  'video_promo_url',
  'video_promo_poster_url',
] as const;

type Key = (typeof KEYS)[number];

const schema = z.object({
  ambassador_name: z.string().max(120).optional(),
  ambassador_caption: z.string().max(500).optional(),
  ambassador_image_url: z.string().max(500).optional(),
  ambassador_active: z.union([z.boolean(), z.string()]).optional(),
  video_promo_title: z.string().max(120).optional(),
  video_promo_caption: z.string().max(500).optional(),
  video_promo_url: z.string().max(500).optional(),
  video_promo_poster_url: z.string().max(500).optional(),
});

export async function GET() {
  return withAuth(async () => {
    await ensurePermission('ambassador.write');
    const rows = await db.systemSetting.findMany({ where: { key: { in: [...KEYS] } } });
    const values: Record<Key, string> = {
      ambassador_name: '',
      ambassador_caption: '',
      ambassador_image_url: '',
      ambassador_active: 'true',
      video_promo_title: '',
      video_promo_caption: '',
      video_promo_url: '',
      video_promo_poster_url: '',
    };
    for (const r of rows) {
      if ((KEYS as readonly string[]).includes(r.key)) values[r.key as Key] = r.value;
    }
    return jsonOk({ values });
  });
}

export async function PUT(req: NextRequest) {
  return withAuth(async () => {
    const session = await ensurePermission('ambassador.write');
    const body = await req.json().catch(() => ({}));
    const parsed = schema.safeParse(body);
    if (!parsed.success) return jsonError(400, 'VALIDATION', undefined, { issues: parsed.error.issues });

    const ops = [] as Promise<unknown>[];
    for (const key of KEYS) {
      const value = parsed.data[key];
      if (value === undefined) continue;
      const str = typeof value === 'boolean' ? (value ? 'true' : 'false') : value;
      ops.push(
        db.systemSetting.upsert({
          where: { key },
          update: { value: str },
          create: { key, value: str, type: key === 'ambassador_active' ? 'boolean' : 'string', category: 'content' },
        }),
      );
    }
    await db.$transaction(ops as never);
    await recordActivity({
      actorId: session.sub,
      actorRole: session.role,
      action: 'AMBASSADOR_UPDATE',
      target: 'ambassador',
    });
    return jsonOk({ ok: true });
  });
}
