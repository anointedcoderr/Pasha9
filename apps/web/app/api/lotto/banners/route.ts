// Built by Anointed Coder.
//
// Public list of active Lotto banners, ordered by sortOrder. Powers
// the carousel at the top of /lotto. No auth required - this surface
// is part of the public page chrome.

export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { db } from '@/lib/db/client';
import { jsonOk } from '@/lib/auth/errors';

export async function GET() {
  const rows = await db.lottoBanner.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    take: 20,
  });
  return jsonOk({
    banners: rows.map((b) => ({
      id: b.id,
      kind: b.kind,
      imageUrl: b.imageUrl,
      videoUrl: b.videoUrl,
      posterUrl: b.posterUrl,
      titleEn: b.titleEn,
      titleBn: b.titleBn,
      ctaUrl: b.ctaUrl,
      autoplay: b.autoplay,
      muted: b.muted,
      loop: b.loop,
      sortOrder: b.sortOrder,
    })),
  });
}
