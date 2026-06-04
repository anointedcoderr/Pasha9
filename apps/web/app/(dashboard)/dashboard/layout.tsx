'use client';

import { useEffect, type ReactNode } from 'react';
import { Header } from '@/components/site/Header';
import { Footer } from '@/components/site/Footer';
import { FloatingContact } from '@/components/site/FloatingContact';
import { DashboardNav } from '@/components/dashboard/DashboardNav';
import { TooltipProvider } from '@/components/ui/Tooltip';

export default function DashboardLayout({ children }: { children: ReactNode }) {
  useEffect(() => {
    document.body.classList.add('theme-light');
    return () => { document.body.classList.remove('theme-light'); };
  }, []);

  return (
    <TooltipProvider>
      <div className="flex min-h-dvh flex-col pb-[calc(116px+env(safe-area-inset-bottom))] lg:pb-0">
        <Header />
        <div className="mx-auto w-full max-w-page grow px-4 py-6 md:px-6">
          <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
            <DashboardNav />
            <main className="min-w-0">{children}</main>
          </div>
        </div>
        <Footer />
        <FloatingContact />
      </div>
    </TooltipProvider>
  );
}
