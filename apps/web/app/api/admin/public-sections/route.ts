// Built by Anointed Coder.
//
// GET /api/admin/public-sections?group=about|payment_display
//
// Lists PublicSection rows the operator can edit from the Phase G
// about / sponsor / public-payment-method admin pages. The Phase B
// /api/admin/homepage-sections endpoint already covers group=homepage;
// this endpoint extends the same surface to the rest of the groups.

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { db } from '@/lib/db/client';
import { withAuth, ensurePermission } from '@/lib/auth/guard';
import { jsonOk } from '@/lib/auth/errors';

const ALLOWED_GROUPS = new Set(['about', 'payment_display']);

export async function GET(req: NextRequest) {
  return withAuth(async () => {
    await ensurePermission('settings.write');
    const url = new URL(req.url);
    const group = (url.searchParams.get('group') ?? '').trim();
    const where = group && ALLOWED_GROUPS.has(group) ? { group } : { group: { in: Array.from(ALLOWED_GROUPS) } };
    const rows = await db.publicSection.findMany({
      where,
      orderBy: [{ group: 'asc' }, { position: 'asc' }, { titleEn: 'asc' }],
    });
    return jsonOk({ sections: rows });
  });
}
