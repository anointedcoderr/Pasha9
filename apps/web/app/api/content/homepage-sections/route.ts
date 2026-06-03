// Built by Anointed Coder.
//
// GET /api/content/homepage-sections
//
// Public read endpoint that powers the homepage. No auth required.
// Returns the visible homepage sections + custom HomepageGameBlock
// rows with their assembled game lists.
//
// Caching: dynamic + revalidate=0 + Cache-Control: no-store so that
// admin edits in /admin/homepage-sections appear on the public site
// within one request. The previous 30s revalidation made admin
// changes look ignored - we cannot afford that on a live operations
// surface where the operator pulls a game offline and expects it to
// vanish immediately.

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

import { NextResponse } from 'next/server';
import { buildHomeSections } from '@/lib/homepage/sections';
import { buildHomeBlocks } from '@/lib/homepage/blocks';

export async function GET() {
  try {
    const [bundle, blocks] = await Promise.all([buildHomeSections(), buildHomeBlocks()]);
    const sections = bundle.sections
      .filter((s) => s.isVisible)
      .filter((s) => {
        const isLayoutOnly = ['homepage_brand', 'homepage_video', 'homepage_upcoming'].includes(s.key);
        return isLayoutOnly || s.games.length > 0;
      });
    return new NextResponse(JSON.stringify({ ok: true, sections, blocks, featuredCount: bundle.featuredCount }), {
      status: 200,
      headers: {
        'content-type': 'application/json',
        'cache-control': 'no-store, no-cache, must-revalidate, max-age=0',
        pragma: 'no-cache',
      },
    });
  } catch (err) {
    console.error('[content/homepage-sections] assemble failed', err);
    return new NextResponse(JSON.stringify({ ok: true, sections: [], blocks: [], featuredCount: 0 }), {
      status: 200,
      headers: {
        'content-type': 'application/json',
        'cache-control': 'no-store, no-cache, must-revalidate, max-age=0',
        pragma: 'no-cache',
      },
    });
  }
}
