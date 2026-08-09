// Built by Anointed Coder.
//
// Metadata for /referral. Lives in a layout because the page itself is a client
// component and client components cannot export metadata - without this the
// page inherited the generic site-wide title and description, so every public
// page competed for the same search terms instead of its own.

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Refer and Earn',
  description: 'Invite friends and earn a commission on every deposit they make.',
  alternates: { canonical: '/referral' },
  openGraph: {
    title: 'Refer and Earn',
    description: 'Invite friends and earn a commission on every deposit they make.',
    url: '/referral',
    type: 'website',
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
