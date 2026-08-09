// Built by Anointed Coder.
//
// Metadata for /responsible-gaming. Lives in a layout because the page itself is a client
// component and client components cannot export metadata - without this the
// page inherited the generic site-wide title and description, so every public
// page competed for the same search terms instead of its own.

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Responsible Gaming',
  description: 'Play safely. Deposit limits, self-exclusion and support resources.',
  alternates: { canonical: '/responsible-gaming' },
  openGraph: {
    title: 'Responsible Gaming',
    description: 'Play safely. Deposit limits, self-exclusion and support resources.',
    url: '/responsible-gaming',
    type: 'website',
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
