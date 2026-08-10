import type { Metadata, Viewport } from 'next';
import { fontAdmin, fontBn, fontDisplay, fontEn } from '@/styles/fonts';
import { Providers } from './providers';
import { resolveLang } from '@/lib/i18n/server';
import { TrackingScripts } from '@/components/site/TrackingScripts';
import { StructuredData } from '@/components/seo/StructuredData';
import { db } from '@/lib/db/client';
import './globals.css';

// Canonical origin for SEO markup. Env override lets a staging deploy emit
// its own URLs instead of pointing every canonical at production.
const SITE_ORIGIN = (process.env.PUBLIC_BASE_URL ?? 'https://pasha9.com').replace(/\/+$/, '');

// Pulls the operator-uploaded favicon and site name out of
// SystemSetting at request time so /admin/website edits take effect
// without a redeploy. metadata is rendered server-side so there is no
// DOM-swap of <link rel=icon> on the client; the prior DynamicFavicon
// component was removed because that runtime swap was the production
// source of a React reconciliation crash. Pure server output side-
// steps that class of bug. Falls back to the in-repo /favicon.svg
// when no row is set so a fresh database still renders an icon.
export async function generateMetadata(): Promise<Metadata> {
  const rows = await db.systemSetting
    .findMany({ where: { key: { in: ['site_name', 'favicon_url', 'favicon_version'] } } })
    .catch(() => [] as Array<{ key: string; value: string | null }>);
  const map: Record<string, string> = {};
  for (const r of rows) if (r.value && r.value.trim()) map[r.key] = r.value.trim();
  const siteName = map.site_name ?? 'Pasha 9';
  const faviconBase = map.favicon_url ?? '/favicon.svg';
  // Append a cache-busting query string so the browser refetches the
  // icon every time the operator saves a new file in /admin/website.
  // The version is the SystemSetting `favicon_version` value (the
  // admin save route writes a fresh value on every save). Falls back
  // to '1' when not set so the URL still looks normal on a fresh DB.
  const version = map.favicon_version || '1';
  const separator = faviconBase.includes('?') ? '&' : '?';
  const favicon = faviconBase.startsWith('/uploads/') || /^https?:\/\//i.test(faviconBase)
    ? `${faviconBase}${separator}v=${encodeURIComponent(version)}`
    : faviconBase;

  return {
    metadataBase: new URL('https://pasha9.com'),
    title: {
      default: `${siteName} | Royal Bangla Casino`,
      template: `%s | ${siteName}`,
    },
    description: `${siteName} brings a premium Bangla casino and betting experience. Play smarter, win bigger.`,
    applicationName: siteName,
    // Self-referencing canonical. Without it, the same page reachable via the
    // pasa9.com redirect, a trailing slash, or a tracking query string can be
    // treated as several competing URLs, which splits the ranking signal
    // between them instead of pooling it on one.
    alternates: {
      canonical: '/',
      languages: { en: '/', bn: '/' },
    },
    // Both spellings are named because the operator owns pasa9.com and
    // redirects it here. Keywords carry little weight on their own, but the
    // pairing is reinforced by alternateName in the structured data.
    keywords: [siteName, 'Pasha 9', 'Pasha9', 'Pasa9', 'Pasa 9', 'casino Bangladesh', 'online betting BD', 'bkash casino', 'nagad betting'],
    openGraph: {
      type: 'website',
      siteName,
      title: `${siteName} | Royal Bangla Casino`,
      description: `${siteName} brings a premium Bangla casino and betting experience. Play smarter, win bigger.`,
      url: '/',
      locale: 'en_US',
      alternateLocale: ['bn_BD'],
      images: [{ url: favicon, width: 512, height: 512, alt: siteName }],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${siteName} | Royal Bangla Casino`,
      description: `${siteName} brings a premium Bangla casino and betting experience.`,
      images: [favicon],
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        // Lets Google show full-length snippets and large image previews
        // instead of the conservative defaults it applies without this.
        'max-snippet': -1,
        'max-image-preview': 'large',
        'max-video-preview': -1,
      },
    },
    authors: [{ name: 'Anointed Coder', url: 'https://t.me/anointedcoder' }],
    creator: 'Anointed Coder',
    publisher: 'Anointed Coder',
    // Explicit sized variants so every browser cache slot lands
    // on a freshly versioned URL. The same uploaded file fills
    // every size because operator uploads are typically a single
    // square master image, but supplying explicit sizes prevents
    // browsers from re-using a stale entry from a different size
    // bucket.
    icons: {
      icon: [
        { url: favicon, sizes: '16x16', type: 'image/png' },
        { url: favicon, sizes: '32x32', type: 'image/png' },
        { url: favicon, sizes: '48x48', type: 'image/png' },
        { url: favicon, sizes: '192x192', type: 'image/png' },
        { url: favicon, sizes: '512x512', type: 'image/png' },
      ],
      apple: [
        { url: favicon, sizes: '180x180', type: 'image/png' },
      ],
      shortcut: favicon,
    },
    other: {
      google: 'notranslate',
      // Windows tile icon - some browsers pull this for
      // address-bar suggestion thumbnails on Windows desktop.
      'msapplication-TileImage': favicon,
      'msapplication-TileColor': '#0F1115',
    },
    manifest: '/manifest.webmanifest',
    // Block browser translation engines (Google Translate, Edge,
    // Safari). Pasha 9 ships its own EN/BN dictionaries; the React
    // tree expects to own every text node. When Google Translate
    // replaces text nodes it makes React's reconciler unable to find
    // them later, producing 'Cannot read properties of null (reading
    // removeChild)' on the next unmount. The notranslate hint lives
    // in the consolidated `other:` block above.
  };
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#06120c',
  // The site styles itself and supports exactly one scheme. Without this
  // declaration, Chrome's Auto Dark Theme and Android WebView force-dark
  // (camera and QR scanner in-app browsers especially) rewrite the palette:
  // CSS backgrounds invert to muddy brown-black while images keep their true
  // colors, which players reported as the theme "breaking" after scanning a
  // referral QR. 'only light' is the documented opt-out; the matching CSS
  // declaration lives on :root in globals.css because WebView force-dark
  // checks the CSS property rather than the meta tag.
  colorScheme: 'only light',
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

// Defensive guard against browser translation extensions (Google
// Translate, Edge, Safari, etc.) and content-script extensions that
// move or replace DOM nodes inside React-owned trees. When those
// engines reparent a text node, React's reconciler later calls
// parent.removeChild(child) with the wrong parent and throws
// 'Cannot read properties of null (reading removeChild)' or
// 'NotFoundError: ... not a child of this node'.
//
// We patch the Node prototypes ONCE, BEFORE React loads, so React's
// own DOM operations are routed through forgiving implementations.
// We do NOT swallow unrelated errors: any operation where the
// inputs are valid runs through the originals untouched.
//
// Patching Node.prototype is the smallest viable fix. Alternatives
// like wrapping ReactDOM internals or upgrading to react-dom's
// experimental error-recovery surface would require code changes
// across the app and a riskier dependency bump.
const DOM_GUARD_DEV_FLAG = process.env.NODE_ENV !== 'production';
const DOM_GUARD_SCRIPT = `
(function(){
  if (typeof window === 'undefined' || typeof Node === 'undefined') return;
  if (window.__PASHA9_DOM_GUARD_INSTALLED__) return;
  window.__PASHA9_DOM_GUARD_INSTALLED__ = true;

  var DEV = ${JSON.stringify(DOM_GUARD_DEV_FLAG)};
  var warnedRemove = false;
  var warnedInsert = false;
  var warnedReplace = false;
  var warnedElRemove = false;

  var originalRemoveChild = Node.prototype.removeChild;
  var originalInsertBefore = Node.prototype.insertBefore;
  var originalReplaceChild = Node.prototype.replaceChild;
  var originalElementRemove = typeof Element !== 'undefined' && Element.prototype.remove;

  Node.prototype.removeChild = function(child) {
    if (child && child.parentNode === this) {
      try { return originalRemoveChild.call(this, child); }
      catch (e) {
        if (DEV && !warnedRemove) {
          warnedRemove = true;
          try { console.warn('Pasha9 DOM guard caught removeChild throw'); } catch (_) {}
        }
        return child;
      }
    }
    if (DEV && !warnedRemove) {
      warnedRemove = true;
      try { console.warn('Pasha9 DOM guard handled external DOM mutation (removeChild)'); } catch (e) {}
    }
    return child;
  };

  Node.prototype.insertBefore = function(newNode, referenceNode) {
    if (referenceNode == null || referenceNode.parentNode === this) {
      try { return originalInsertBefore.call(this, newNode, referenceNode); }
      catch (e) {
        if (DEV && !warnedInsert) {
          warnedInsert = true;
          try { console.warn('Pasha9 DOM guard caught insertBefore throw'); } catch (_) {}
        }
        try { return Node.prototype.appendChild.call(this, newNode); } catch (_) { return newNode; }
      }
    }
    if (DEV && !warnedInsert) {
      warnedInsert = true;
      try { console.warn('Pasha9 DOM guard handled external DOM mutation (insertBefore)'); } catch (e) {}
    }
    try { return Node.prototype.appendChild.call(this, newNode); } catch (_) { return newNode; }
  };

  Node.prototype.replaceChild = function(newChild, oldChild) {
    if (oldChild && oldChild.parentNode === this) {
      try { return originalReplaceChild.call(this, newChild, oldChild); }
      catch (e) {
        if (DEV && !warnedReplace) {
          warnedReplace = true;
          try { console.warn('Pasha9 DOM guard caught replaceChild throw'); } catch (_) {}
        }
        try { return Node.prototype.appendChild.call(this, newChild); } catch (_) { return oldChild; }
      }
    }
    if (DEV && !warnedReplace) {
      warnedReplace = true;
      try { console.warn('Pasha9 DOM guard handled external DOM mutation (replaceChild)'); } catch (e) {}
    }
    try { return Node.prototype.appendChild.call(this, newChild); } catch (_) { return oldChild; }
  };

  // Element.prototype.remove() internally does
  // this.parentNode.removeChild(this). If parentNode is null,
  // the original throws with a less obvious stack. Re-implement
  // defensively.
  if (originalElementRemove) {
    Element.prototype.remove = function() {
      try {
        if (this && this.parentNode) {
          return originalRemoveChild.call(this.parentNode, this);
        }
      } catch (e) {
        if (DEV && !warnedElRemove) {
          warnedElRemove = true;
          try { console.warn('Pasha9 DOM guard caught Element.remove throw'); } catch (_) {}
        }
      }
      return undefined;
    };
  }
})();
`;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Same settings the metadata above reads, so the structured data carries the
  // operator's real brand name and logo rather than a hardcoded one. Failure
  // falls back to defaults: SEO markup must never be able to break the page.
  const seoRows = await db.systemSetting
    .findMany({ where: { key: { in: ['site_name', 'logo_url', 'favicon_url'] } } })
    .catch(() => [] as Array<{ key: string; value: string | null }>);
  const seo: Record<string, string> = {};
  for (const r of seoRows) if (r.value && r.value.trim()) seo[r.key] = r.value.trim();
  const seoSiteName = seo.site_name ?? 'Pasha 9';
  const seoLogo = seo.logo_url ?? seo.favicon_url ?? '/favicon.svg';

  const initialLang = resolveLang();
  const bodyFont = initialLang === 'bn' ? 'font-bn' : 'font-en';

  return (
    <html lang={initialLang} data-lang={initialLang} translate="no" suppressHydrationWarning className={`${fontBn.variable} ${fontEn.variable} ${fontAdmin.variable} ${fontDisplay.variable} notranslate`}>
      <head>
        {/* DOM guard runs synchronously before any other script so
            React's first render sees the forgiving prototypes. */}
        <script dangerouslySetInnerHTML={{ __html: DOM_GUARD_SCRIPT }} />
        {/* Belt + suspenders translation block; some browsers honour
            the meta name=google but not the translate attribute,
            and vice versa. The platform ships its own EN/BN
            dictionaries, so external translation only mutates DOM
            nodes that React owns and breaks reconciliation. */}
        <meta name="google" content="notranslate" />
      </head>
      <body className={`${bodyFont} antialiased notranslate`} translate="no" suppressHydrationWarning>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP_SCRIPT }} />
        {/* DynamicFavicon (runtime <link rel=icon> swap) was removed
            in Phase 3M after it surfaced as the production source
            of 'Cannot read properties of null (reading removeChild)'.
            Static metadata.icons in this file is now the source of
            truth. Operators can replace /public/favicon.svg if
            they need to rebrand. */}
        {/* Rendered server-side so crawlers see it in the initial HTML rather
            than after hydration, which many still do not execute. */}
        <StructuredData
          siteName={seoSiteName}
          siteUrl={SITE_ORIGIN}
          description={`${seoSiteName} brings a premium Bangla casino and betting experience.`}
          logoUrl={seoLogo}
        />
        <TrackingScripts />
        <Providers initialLang={initialLang}>{children}</Providers>
      </body>
    </html>
  );
}
