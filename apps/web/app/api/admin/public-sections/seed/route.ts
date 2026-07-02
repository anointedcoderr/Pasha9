// Built by Anointed Coder.
//
// POST /api/admin/public-sections/seed
//
// Idempotently re-creates the PublicSection rows in group='about' and
// group='payment_display' that the base seed inserts (brand
// ambassadors, sponsorships, public payment methods). Operators hit
// this from the "Set up section" button on the Phase G admin pages
// when the database is missing the rows. Existing rows are never
// overwritten, so operator edits to titles and subtitles survive.

export const dynamic = 'force-dynamic';

import { withAuth, ensurePermission, recordActivity } from '@/lib/auth/guard';
import { getCurrentSession } from '@/lib/auth/rbac';
import { jsonError, jsonOk } from '@/lib/auth/errors';
import { db } from '@/lib/db/client';

interface SectionSeed {
  key: string;
  group: string;
  titleEn: string;
  titleBn: string | null;
  subtitleEn: string | null;
  position: number;
  layout: string | null;
  isVisible: boolean;
}

// Mirrors packages/database/prisma/seed.ts.
const ROWS: SectionSeed[] = [
  { key: 'about_ambassadors',      group: 'about',           titleEn: 'Brand Ambassadors', titleBn: 'ব্র্যান্ড অ্যাম্বাসেডর', subtitleEn: 'Faces of Pasha 9', position: 10, layout: 'grid',  isVisible: true },
  { key: 'about_sponsors',         group: 'about',           titleEn: 'Sponsorships',      titleBn: 'স্পনসরশিপ',            subtitleEn: 'Teams we back',    position: 20, layout: 'grid',  isVisible: true },
  { key: 'public_payment_methods', group: 'payment_display', titleEn: 'Payment Methods',   titleBn: 'পেমেন্ট পদ্ধতি',        subtitleEn: 'Fast and secure',  position: 10, layout: 'pills', isVisible: true },
];

export async function POST() {
  return withAuth(async () => {
    await ensurePermission('settings.write');
    const claims = await getCurrentSession();
    if (!claims) return jsonError(401, 'UNAUTHENTICATED');

    let created = 0;
    let kept = 0;
    for (const r of ROWS) {
      const existing = await db.publicSection.findUnique({ where: { key: r.key } });
      if (existing) {
        kept += 1;
        continue;
      }
      await db.publicSection.create({
        data: {
          key: r.key,
          group: r.group,
          titleEn: r.titleEn,
          titleBn: r.titleBn,
          subtitleEn: r.subtitleEn,
          position: r.position,
          layout: r.layout,
          isVisible: r.isVisible,
        },
      });
      created += 1;
    }

    await recordActivity({
      actorId: claims.sub,
      actorRole: claims.role,
      action: 'PUBLIC_SECTIONS_SEED',
      target: 'group:about+payment_display',
      meta: { created, kept },
    });

    return jsonOk({ ok: true, created, kept });
  });
}
