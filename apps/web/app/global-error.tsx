// Built by Anointed Coder.
//
// Root global error boundary. Catches anything that the route-level
// error.tsx files cannot - including layout errors and two
// recurring production failure modes:
//
//   1. Stale JS chunk after deploy (ChunkLoadError). We detect and
//      hard-reload once with a 30s cooldown.
//   2. DOM-mutation crash triggered by browser translation engines
//      or extensions. The symptom is one of:
//        - Cannot read properties of null (reading 'removeChild')
//        - Cannot read properties of null (reading 'insertBefore')
//        - Cannot read properties of null (reading 'get')
//      The first paint is corrupted because the extension touched
//      the DOM before React finished reconciling. Once we reload
//      with the DOM-guard script already installed in <head>, the
//      second paint is clean. We trigger ONE recovery reload per
//      pathname per session to avoid hiding real bugs.
//
// global-error.tsx must include its own <html><body> because it
// REPLACES the root layout when it fires.

'use client';

import { useEffect, useState } from 'react';

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

function isDomMutationCrash(err: { message?: string } | undefined): boolean {
  if (!err) return false;
  const msg = (err.message || '').toLowerCase();
  if (msg.includes("reading 'removechild'")) return true;
  if (msg.includes("reading 'insertbefore'")) return true;
  if (msg.includes("reading 'replacechild'")) return true;
  if (msg.includes("reading 'get'")) return true;
  if (msg.includes('not a child of this node')) return true;
  return false;
}

const CHUNK_RELOAD_FLAG = 'pasha9_chunk_reload_at';
const RECOVERY_PREFIX = 'pasha9_recovered_';
const RELOAD_COOLDOWN_MS = 30_000;

function recoveryFlagFor(pathname: string): string {
  return `${RECOVERY_PREFIX}${pathname || '/'}`;
}

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const chunkError = isChunkLoadError(error);
  const domMutation = isDomMutationCrash(error);
  const [autoRecovering, setAutoRecovering] = useState(false);
  const [showStack, setShowStack] = useState(false);
  const [diag, setDiag] = useState<{ path: string; ua: string; guard: boolean; notranslate: boolean } | null>(null);

  useEffect(() => {
    console.error('[global-error] uncaught', error);

    try {
      const path = typeof window !== 'undefined' ? window.location.pathname : '/';
      setDiag({
        path,
        ua: typeof navigator !== 'undefined' ? navigator.userAgent : '',
        guard: typeof window !== 'undefined' && Boolean((window as unknown as { __PASHA9_DOM_GUARD_INSTALLED__?: boolean }).__PASHA9_DOM_GUARD_INSTALLED__),
        notranslate: typeof document !== 'undefined' && document.documentElement?.classList?.contains('notranslate') === true,
      });

      if (chunkError) {
        const last = Number(sessionStorage.getItem(CHUNK_RELOAD_FLAG) || '0');
        if (Date.now() - last < RELOAD_COOLDOWN_MS) return;
        sessionStorage.setItem(CHUNK_RELOAD_FLAG, String(Date.now()));
        setAutoRecovering(true);
        window.location.reload();
        return;
      }

      if (domMutation) {
        // One-time recovery reload per pathname per session. The
        // DOM-guard script in <head> patches Node prototypes before
        // React mounts, so a second paint is usually clean.
        const key = recoveryFlagFor(path);
        if (!sessionStorage.getItem(key)) {
          sessionStorage.setItem(key, String(Date.now()));
          setAutoRecovering(true);
          window.location.reload();
          return;
        }
      }
    } catch {
      // sessionStorage blocked or window unavailable. Best-effort.
      if (chunkError || domMutation) {
        setAutoRecovering(true);
        try { window.location.reload(); } catch { /* noop */ }
      }
    }
  }, [error, chunkError, domMutation]);

  const onReloadClick = () => {
    try {
      // Manual reload clears the per-pathname recovery flag so a
      // future first-paint crash on the same path is retried once
      // more.
      const path = typeof window !== 'undefined' ? window.location.pathname : '/';
      sessionStorage.removeItem(recoveryFlagFor(path));
      sessionStorage.removeItem(CHUNK_RELOAD_FLAG);
    } catch { /* noop */ }
    reset();
  };

  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif', background: '#0c0c0c', color: '#f4ecd8' }}>
        <div style={{ maxWidth: 720, margin: '4rem auto', padding: '2rem', borderRadius: 16, background: '#161616', border: '1px solid #2a2a2a' }}>
          <p style={{ fontSize: 12, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#FFCC00' }}>Pasha 9</p>
          <h1 style={{ marginTop: 8, fontSize: 22, fontWeight: 800 }}>
            {autoRecovering
              ? 'Refreshing the page'
              : chunkError
                ? 'Refreshing to pick up the latest build'
                : domMutation
                  ? 'Browser extension interrupted the page'
                  : 'Something interrupted the page'}
          </h1>
          <p style={{ marginTop: 8, fontSize: 14, lineHeight: 1.5, color: '#d8d2bf' }}>
            {autoRecovering
              ? 'One-time auto-refresh is running. If you stay on this screen for more than a few seconds, disable browser translation for this site or open it in a fresh tab.'
              : chunkError
                ? 'Your browser was holding an older copy of the app. We are forcing a refresh now.'
                : domMutation
                  ? 'A browser extension (most often Google Translate) mutated the page before it finished loading. Disable translation for pasha9.com and reload.'
                  : 'The page raised an error during render. Reload to retry. If it persists, copy the diagnostics below into a bug report.'}
          </p>
          {error?.digest ? <p style={{ marginTop: 12, fontFamily: 'monospace', fontSize: 12, color: '#aaa' }}>digest: {error.digest}</p> : null}
          {error?.message ? <p style={{ marginTop: 4, fontFamily: 'monospace', fontSize: 12, color: '#aaa', wordBreak: 'break-all' }}>message: {error.message}</p> : null}

          <div style={{ marginTop: 24, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={onReloadClick}
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
            <button
              type="button"
              onClick={() => setShowStack((v) => !v)}
              style={{ background: 'transparent', color: '#f4ecd8', border: '1px solid #444', borderRadius: 10, padding: '10px 16px', fontWeight: 600, cursor: 'pointer' }}
            >
              {showStack ? 'Hide diagnostics' : 'Show diagnostics'}
            </button>
          </div>

          {showStack ? (
            <div style={{ marginTop: 24, padding: 16, borderRadius: 12, background: '#0c0c0c', border: '1px solid #2a2a2a', fontFamily: 'monospace', fontSize: 11, color: '#bbb' }}>
              {diag ? (
                <>
                  <p style={{ margin: 0 }}>path: <span style={{ color: '#f4ecd8' }}>{diag.path}</span></p>
                  <p style={{ margin: '4px 0 0' }}>guard installed: <span style={{ color: diag.guard ? '#7ed957' : '#ff9d6c' }}>{String(diag.guard)}</span></p>
                  <p style={{ margin: '4px 0 0' }}>notranslate class: <span style={{ color: diag.notranslate ? '#7ed957' : '#ff9d6c' }}>{String(diag.notranslate)}</span></p>
                  <p style={{ margin: '4px 0 0', wordBreak: 'break-all' }}>ua: <span style={{ color: '#f4ecd8' }}>{diag.ua}</span></p>
                </>
              ) : null}
              {error?.stack ? (
                <>
                  <p style={{ marginTop: 12, marginBottom: 4, color: '#FFCC00' }}>stack (first 20 lines)</p>
                  <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all', color: '#bbb' }}>
                    {error.stack.split('\n').slice(0, 20).join('\n')}
                  </pre>
                </>
              ) : null}
            </div>
          ) : null}
        </div>
      </body>
    </html>
  );
}
