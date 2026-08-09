// Built by Anointed Coder.
//
// Metadata for /sports. Lives in a layout because the page itself is a client
// component and client components cannot export metadata - without this the
// page inherited the generic site-wide title and description, so every public
// page competed for the same search terms instead of its own.

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Sports Betting',
  description: 'Bet on cricket, football and more with competitive odds. Live in-play markets and instant payouts.',
  alternates: { canonical: '/sports' },
  openGraph: {
    title: 'Sports Betting',
    description: 'Bet on cricket, football and more with competitive odds. Live in-play markets and instant payouts.',
    url: '/sports',
    type: 'website',
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
