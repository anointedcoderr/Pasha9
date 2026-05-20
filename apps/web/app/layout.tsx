import type { Metadata, Viewport } from 'next';
import { fontAdmin, fontBn, fontEn } from '@/styles/fonts';
import { Providers } from './providers';
import './globals.css';

export const metadata: Metadata = {
  title: 'sanjid14 | Royal Bangla Casino',
  description: 'Premium Bangla casino and betting platform. Play smarter, win bigger.',
  applicationName: 'sanjid14',
  authors: [{ name: 'Anointed Coder', url: 'https://t.me/AnointedCoder' }],
  creator: 'Anointed Coder',
  publisher: 'Anointed Coder',
  themeColor: '#06120c',
  icons: {
    icon: '/favicon.svg',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#06120c',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="bn" data-lang="bn" className={`${fontBn.variable} ${fontEn.variable} ${fontAdmin.variable}`}>
      <body className="font-bn antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
