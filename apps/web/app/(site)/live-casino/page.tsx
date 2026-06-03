// Built by Anointed Coder.
//
// /live-casino now resolves to the real Live Casino catalog filtered
// through /games/provider. Mock cards retired post-M4 multi-brand
// import.

import { redirect } from 'next/navigation';

export const dynamic = 'force-static';

export default function LiveCasinoPage(): never {
  redirect('/games/provider?category=live_casino');
}
