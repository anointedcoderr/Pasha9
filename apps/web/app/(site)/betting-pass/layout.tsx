// Built by Anointed Coder.
//
// Metadata for /betting-pass. Lives in a layout because the page itself is a client
// component and client components cannot export metadata - without this the
// page inherited the generic site-wide title and description, so every public
// page competed for the same search terms instead of its own.

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Betting Pass',
  description: 'Collect points as you play and unlock tiered cash rewards.',
  alternates: { canonical: '/betting-pass' },
  openGraph: {
    title: 'Betting Pass',
    description: 'Collect points as you play and unlock tiered cash rewards.',
    url: '/betting-pass',
    type: 'website',
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
