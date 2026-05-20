'use client';

import { type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { AdminSidebar } from '@/components/admin/AdminSidebar';
import { AdminTopbar } from '@/components/admin/AdminTopbar';
import { TooltipProvider } from '@/components/ui/Tooltip';

export default function AdminLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
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
