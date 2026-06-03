// Built by Anointed Coder.
//
// GET /api/content/homepage-sections
//
// Public read endpoint that powers the homepage. No auth required.
// Returns the visible homepage sections with their assembled game
// lists. The endpoint is best-effort: any internal error returns an
// empty list with HTTP 200 so the homepage degrades gracefully
// instead of crashing the public site.

export const dynamic = 'force-dynamic';
export const revalidate = 30;

import { NextResponse } from 'next/server';
import { buildHomeSections } from '@/lib/homepage/sections';

export async function GET() {
  try {
    const bundle = await buildHomeSections();
    // Strip section rows the operator has hidden. Always render the
    // strip-style sections only when they have at least one game so
    // public visitors do not see empty headers.
    const sections = bundle.sections
      .filter((s) => s.isVisible)
      .filter((s) => {
        // Layout-marker sections (brand / video / upcoming) are kept
        // so the page renderer can decide what to show; strip sections
        // are hidden when empty.
        const isLayoutOnly = ['homepage_brand', 'homepage_video', 'homepage_upcoming'].includes(s.key);
        return isLayoutOnly || s.games.length > 0;
      });
    return NextResponse.json({ ok: true, sections, featuredCount: bundle.featuredCount });
  } catch (err) {
    console.error('[content/homepage-sections] assemble failed', err);
    return NextResponse.json({ ok: true, sections: [], featuredCount: 0 });
  }
}
