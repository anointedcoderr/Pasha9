// Built by Anointed Coder.

export const dynamic = 'force-dynamic';

import { db } from '@/lib/db/client';
import { jsonOk } from '@/lib/auth/errors';

export async function GET() {
  const draws = await db.lottoDraw.findMany({
    where: { status: 'active' },
    orderBy: [{ position: 'asc' }, { createdAt: 'desc' }],
  });
  return jsonOk({ draws });
}
