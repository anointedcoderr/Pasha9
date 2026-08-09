// Built by Anointed Coder.
//
// Metadata for /promotions. Lives in a layout because the page itself is a client
// component and client components cannot export metadata - without this the
// page inherited the generic site-wide title and description, so every public
// page competed for the same search terms instead of its own.

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Promotions and Bonuses',
  description: 'Deposit bonuses, reload offers, cashback and free spins. New promotions every week.',
  alternates: { canonical: '/promotions' },
  openGraph: {
    title: 'Promotions and Bonuses',
    description: 'Deposit bonuses, reload offers, cashback and free spins. New promotions every week.',
    url: '/promotions',
    type: 'website',
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
