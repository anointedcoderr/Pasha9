import type { Metadata, Viewport } from 'next';
import { fontAdmin, fontBn, fontEn } from '@/styles/fonts';
import { Providers } from './providers';
import { resolveLang } from '@/lib/i18n/server';
import { DynamicFavicon } from '@/components/site/DynamicFavicon';
import { TrackingScripts } from '@/components/site/TrackingScripts';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL('https://pasha9.com'),
  title: {
    default: 'Pasha 9 | Royal Bangla Casino',
    template: '%s | Pasha 9',
  },
  description: 'Pasha 9 brings a premium Bangla casino and betting experience. Play smarter, win bigger.',
  applicationName: 'Pasha 9',
  authors: [{ name: 'Anointed Coder', url: 'https://t.me/anointedcoder' }],
  creator: 'Anointed Coder',
  publisher: 'Anointed Coder',
  icons: {
    icon: '/favicon.svg',
    apple: '/favicon.svg',
  },
  manifest: '/manifest.webmanifest',
  // Block browser translation engines (Google Translate, Edge,
  // Safari). Pasha 9 ships its own EN/BN dictionaries; the React
  // tree expects to own every text node. When Google Translate
  // replaces text nodes it makes React's reconciler unable to find
  // them later, producing 'Cannot read properties of null (reading
  // removeChild)' on the next unmount. Belt + suspenders on the
  // admin shell below pins this for translated browsers that
  // ignore the meta hint.
  other: {
    google: 'notranslate',
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

// Pre-hydration theme classifier. Runs synchronously as the first
// child of <body> so the correct theme-* class is on the element
// before the browser paints any body content. Without this, the
// nested layouts apply the class in a useEffect that fires AFTER
// hydration, briefly showing the dark CSS defaults (a "dark flash"
// most visible on /admin/login and on cold-load of the login modal).
const THEME_BOOTSTRAP_SCRIPT = `
(function(){try{
  var p=window.location.pathname;
  var cls=p.indexOf('/admin')===0?'theme-admin':'theme-light';
  document.body.classList.add(cls);
}catch(e){}})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const initialLang = resolveLang();
  const bodyFont = initialLang === 'bn' ? 'font-bn' : 'font-en';

  return (
    <html lang={initialLang} data-lang={initialLang} translate="no" suppressHydrationWarning className={`${fontBn.variable} ${fontEn.variable} ${fontAdmin.variable} notranslate`}>
      <head>
        {/* Belt + suspenders translation block; some browsers honour
            the meta name=google but not the translate attribute,
            and vice versa. The platform ships its own EN/BN
            dictionaries, so external translation only mutates DOM
            nodes that React owns and breaks reconciliation. */}
        <meta name="google" content="notranslate" />
      </head>
      <body className={`${bodyFont} antialiased notranslate`} translate="no" suppressHydrationWarning>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP_SCRIPT }} />
        <DynamicFavicon />
        <TrackingScripts />
        <Providers initialLang={initialLang}>{children}</Providers>
      </body>
    </html>
  );
}
