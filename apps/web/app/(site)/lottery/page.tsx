// Built by Anointed Coder.
//
// /lottery is the legacy slug for the real lotto surface. Redirect
// to /lotto so visitors land on the live draw + ticket + winnings
// flow instead of mock draws.

import { redirect } from 'next/navigation';

export const dynamic = 'force-static';

export default function LotteryPage(): never {
  redirect('/lotto');
}
