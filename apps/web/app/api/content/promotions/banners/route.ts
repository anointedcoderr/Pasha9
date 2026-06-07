// Built by Anointed Coder.

export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { db } from '@/lib/db/client';
import { jsonOk } from '@/lib/auth/errors';

export async function GET() {
  const banners = await db.promotionBanner.findMany({
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
    },
  });
  return jsonOk({ banners });
}
