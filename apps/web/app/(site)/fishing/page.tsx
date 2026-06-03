// Built by Anointed Coder.
//
// /fishing redirects to the real Fishing catalog filtered through
// /games/provider. Mock cards retired post-M4 multi-brand import.

import { redirect } from 'next/navigation';

export const dynamic = 'force-static';

export default function FishingPage(): never {
  redirect('/games/provider?category=fishing');
}
