// Built by Anointed Coder.
//
// Metadata for /rewards. Lives in a layout because the page itself is a client
// component and client components cannot export metadata - without this the
// page inherited the generic site-wide title and description, so every public
// page competed for the same search terms instead of its own.

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Rewards and Free Spins',
  description: 'Spin the wheel, claim daily rewards and climb the VIP tiers for bigger bonuses.',
  alternates: { canonical: '/rewards' },
  openGraph: {
    title: 'Rewards and Free Spins',
    description: 'Spin the wheel, claim daily rewards and climb the VIP tiers for bigger bonuses.',
    url: '/rewards',
    type: 'website',
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
