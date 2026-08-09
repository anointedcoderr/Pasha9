// Built by Anointed Coder.
//
// Metadata for /live-casino. Lives in a layout because the page itself is a client
// component and client components cannot export metadata - without this the
// page inherited the generic site-wide title and description, so every public
// page competed for the same search terms instead of its own.

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Live Casino',
  description: 'Real dealers, real tables, streamed in HD. Baccarat, roulette, blackjack and Andar Bahar with Bangla-friendly support.',
  alternates: { canonical: '/live-casino' },
  openGraph: {
    title: 'Live Casino',
    description: 'Real dealers, real tables, streamed in HD. Baccarat, roulette, blackjack and Andar Bahar with Bangla-friendly support.',
    url: '/live-casino',
    type: 'website',
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
