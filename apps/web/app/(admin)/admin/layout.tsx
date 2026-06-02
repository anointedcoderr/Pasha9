// Built by Anointed Coder.
'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { AdminSidebar } from '@/components/admin/AdminSidebar';
import { AdminMobileDrawer } from '@/components/admin/AdminMobileDrawer';
import { AdminTopbar } from '@/components/admin/AdminTopbar';
import { TooltipProvider } from '@/components/ui/Tooltip';

export default function AdminLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);

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
      <div className="font-admin min-h-screen notranslate" translate="no">
        <div className="flex">
          <AdminSidebar />
          <AdminMobileDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
          <div className="min-w-0 flex-1">
            <AdminTopbar onMenu={() => setDrawerOpen(true)} />
            <main className="px-4 py-6 md:px-8">{children}</main>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
