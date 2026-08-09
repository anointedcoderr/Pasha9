// Built by Anointed Coder.
//
// Metadata for /affiliate. Lives in a layout because the page itself is a client
// component and client components cannot export metadata - without this the
// page inherited the generic site-wide title and description, so every public
// page competed for the same search terms instead of its own.

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Affiliate Programme',
  description: 'Earn lifetime commission for every player you refer. Weekly payouts, transparent reporting.',
  alternates: { canonical: '/affiliate' },
  openGraph: {
    title: 'Affiliate Programme',
    description: 'Earn lifetime commission for every player you refer. Weekly payouts, transparent reporting.',
    url: '/affiliate',
    type: 'website',
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
