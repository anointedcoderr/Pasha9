// Built by Anointed Coder.
'use client';

import { useEffect, type ReactNode } from 'react';
import { Header } from '@/components/site/Header';
import { Footer } from '@/components/site/Footer';
import { FloatingContact } from '@/components/site/FloatingContact';
import { TooltipProvider } from '@/components/ui/Tooltip';

export default function SiteLayout({ children }: { children: ReactNode }) {
  // Apply the light theme to the body for every public-site route. The
  // legacy dark tokens remain available for the dashboard and admin until
  // they migrate.
  useEffect(() => {
    document.body.classList.add('theme-light');
    return () => { document.body.classList.remove('theme-light'); };
  }, []);

  return (
    <TooltipProvider>
      <div className="min-h-screen pb-[88px] lg:pb-0">
        <Header />
        <main className="mx-auto max-w-page px-3 py-4 md:px-6">
          {children}
        </main>
        <Footer />
        <FloatingContact />
      </div>
    </TooltipProvider>
  );
}
