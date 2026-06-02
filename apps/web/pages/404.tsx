// Built by Anointed Coder.
//
// Legacy pages-router 404. App-router has its own not-found
// surface; this file exists so the build emits
// `.next/server/pages/404.js` for the runtime require contract.

import type { NextPage } from 'next';

const NotFound: NextPage = () => {
  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#0c0c0c', color: '#f4ecd8', fontFamily: 'system-ui, sans-serif', padding: 24 }}>
      <div style={{ maxWidth: 480, width: '100%', padding: 32, borderRadius: 16, background: '#161616', border: '1px solid #2a2a2a' }}>
        <p style={{ fontSize: 12, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#FFCC00' }}>Pasha 9</p>
        <h1 style={{ marginTop: 8, fontSize: 22, fontWeight: 800 }}>Not found</h1>
        <p style={{ marginTop: 8, fontSize: 14, lineHeight: 1.5, color: '#d8d2bf' }}>
          The page you asked for does not exist.
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

export default NotFound;
