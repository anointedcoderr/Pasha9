// Built by Anointed Coder.
//
// Metadata for /slots. Lives in a layout because the page itself is a client
// component and client components cannot export metadata - without this the
// page inherited the generic site-wide title and description, so every public
// page competed for the same search terms instead of its own.

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Slots',
  description: 'Hundreds of slot games from top studios. Free spins, jackpots and daily bonuses.',
  alternates: { canonical: '/slots' },
  openGraph: {
    title: 'Slots',
    description: 'Hundreds of slot games from top studios. Free spins, jackpots and daily bonuses.',
    url: '/slots',
    type: 'website',
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
