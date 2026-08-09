// Built by Anointed Coder.
//
// Metadata for /terms. Lives in a layout because the page itself is a client
// component and client components cannot export metadata - without this the
// page inherited the generic site-wide title and description, so every public
// page competed for the same search terms instead of its own.

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Terms and Conditions',
  description: 'The terms governing your use of the platform, bonuses and withdrawals.',
  alternates: { canonical: '/terms' },
  openGraph: {
    title: 'Terms and Conditions',
    description: 'The terms governing your use of the platform, bonuses and withdrawals.',
    url: '/terms',
    type: 'website',
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
