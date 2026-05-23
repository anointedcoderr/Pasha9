// Built by Anointed Coder.

export const dynamic = 'force-dynamic';

import { db } from '@/lib/db/client';
import { jsonOk } from '@/lib/auth/errors';

export async function GET() {
  const items = await db.rewardItem.findMany({
    where: { status: 'active' },
    orderBy: [{ position: 'asc' }, { createdAt: 'desc' }],
  });
  return jsonOk({ items });
}
