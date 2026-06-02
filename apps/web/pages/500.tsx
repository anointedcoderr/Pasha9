// Built by Anointed Coder.
//
// Legacy pages-router 500 fallback. Same rationale as
// pages/_error.tsx: ensures the runtime require contract is
// satisfied so the server never raises MODULE_NOT_FOUND.

import type { NextPage } from 'next';

const ServerError: NextPage = () => {
  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#0c0c0c', color: '#f4ecd8', fontFamily: 'system-ui, sans-serif', padding: 24 }}>
      <div style={{ maxWidth: 480, width: '100%', padding: 32, borderRadius: 16, background: '#161616', border: '1px solid #2a2a2a' }}>
        <p style={{ fontSize: 12, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#FFCC00' }}>Pasha 9</p>
        <h1 style={{ marginTop: 8, fontSize: 22, fontWeight: 800 }}>Server error</h1>
        <p style={{ marginTop: 8, fontSize: 14, lineHeight: 1.5, color: '#d8d2bf' }}>
          We hit an unexpected error on the server. Reload to try again; if it keeps happening, check pm2 logs.
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

export default ServerError;
