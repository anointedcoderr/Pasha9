// Built by Anointed Coder.
//
// Root global error boundary. Catches anything that the route-level
// error.tsx files cannot - including layout errors and the most
// common production failure mode: a stale JS chunk after deploy.
//
// Stale-chunk pattern: nginx / CDN serves cached HTML that
// references a chunk hash from the previous build, but the new
// build replaced that chunk. The browser fails to load the chunk
// and the page raises before any route-level boundary mounts. We
// detect ChunkLoadError + the matching message patterns and force
// a hard reload, which fetches the latest HTML + chunks.
//
// global-error.tsx must include its own <html><body> because it
// REPLACES the root layout when it fires.

'use client';

import { useEffect } from 'react';

function isChunkLoadError(err: { name?: string; message?: string } | undefined): boolean {
  if (!err) return false;
  const name = (err.name || '').toLowerCase();
  const msg = (err.message || '').toLowerCase();
  if (name.includes('chunkloaderror')) return true;
  if (msg.includes('loading chunk')) return true;
  if (msg.includes('failed to fetch dynamically imported module')) return true;
  if (msg.includes('importing a module script failed')) return true;
  return false;
}

const RELOAD_FLAG = 'pasha9_chunk_reload_at';
const RELOAD_COOLDOWN_MS = 30_000;

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const chunkError = isChunkLoadError(error);

  useEffect(() => {
    // Log to the browser console so the operator can grab the stack
    // out of devtools without having to recreate the failure.
    console.error('[global-error] uncaught', error);

    if (!chunkError) return;
    // Avoid a reload-loop if the new chunks are themselves broken:
    // only reload once per 30 seconds, tracked in sessionStorage.
    try {
      const last = Number(sessionStorage.getItem(RELOAD_FLAG) || '0');
      if (Date.now() - last < RELOAD_COOLDOWN_MS) return;
      sessionStorage.setItem(RELOAD_FLAG, String(Date.now()));
      window.location.reload();
    } catch {
      // sessionStorage blocked. Best-effort reload.
      window.location.reload();
    }
  }, [error, chunkError]);

  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif', background: '#0c0c0c', color: '#f4ecd8' }}>
        <div style={{ maxWidth: 640, margin: '6rem auto', padding: '2rem', borderRadius: 16, background: '#161616', border: '1px solid #2a2a2a' }}>
          <p style={{ fontSize: 12, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#FFCC00' }}>Pasha 9</p>
          <h1 style={{ marginTop: 8, fontSize: 22, fontWeight: 800 }}>
            {chunkError ? 'Refreshing to pick up the latest build' : 'Something interrupted the page'}
          </h1>
          <p style={{ marginTop: 8, fontSize: 14, lineHeight: 1.5, color: '#d8d2bf' }}>
            {chunkError
              ? 'Your browser was holding an older copy of the app. We are forcing a refresh now. If this screen stays for more than a few seconds, clear the cache or open the site in a fresh tab.'
              : 'The page raised an error during render. Reload to retry. If it persists, copy the digest below into a bug report.'}
          </p>
          {error?.digest ? <p style={{ marginTop: 12, fontFamily: 'monospace', fontSize: 12, color: '#aaa' }}>digest: {error.digest}</p> : null}
          {error?.message ? <p style={{ marginTop: 4, fontFamily: 'monospace', fontSize: 12, color: '#aaa', wordBreak: 'break-all' }}>message: {error.message}</p> : null}
          <div style={{ marginTop: 24, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => { try { sessionStorage.removeItem(RELOAD_FLAG); } catch { /* noop */ } reset(); }}
              style={{ background: '#FFCC00', color: '#111', border: 0, borderRadius: 10, padding: '10px 16px', fontWeight: 800, cursor: 'pointer' }}
            >
              Reload
            </button>
            <a
              href="/"
              style={{ background: 'transparent', color: '#f4ecd8', border: '1px solid #444', borderRadius: 10, padding: '10px 16px', textDecoration: 'none', fontWeight: 600 }}
            >
              Home
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}
