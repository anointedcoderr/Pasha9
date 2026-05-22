// Built by Anointed Coder.

export const dynamic = 'force-dynamic';

import { db } from '@/lib/db/client';
import { jsonOk } from '@/lib/auth/errors';

export const revalidate = 30;

export async function GET() {
  const items = await db.promoText.findMany({
    where: { status: 'active' },
    orderBy: [{ position: 'asc' }],
  });
  return jsonOk({ items });
}
