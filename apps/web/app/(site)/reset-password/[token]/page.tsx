// Built by Anointed Coder.
//
// Path-based variant of the reset page. When the operator shares
// /reset-password/<token>, this server component redirects to the
// query-string variant so the existing form auto-fills the field
// from useSearchParams() without duplicating the UI.

import { redirect } from 'next/navigation';

export default function ResetPasswordWithToken({ params }: { params: { token: string } }) {
  const t = encodeURIComponent(params.token ?? '');
  redirect(`/reset-password?token=${t}`);
}
