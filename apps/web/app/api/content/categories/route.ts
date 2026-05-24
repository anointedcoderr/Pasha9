// Built by Anointed Coder.
//
// Public list of active game categories. Returned in display order
// (position asc, then nameEn). The public site consumes this for any
// category surface that wants to honour an admin-uploaded icon image.

export const dynamic = 'force-dynamic';

import { db } from '@/lib/db/client';
import { jsonOk } from '@/lib/auth/errors';

export const revalidate = 60;

export async function GET() {
  const categories = await db.gameCategory.findMany({
    where: { status: 'active' },
    orderBy: [{ position: 'asc' }, { nameEn: 'asc' }],
    select: {
      id: true,
      slug: true,
      nameBn: true,
      nameEn: true,
      iconKey: true,
      iconImageUrl: true,
      position: true,
    },
  });
  return jsonOk({ categories });
}
