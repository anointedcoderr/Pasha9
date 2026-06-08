// Built by Anointed Coder.
//
// GET  /api/admin/homepage-videos        list every row
// POST /api/admin/homepage-videos        create one
// PUT  /api/admin/homepage-videos        body { ids: string[] } atomic reorder

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db/client';
import { withAuth, ensurePermission, recordActivity } from '@/lib/auth/guard';
import { jsonError, jsonOk } from '@/lib/auth/errors';
import { parseYouTubeVideoId } from '@/lib/homepage/youtube';

const createSchema = z
  .object({
    titleEn: z.string().trim().min(1).max(160),
    titleBn: z.string().trim().max(160).optional().nullable(),
    subtitleEn: z.string().trim().max(280).optional().nullable(),
    subtitleBn: z.string().trim().max(280).optional().nullable(),
    sourceType: z.enum(['youtube', 'upload']),
    youtubeUrl: z.string().trim().max(500).optional().nullable(),
    videoUrl: z.string().trim().max(500).optional().nullable(),
    thumbnailUrl: z.string().trim().max(500).optional().nullable(),
    ctaUrl: z.string().trim().max(500).optional().nullable(),
    sortOrder: z.coerce.number().int().min(0).max(9999).optional().default(0),
    isActive: z.boolean().optional().default(true),
  })
  .refine(
    (d) => (d.sourceType === 'youtube' ? Boolean(d.youtubeUrl) : Boolean(d.videoUrl)),
    'A YouTube URL or an uploaded video URL is required for the selected source.',
  );

const reorderSchema = z.object({
  ids: z.array(z.string().min(1).max(60)).min(1).max(50),
});

export async function GET() {
  return withAuth(async () => {
    await ensurePermission('homepage.write');
    const rows = await db.homepageVideo.findMany({
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
    return jsonOk({ videos: rows });
  });
}

export async function POST(req: NextRequest) {
  return withAuth(async () => {
    const session = await ensurePermission('homepage.write');
    const body = await req.json().catch(() => ({}));
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) return jsonError(400, 'VALIDATION', undefined, { issues: parsed.error.issues });
    const data = parsed.data;

    let youtubeVideoId: string | null = null;
    if (data.sourceType === 'youtube' && data.youtubeUrl) {
      youtubeVideoId = parseYouTubeVideoId(data.youtubeUrl);
      if (!youtubeVideoId) return jsonError(400, 'INVALID_YOUTUBE_URL', 'Could not parse a YouTube video id from this URL.');
    }

    const max = (await db.homepageVideo.aggregate({ _max: { sortOrder: true } }))._max.sortOrder ?? 0;

    const created = await db.homepageVideo.create({
      data: {
        titleEn: data.titleEn,
        titleBn: data.titleBn ?? null,
        subtitleEn: data.subtitleEn ?? null,
        subtitleBn: data.subtitleBn ?? null,
        sourceType: data.sourceType,
        youtubeUrl: data.sourceType === 'youtube' ? data.youtubeUrl ?? null : null,
        youtubeVideoId,
        videoUrl: data.sourceType === 'upload' ? data.videoUrl ?? null : null,
        thumbnailUrl: data.thumbnailUrl ?? null,
        ctaUrl: data.ctaUrl ?? null,
        sortOrder: data.sortOrder ?? max + 10,
        isActive: data.isActive,
      },
    });

    await recordActivity({
      actorId: session.sub,
      actorRole: session.role,
      action: 'HOMEPAGE_VIDEO_CREATE',
      target: created.id,
      detail: created.titleEn,
    });

    return jsonOk({ video: created }, 201);
  });
}

export async function PUT(req: NextRequest) {
  return withAuth(async () => {
    const session = await ensurePermission('homepage.write');
    const body = await req.json().catch(() => ({}));
    const parsed = reorderSchema.safeParse(body);
    if (!parsed.success) return jsonError(400, 'VALIDATION', undefined, { issues: parsed.error.issues });
    const { ids } = parsed.data;
    const existing = await db.homepageVideo.findMany({ select: { id: true } });
    const knownIds = new Set(existing.map((r) => r.id));
    for (const id of ids) {
      if (!knownIds.has(id)) return jsonError(404, 'VIDEO_NOT_FOUND', `Video ${id} not found`);
    }
    await db.$transaction(
      ids.map((id, idx) =>
        db.homepageVideo.update({ where: { id }, data: { sortOrder: (idx + 1) * 10 } }),
      ),
    );
    await recordActivity({
      actorId: session.sub,
      actorRole: session.role,
      action: 'HOMEPAGE_VIDEO_REORDER',
      target: 'homepage_video',
      meta: { count: ids.length },
    });
    return jsonOk({ ok: true });
  });
}
