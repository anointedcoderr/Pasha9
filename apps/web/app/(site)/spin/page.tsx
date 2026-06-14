// Built by Anointed Coder.
//
// /spin is a thin permanent redirect to the rewards page's spin
// tab. The canonical Spin surface lives at /rewards?tab=spin
// because the spin coexists with the rewards store and the daily
// check-in inside the same Rewards Center, but the engineering
// briefing references `/spin` as the route, so we honour both.
// Any external link, QR code, or push notification that hard-
// codes /spin keeps working.

import { redirect } from 'next/navigation';

export default function SpinAlias() {
  redirect('/rewards?tab=spin');
}
