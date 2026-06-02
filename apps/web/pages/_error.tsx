// Built by Anointed Coder.
//
// Legacy pages-router error fallback. Pasha 9 is app-router only,
// but Next.js 14's server-side runtime in some deploy paths still
// expects to `require('.next/server/pages/_error.js')`. When that
// file does not exist production crashes with MODULE_NOT_FOUND and
// every page surfaces the framework's bare error overlay before
// any of our app-router error boundaries can mount.
//
// Shipping this file forces the build to emit
// `.next/server/pages/_error.js`, satisfies the runtime require,
// and lets the app-router boundaries (`app/global-error.tsx`,
// `app/(admin)/admin/error.tsx`, route-specific error.tsx files)
// own the actual error UI.
//
// Real errors still go through app/global-error.tsx. This file is
// pure scaffolding.

import type { NextPage } from 'next';

interface ErrorProps {
  statusCode?: number;
}

const PagesErrorFallback: NextPage<ErrorProps> = ({ statusCode }) => {
  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#0c0c0c', color: '#f4ecd8', fontFamily: 'system-ui, sans-serif', padding: 24 }}>
      <div style={{ maxWidth: 480, width: '100%', padding: 32, borderRadius: 16, background: '#161616', border: '1px solid #2a2a2a' }}>
        <p style={{ fontSize: 12, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#FFCC00' }}>Pasha 9</p>
        <h1 style={{ marginTop: 8, fontSize: 22, fontWeight: 800 }}>
          {statusCode ? `Server error ${statusCode}` : 'Server error'}
        </h1>
        <p style={{ marginTop: 8, fontSize: 14, lineHeight: 1.5, color: '#d8d2bf' }}>
          The server hit an unexpected error. Reload the page; if it persists, the operator should check pm2 logs and the admin error feed.
        </p>
        <div style={{ marginTop: 24 }}>
          <a href="/" style={{ display: 'inline-block', background: '#FFCC00', color: '#111', borderRadius: 10, padding: '10px 16px', fontWeight: 800, textDecoration: 'none' }}>
            Home
          </a>
        </div>
      </div>
    </div>
  );
};

PagesErrorFallback.getInitialProps = (ctx) => {
  const statusCode = ctx.res?.statusCode ?? ctx.err?.statusCode ?? 500;
  return { statusCode };
};

export default PagesErrorFallback;
