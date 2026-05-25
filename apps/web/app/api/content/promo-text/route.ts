// Built by Anointed Coder.
//
// Public promo marquee feed. ISR was masking admin edits behind a 30s
// cache, so M2A switches to always-fresh (revalidate = 0). The
// PromoTicker component now also fetches with cache: 'no-store' so
// admin edits land within one client tick.

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

import { db } from '@/lib/db/client';
import { jsonOk } from '@/lib/auth/errors';

export async function GET() {
  const items = await db.promoText.findMany({
    where: { status: 'active' },
    orderBy: [{ position: 'asc' }],
  });
  return jsonOk({ items });
}
