// Built by Anointed Coder.
//
// Metadata for /faq. Lives in a layout because the page itself is a client
// component and client components cannot export metadata - without this the
// page inherited the generic site-wide title and description, so every public
// page competed for the same search terms instead of its own.

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Frequently Asked Questions',
  description: 'Answers about deposits, withdrawals, bonuses, turnover and account verification.',
  alternates: { canonical: '/faq' },
  openGraph: {
    title: 'Frequently Asked Questions',
    description: 'Answers about deposits, withdrawals, bonuses, turnover and account verification.',
    url: '/faq',
    type: 'website',
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
