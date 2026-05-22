// Built by Anointed Coder.

export const dynamic = 'force-dynamic';

import { db } from '@/lib/db/client';
import { jsonOk } from '@/lib/auth/errors';

export const revalidate = 30; // seconds

export async function GET() {
  const banners = await db.banner.findMany({
    where: { status: 'active' },
    orderBy: [{ position: 'asc' }, { createdAt: 'desc' }],
  });
  return jsonOk({ banners });
}
