// Built by Anointed Coder.
//
// Metadata for /support. Lives in a layout because the page itself is a client
// component and client components cannot export metadata - without this the
// page inherited the generic site-wide title and description, so every public
// page competed for the same search terms instead of its own.

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Help and Support',
  description: 'Get help with deposits, withdrawals, bonuses and your account. Live chat available.',
  alternates: { canonical: '/support' },
  openGraph: {
    title: 'Help and Support',
    description: 'Get help with deposits, withdrawals, bonuses and your account. Live chat available.',
    url: '/support',
    type: 'website',
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
