// Built by Anointed Coder.
//
// Where a staff member lands when they have no permission for wherever they
// were headed, including straight after login.
//
// This page is deliberately NOT registered in ADMIN_SECTIONS. sectionForPath
// returns undefined for an unmapped route, and both the middleware and
// canAccessAdminPath already treat an unmapped path as open to any signed-in
// staff member - see admin-permission-map.ts. So this page is unconditionally
// reachable by anyone who is authenticated, no matter what they have or have
// not been granted.
//
// That property is the entire fix. The middleware used to send a denied
// request back to /admin. For any staff role missing menu.overview.view -
// easy to miss among the dozens of granular permission codes when setting up
// a new role - /admin itself is also denied, so the redirect fired again,
// and again, forever: "Safari can't open the page because too many redirects
// occurred." This page can never do that, because nothing here requires a
// permission to view.

'use client';

import { useRouter } from 'next/navigation';
import { ShieldAlert, LogOut } from 'lucide-react';

export default function AdminNoAccessPage() {
  const router = useRouter();

  // Mirrors AdminTopbar's logout exactly. A plain <Link> to /admin/login
  // would leave the session cookie in place while the button says Sign out,
  // and the mismatch is worse than no button at all: it reads as fixed when
  // the same account is still authenticated on reload.
  const signOut = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // ignore network errors, still redirect to login
    }
    router.replace('/admin/login');
    router.refresh();
  };

  return (
    <div className="mx-auto flex max-w-md flex-col items-center justify-center rounded-2xl border border-amber-200 bg-amber-50 p-8 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-700">
        <ShieldAlert className="h-6 w-6" aria-hidden="true" />
      </span>
      <h1 className="mt-4 text-base font-extrabold text-brand-ink">No sections available yet</h1>
      <p className="mt-2 text-sm text-brand-inkSoft">
        Your staff account is not currently granted access to any admin section, including the dashboard. Ask a Super
        Admin to grant you access from the Staff page.
      </p>
      <button
        type="button"
        onClick={signOut}
        className="mt-5 inline-flex h-10 items-center gap-2 rounded-lg border border-amber-300 bg-white px-4 text-xs font-bold text-brand-ink hover:bg-amber-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700"
      >
        <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
        Sign out
      </button>
    </div>
  );
}
