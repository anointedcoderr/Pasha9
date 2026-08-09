// Built by Anointed Coder.
//
// Metadata for /lotto. Lives in a layout because the page itself is a client
// component and client components cannot export metadata - without this the
// page inherited the generic site-wide title and description, so every public
// page competed for the same search terms instead of its own.

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Lottery',
  description: 'Buy tickets and win big in the daily and weekly draws. Every deposit earns free entries.',
  alternates: { canonical: '/lotto' },
  openGraph: {
    title: 'Lottery',
    description: 'Buy tickets and win big in the daily and weekly draws. Every deposit earns free entries.',
    url: '/lotto',
    type: 'website',
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
