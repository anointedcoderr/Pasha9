// Built by Anointed Coder.
'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ShieldAlert } from 'lucide-react';
import { AdminSidebar } from '@/components/admin/AdminSidebar';
import { AdminMobileDrawer } from '@/components/admin/AdminMobileDrawer';
import { AdminTopbar } from '@/components/admin/AdminTopbar';
import { TooltipProvider } from '@/components/ui/Tooltip';
import { useAdminPermissions } from '@/lib/auth/use-admin-permissions';
import { canAccessAdminPath } from '@/lib/auth/admin-permission-map';

export default function AdminLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { loaded, role, permissions } = useAdminPermissions();
  const accessible = !loaded ? true : canAccessAdminPath(pathname ?? '/admin', role, permissions);

  // Apply the admin light theme on every admin route (including the login
  // standalone page). The CSS body.theme-admin block in globals.css recolors
  // the legacy dark utility classes so existing admin pages pick up the
  // white/yellow look without per-page rewrites.
  useEffect(() => {
    document.body.classList.add('theme-admin');
    return () => { document.body.classList.remove('theme-admin'); };
  }, []);

  if (pathname === '/admin/login') {
    return <div className="notranslate" translate="no">{children}</div>;
  }

  return (
    <TooltipProvider>
      {/* notranslate + translate=no on the admin shell: Pasha 9 has
          its own bilingual dictionaries. External translators
          (Google Translate, etc.) replace text nodes inside React-
          owned trees, which then crashes the reconciler with a
          `removeChild` null error on the next state change. */}
      {/* Phase 3O admin shell:
          - Outer flex row is locked to 100dvh and overflow:hidden so
            the document itself never scrolls. The previous shell let
            the page scroll as one unit, which slid the sidebar up
            off-screen together with the content.
          - The sidebar is a sibling flex column with its own internal
            scroll. Logo + footer stay pinned at top/bottom; only the
            nav middle scrolls when the menu is taller than viewport.
          - The right column is its own flex column. Topbar sits above
            main as a flex sibling and never moves; main has overflow-
            y-auto so only its content scrolls. */}
      <div
        className="font-admin notranslate flex h-[100dvh] w-full overflow-hidden"
        translate="no"
      >
        <AdminSidebar />
        <AdminMobileDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <AdminTopbar onMenu={() => setDrawerOpen(true)} />
          <main className="flex-1 overflow-y-auto overscroll-contain px-4 py-6 md:px-8">
            {accessible ? children : <AdminForbidden />}
          </main>
        </div>
      </div>
    </TooltipProvider>
  );
}

function AdminForbidden() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center justify-center rounded-2xl border border-amber-200 bg-amber-50 p-8 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-700">
        <ShieldAlert className="h-6 w-6" />
      </span>
      <h2 className="mt-4 text-base font-extrabold text-brand-ink">Access denied</h2>
      <p className="mt-2 text-sm text-brand-inkSoft">
        Your staff role does not include permission to view this module. Ask a Super Admin to grant access from the Staff page if you need it.
      </p>
      <Link
        href="/admin"
        className="btn-yellow mt-5 inline-flex h-10 items-center rounded-lg px-4 text-xs font-bold"
      >
        Back to dashboard
      </Link>
    </div>
  );
}
