// Built by Anointed Coder.
//
// Public reward store payload. Includes admin-uploaded image/banner,
// localised title + description (BN falls back to EN), and the
// rewardType so the public claim modal knows whether to show the
// mobile-recharge operator picker or the physical-gift address form.

export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { db } from '@/lib/db/client';
import { jsonOk } from '@/lib/auth/errors';

export async function GET() {
  const items = await db.rewardItem.findMany({
    where: { status: 'active' },
    orderBy: [{ position: 'asc' }, { createdAt: 'desc' }],
  });
  return jsonOk({
    items: items.map((i) => ({
      id: i.id,
      title: i.title,
      titleBn: i.titleBn,
      description: i.description,
      descriptionBn: i.descriptionBn,
      cost: i.cost,
      category: i.category,
      rewardType: i.rewardType,
      accent: i.accent,
      imageUrl: i.imageUrl,
      bannerUrl: i.bannerUrl,
      shortInstructionEn: i.shortInstructionEn,
      shortInstructionBn: i.shortInstructionBn,
      position: i.position,
    })),
  });
}
