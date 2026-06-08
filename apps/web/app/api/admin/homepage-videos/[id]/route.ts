// Built by Anointed Coder.
//
// PATCH  /api/admin/homepage-videos/[id]   edit fields
// DELETE /api/admin/homepage-videos/[id]   delete

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db/client';
import { withAuth, ensurePermission, recordActivity } from '@/lib/auth/guard';
import { jsonError, jsonOk } from '@/lib/auth/errors';
import { parseYouTubeVideoId } from '@/lib/homepage/youtube';

const patchSchema = z.object({
  titleEn: z.string().trim().min(1).max(160).optional(),
  titleBn: z.string().trim().max(160).optional().nullable(),
  subtitleEn: z.string().trim().max(280).optional().nullable(),
  subtitleBn: z.string().trim().max(280).optional().nullable(),
  sourceType: z.enum(['youtube', 'upload']).optional(),
  youtubeUrl: z.string().trim().max(500).optional().nullable(),
  videoUrl: z.string().trim().max(500).optional().nullable(),
  thumbnailUrl: z.string().trim().max(500).optional().nullable(),
  ctaUrl: z.string().trim().max(500).optional().nullable(),
  sortOrder: z.coerce.number().int().min(0).max(9999).optional(),
  isActive: z.boolean().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  return withAuth(async () => {
    const session = await ensurePermission('homepage.write');
    const existing = await db.homepageVideo.findUnique({ where: { id: params.id } });
    if (!existing) return jsonError(404, 'NOT_FOUND');
    const body = await req.json().catch(() => ({}));
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) return jsonError(400, 'VALIDATION', undefined, { issues: parsed.error.issues });
    const d = parsed.data;

    let youtubeVideoId: string | null | undefined;
    if (d.youtubeUrl !== undefined) {
      if (d.youtubeUrl) {
        youtubeVideoId = parseYouTubeVideoId(d.youtubeUrl);
        if (!youtubeVideoId) return jsonError(400, 'INVALID_YOUTUBE_URL', 'Could not parse a YouTube video id from this URL.');
      } else {
        youtubeVideoId = null;
      }
    }

    const updated = await db.homepageVideo.update({
      where: { id: params.id },
      data: {
        ...(d.titleEn !== undefined ? { titleEn: d.titleEn } : {}),
        ...(d.titleBn !== undefined ? { titleBn: d.titleBn } : {}),
        ...(d.subtitleEn !== undefined ? { subtitleEn: d.subtitleEn } : {}),
        ...(d.subtitleBn !== undefined ? { subtitleBn: d.subtitleBn } : {}),
        ...(d.sourceType !== undefined ? { sourceType: d.sourceType } : {}),
        ...(d.youtubeUrl !== undefined ? { youtubeUrl: d.youtubeUrl } : {}),
        ...(youtubeVideoId !== undefined ? { youtubeVideoId } : {}),
        ...(d.videoUrl !== undefined ? { videoUrl: d.videoUrl } : {}),
        ...(d.thumbnailUrl !== undefined ? { thumbnailUrl: d.thumbnailUrl } : {}),
        ...(d.ctaUrl !== undefined ? { ctaUrl: d.ctaUrl } : {}),
        ...(d.sortOrder !== undefined ? { sortOrder: d.sortOrder } : {}),
        ...(d.isActive !== undefined ? { isActive: d.isActive } : {}),
      },
    });

    await recordActivity({
      actorId: session.sub,
      actorRole: session.role,
      action: 'HOMEPAGE_VIDEO_PATCH',
      target: updated.id,
      detail: updated.titleEn,
    });

    return jsonOk({ video: updated });
  });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  return withAuth(async () => {
    const session = await ensurePermission('homepage.write');
    const existing = await db.homepageVideo.findUnique({ where: { id: params.id } });
    if (!existing) return jsonError(404, 'NOT_FOUND');
    await db.homepageVideo.delete({ where: { id: params.id } });
    await recordActivity({
      actorId: session.sub,
      actorRole: session.role,
      action: 'HOMEPAGE_VIDEO_DELETE',
      target: params.id,
      detail: existing.titleEn,
    });
    return jsonOk({ ok: true });
  });
}
