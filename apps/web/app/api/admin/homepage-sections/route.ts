// Built by Anointed Coder.
//
// GET /api/admin/homepage-sections
//
// Lists every PublicSection row in group='homepage' for the
// /admin/homepage-sections editor. Read-only listing; the per-row
// PATCH lives at /api/admin/homepage-sections/[id].

export const dynamic = 'force-dynamic';

import { withAuth, ensurePermission } from '@/lib/auth/guard';
import { jsonOk } from '@/lib/auth/errors';
import { db } from '@/lib/db/client';

export async function GET() {
  return withAuth(async () => {
    await ensurePermission('homepage.write');
    const rows = await db.publicSection.findMany({
      where: { group: 'homepage' },
      orderBy: [{ position: 'asc' }, { titleEn: 'asc' }],
    });
    return jsonOk({ sections: rows });
  });
}
