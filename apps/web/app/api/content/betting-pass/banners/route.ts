// Built by Anointed Coder.
//
// GET /api/content/betting-pass/banners
//
// Public list of active Betting Pass hero banners ordered for the
// carousel. Empty array when no operator-curated rows exist; the
// public /betting-pass page renders its built-in hero in that case
// so the surface never looks broken on a fresh database.

export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { db } from '@/lib/db/client';
import { jsonOk } from '@/lib/auth/errors';

export async function GET() {
  const banners = await db.bettingPassBanner.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    select: {
      id: true,
      titleEn: true,
      titleBn: true,
      subtitleEn: true,
      subtitleBn: true,
      imageUrl: true,
      ctaUrl: true,
      sortOrder: true,
      showOverlay: true,
      overlayPosition: true,
    },
  });
  return jsonOk({ banners });
}
