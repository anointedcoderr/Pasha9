// Built by Anointed Coder.
//
// GET /api/content/homepage-videos
// Public deck of active homepage videos. Carousel order is sortOrder
// ascending then created-at; the public page renders them in that
// order. Empty array means the page renders its existing fallback.

export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { db } from '@/lib/db/client';
import { jsonOk } from '@/lib/auth/errors';

export async function GET() {
  const videos = await db.homepageVideo.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    select: {
      id: true,
      titleEn: true,
      titleBn: true,
      subtitleEn: true,
      subtitleBn: true,
      sourceType: true,
      youtubeVideoId: true,
      videoUrl: true,
      thumbnailUrl: true,
      ctaUrl: true,
      sortOrder: true,
    },
  });
  return jsonOk({ videos });
}
