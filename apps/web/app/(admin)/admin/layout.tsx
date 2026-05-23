// Built by Anointed Coder.
'use client';

import { useEffect, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { AdminSidebar } from '@/components/admin/AdminSidebar';
import { AdminTopbar } from '@/components/admin/AdminTopbar';
import { TooltipProvider } from '@/components/ui/Tooltip';

export default function AdminLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  // Apply the admin light theme on every admin route (including the login
  // standalone page). The CSS body.theme-admin block in globals.css recolors
  // the legacy dark utility classes so existing admin pages pick up the
  // white/yellow look without per-page rewrites.
  useEffect(() => {
    document.body.classList.add('theme-admin');
    return () => { document.body.classList.remove('theme-admin'); };
  }, []);

  if (pathname === '/admin/login') return <>{children}</>;

  return (
    <TooltipProvider>
      <div className="font-admin min-h-screen">
        <div className="flex">
          <AdminSidebar />
          <div className="min-w-0 flex-1">
            <AdminTopbar />
            <main className="px-4 py-6 md:px-8">{children}</main>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
