// Built by Anointed Coder.
//
// Metadata for /games. Lives in a layout because the page itself is a client
// component and client components cannot export metadata - without this the
// page inherited the generic site-wide title and description, so every public
// page competed for the same search terms instead of its own.

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Casino Games',
  description: 'Play hundreds of slots, table games and live dealer titles. Instant bKash and Nagad deposits, fast withdrawals.',
  alternates: { canonical: '/games' },
  openGraph: {
    title: 'Casino Games',
    description: 'Play hundreds of slots, table games and live dealer titles. Instant bKash and Nagad deposits, fast withdrawals.',
    url: '/games',
    type: 'website',
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
