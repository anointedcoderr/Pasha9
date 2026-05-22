import type { Metadata, Viewport } from 'next';
import { fontAdmin, fontBn, fontEn } from '@/styles/fonts';
import { Providers } from './providers';
import { resolveLang } from '@/lib/i18n/server';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL('https://pasha9.com'),
  title: {
    default: 'Pasha9 | Royal Bangla Casino',
    template: '%s | Pasha9',
  },
  description: 'Pasha9 brings a premium Bangla casino and betting experience. Play smarter, win bigger.',
  applicationName: 'Pasha9',
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

// Reading cookies + headers in the root layout opts the tree into dynamic rendering,
// which is required for the language to be picked from the cookie on every request.
// This is what guarantees no English-to-Bangla flash.
export const dynamic = 'force-dynamic';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const initialLang = resolveLang();
  const bodyFont = initialLang === 'bn' ? 'font-bn' : 'font-en';

  return (
    <html lang={initialLang} data-lang={initialLang} className={`${fontBn.variable} ${fontEn.variable} ${fontAdmin.variable}`}>
      <body className={`${bodyFont} antialiased`}>
        <Providers initialLang={initialLang}>{children}</Providers>
      </body>
    </html>
  );
}
