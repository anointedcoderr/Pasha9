// Built by Anointed Coder.
//
// POST /api/admin/homepage-sections/seed
//
// Idempotently re-creates the 10 PublicSection rows in group='homepage'
// that the Phase A seed inserts. Operators can hit this from the admin
// page when the production database is missing the rows (the "Did the
// Phase A seed run?" warning state). Existing operator edits to titles
// or subtitles are preserved - upsert only writes the columns the
// operator has not personalised, and the row is created with the
// default copy only when missing.

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

const ROWS: SectionSeed[] = [
  { key: 'homepage_hot',         group: 'homepage', titleEn: 'Hot Games',         titleBn: 'হট গেমস',         subtitleEn: 'Trending right now',         position: 10, layout: 'strip',  isVisible: true },
  { key: 'homepage_slots',       group: 'homepage', titleEn: 'Popular Slots',     titleBn: 'জনপ্রিয় স্লট',     subtitleEn: 'Big jackpots every day',     position: 20, layout: 'strip',  isVisible: true },
  { key: 'homepage_live_casino', group: 'homepage', titleEn: 'Live Casino',       titleBn: 'লাইভ ক্যাসিনো',     subtitleEn: 'Real dealers, real action',  position: 30, layout: 'strip',  isVisible: true },
  { key: 'homepage_fishing',     group: 'homepage', titleEn: 'Fishing Games',     titleBn: 'মাছ ধরা গেমস',     subtitleEn: 'Reel in the wins',           position: 40, layout: 'strip',  isVisible: true },
  { key: 'homepage_crash',       group: 'homepage', titleEn: 'Crash Games',       titleBn: 'ক্র্যাশ গেমস',      subtitleEn: 'Cash out before it crashes', position: 50, layout: 'strip',  isVisible: true },
  { key: 'homepage_lottery',     group: 'homepage', titleEn: 'Lottery Numbers',   titleBn: 'লটারি গেমস',       subtitleEn: 'Daily 4D draws',             position: 60, layout: 'strip',  isVisible: true },
  { key: 'homepage_brand',       group: 'homepage', titleEn: 'Brand Showcase',    titleBn: 'ব্র্যান্ড পরিচিতি',  subtitleEn: 'Our partners',               position: 70, layout: 'banner', isVisible: true },
  { key: 'homepage_video',       group: 'homepage', titleEn: 'Video Highlights',  titleBn: 'ভিডিও হাইলাইটস',    subtitleEn: 'Watch the latest action',    position: 80, layout: 'video',  isVisible: true },
  { key: 'homepage_upcoming',    group: 'homepage', titleEn: 'Upcoming Matches',  titleBn: 'আসন্ন ম্যাচ',        subtitleEn: 'Sports + esports schedule',  position: 90, layout: 'strip',  isVisible: false },
  { key: 'homepage_sportsbook',  group: 'homepage', titleEn: 'Sportsbook',        titleBn: 'স্পোর্টসবুক',       subtitleEn: 'Cricket, football and more', position: 95, layout: 'strip',  isVisible: true },
];

export async function POST() {
  return withAuth(async () => {
    await ensurePermission('homepage.write');
    const claims = await getCurrentSession();
    if (!claims) return jsonError(401, 'UNAUTHENTICATED');

    let created = 0;
    let kept = 0;
    for (const r of ROWS) {
      const existing = await db.publicSection.findUnique({ where: { key: r.key } });
      if (existing) {
        // Existing row stays untouched so operator personalised titles
        // and subtitles are preserved. Only fill in `layout` when it is
        // still null - older databases may have rows without a layout
        // and the homepage assembler keys off it for the brand/video
        // markers.
        if (!existing.layout && r.layout) {
          await db.publicSection.update({ where: { key: r.key }, data: { layout: r.layout, group: r.group } });
        } else if (existing.group !== r.group) {
          await db.publicSection.update({ where: { key: r.key }, data: { group: r.group } });
        }
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
      action: 'HOMEPAGE_SECTIONS_SEED',
      target: 'group:homepage',
      meta: { created, kept },
    });

    const sections = await db.publicSection.findMany({
      where: { group: 'homepage' },
      orderBy: [{ position: 'asc' }, { titleEn: 'asc' }],
    });

    return jsonOk({ ok: true, created, kept, sections });
  });
}
