// Built by Anointed Coder.
//
// Root global error boundary. Catches anything that route-level
// error.tsx files cannot, including layout errors and the two
// recurring production failure modes:
//
//   1. Stale JS chunk after deploy (ChunkLoadError).
//   2. DOM-mutation crash triggered by browser translation engines
//      or extensions:
//        - Cannot read properties of null (reading 'removeChild')
//        - Cannot read properties of null (reading 'insertBefore')
//        - Cannot read properties of null (reading 'replaceChild')
//        - reading 'get' (Radix portal map miss)
//        - NotFoundError: ... not a child of this node
//
// Recovery strategy (Phase 3M):
//
//   - Recovery flags are scoped to BUILD_ID + pathname so a new
//     deploy starts the counter fresh. Old flags expire on every
//     build.
//   - Up to TWO automatic reloads per (build, pathname). First
//     reload is the silent stale-state recovery. Second reload is
//     the safe-mode fallback (?safe=1 query) so the page renders
//     without TrackingScripts and other client extras. Third
//     failure falls through to the error card with diagnostics.
//   - Manual 'Reload' clears the per-pathname counter.
//   - 'Clear recovery and reload' wipes ALL recovery flags for
//     this build and reloads.
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

const BUILD_ID = process.env.NEXT_PUBLIC_BUILD_ID || 'unknown';
const CHUNK_RELOAD_FLAG = 'pasha9_chunk_reload_at';
const RECOVERY_PREFIX = 'pasha9_recovery';
const RELOAD_COOLDOWN_MS = 30_000;
const MAX_RECOVERY_RELOADS = 2;

function recoveryKey(pathname: string): string {
  return `${RECOVERY_PREFIX}_${BUILD_ID}_${pathname || '/'}`;
}

function readRecoveryCount(pathname: string): number {
  try { return Number(sessionStorage.getItem(recoveryKey(pathname)) || '0') || 0; }
  catch { return 0; }
}

function bumpRecoveryCount(pathname: string, n: number): void {
  try { sessionStorage.setItem(recoveryKey(pathname), String(n)); }
  catch { /* sessionStorage blocked */ }
}

function clearAllRecovery(): void {
  try {
    const toRemove: string[] = [];
    for (let i = 0; i < sessionStorage.length; i += 1) {
      const k = sessionStorage.key(i);
      if (k && k.startsWith(RECOVERY_PREFIX)) toRemove.push(k);
    }
    for (const k of toRemove) sessionStorage.removeItem(k);
    sessionStorage.removeItem(CHUNK_RELOAD_FLAG);
  } catch { /* noop */ }
}

function reloadWithSafe(): void {
  try {
    const url = new URL(window.location.href);
    url.searchParams.set('safe', '1');
    window.location.replace(url.toString());
  } catch {
    try { window.location.reload(); } catch { /* noop */ }
  }
}

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const chunkError = isChunkLoadError(error);
  const domMutation = isDomMutationCrash(error);
  const [autoRecovering, setAutoRecovering] = useState(false);
  const [showStack, setShowStack] = useState(false);
  const [diag, setDiag] = useState<{ path: string; ua: string; guard: boolean; notranslate: boolean; recoveryCount: number; buildId: string } | null>(null);

  useEffect(() => {
    console.error('[global-error] uncaught', error);

    const path = typeof window !== 'undefined' ? window.location.pathname : '/';
    const count = readRecoveryCount(path);

    try {
      setDiag({
        path,
        ua: typeof navigator !== 'undefined' ? navigator.userAgent : '',
        guard: typeof window !== 'undefined' && Boolean((window as unknown as { __PASHA9_DOM_GUARD_INSTALLED__?: boolean }).__PASHA9_DOM_GUARD_INSTALLED__),
        notranslate: typeof document !== 'undefined' && document.documentElement?.classList?.contains('notranslate') === true,
        recoveryCount: count,
        buildId: BUILD_ID,
      });
    } catch { /* diag panel optional */ }

    try {
      if (chunkError) {
        const last = Number(sessionStorage.getItem(CHUNK_RELOAD_FLAG) || '0');
        if (Date.now() - last < RELOAD_COOLDOWN_MS) return;
        sessionStorage.setItem(CHUNK_RELOAD_FLAG, String(Date.now()));
        setAutoRecovering(true);
        window.location.reload();
        return;
      }

      if (domMutation && count < MAX_RECOVERY_RELOADS) {
        bumpRecoveryCount(path, count + 1);
        setAutoRecovering(true);
        // Short timer so the user briefly sees the recovery state.
        if (count + 1 === MAX_RECOVERY_RELOADS) {
          // Second recovery: append ?safe=1 to skip non-essential
          // client extras (TrackingScripts) so we can rule out
          // third parties.
          window.setTimeout(() => reloadWithSafe(), 150);
        } else {
          window.setTimeout(() => { try { window.location.reload(); } catch { /* noop */ } }, 150);
        }
      }
    } catch {
      if (chunkError || domMutation) {
        setAutoRecovering(true);
        try { window.location.reload(); } catch { /* noop */ }
      }
    }
  }, [error, chunkError, domMutation]);

  const onReloadClick = () => {
    try {
      const path = typeof window !== 'undefined' ? window.location.pathname : '/';
      sessionStorage.removeItem(recoveryKey(path));
      sessionStorage.removeItem(CHUNK_RELOAD_FLAG);
    } catch { /* noop */ }
    reset();
  };

  const onClearAllClick = () => {
    clearAllRecovery();
    try { window.location.reload(); } catch { /* noop */ }
  };

  const onSafeModeClick = () => {
    reloadWithSafe();
  };

  const titleText = autoRecovering
    ? 'Refreshing the page'
    : chunkError
      ? 'Refreshing to pick up the latest build'
      : domMutation
        ? 'Browser extension interrupted the page'
        : 'Something interrupted the page';

  const bodyText = autoRecovering
    ? 'Auto-refresh is running. If you stay on this screen for more than a few seconds, disable browser translation for this site or open it in a fresh tab.'
    : chunkError
      ? 'Your browser was holding an older copy of the app. We are forcing a refresh now.'
      : domMutation
        ? 'A browser extension (most often Google Translate) mutated the page before it finished loading. Try the safe-mode reload below; if it works, the extension is the cause. Otherwise copy the diagnostics into a bug report.'
        : 'The page raised an error during render. Reload to retry. If it persists, copy the diagnostics below into a bug report.';

  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif', background: '#0c0c0c', color: '#f4ecd8' }}>
        <div style={{ maxWidth: 760, margin: '4rem auto', padding: '2rem', borderRadius: 16, background: '#161616', border: '1px solid #2a2a2a' }}>
          <p style={{ fontSize: 12, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#FFCC00' }}>Pasha 9</p>
          <h1 style={{ marginTop: 8, fontSize: 22, fontWeight: 800 }}>{titleText}</h1>
          <p style={{ marginTop: 8, fontSize: 14, lineHeight: 1.5, color: '#d8d2bf' }}>{bodyText}</p>
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
            <button
              type="button"
              onClick={onSafeModeClick}
              style={{ background: 'transparent', color: '#FFCC00', border: '1px solid #FFCC00', borderRadius: 10, padding: '10px 16px', fontWeight: 700, cursor: 'pointer' }}
            >
              Reload in safe mode
            </button>
            <button
              type="button"
              onClick={onClearAllClick}
              style={{ background: 'transparent', color: '#f4ecd8', border: '1px solid #444', borderRadius: 10, padding: '10px 16px', fontWeight: 600, cursor: 'pointer' }}
            >
              Clear recovery and reload
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
                  <p style={{ margin: 0 }}>build: <span style={{ color: '#f4ecd8' }}>{diag.buildId}</span></p>
                  <p style={{ margin: '4px 0 0' }}>path: <span style={{ color: '#f4ecd8' }}>{diag.path}</span></p>
                  <p style={{ margin: '4px 0 0' }}>recovery count: <span style={{ color: '#f4ecd8' }}>{diag.recoveryCount} / {MAX_RECOVERY_RELOADS}</span></p>
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
