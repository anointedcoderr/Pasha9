// Built by Anointed Coder.
//
// The /slots top-level URL now resolves to the real ExternalGame
// catalog filtered by category=slots. The old mock-driven page that
// surfaced demo cards is gone. /games/provider reads the URL query
// on mount and preselects the dropdowns, so the visitor lands
// directly on the filtered list without an extra click.

import { redirect } from 'next/navigation';

export const dynamic = 'force-static';

export default function SlotsPage(): never {
  redirect('/games/provider?category=slots');
}
