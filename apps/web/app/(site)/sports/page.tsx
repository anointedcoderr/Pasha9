// Built by Anointed Coder.
//
// /sports redirects to the real Sportsbook catalog filtered through
// /games/provider. The previous page rendered demo fixtures
// (Bangladesh Premier League / Bangabandhu Cup / Asian Champions
// League etc) that confused visitors into thinking a fixture list
// was live; those are gone. When BTI Sports / 9Wickets / or any
// other sportsbook brand has rows in ExternalGame with
// category=sportsbook, they show here. When the catalog is empty
// the page renders the standard empty-state copy.

import { redirect } from 'next/navigation';

export const dynamic = 'force-static';

export default function SportsPage(): never {
  redirect('/games/provider?category=sportsbook');
}
