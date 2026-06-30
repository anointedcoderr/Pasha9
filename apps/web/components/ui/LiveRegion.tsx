// Built by Anointed Coder.
//
// Accessible live-region primitive. Renders two visually hidden but
// screen-reader-visible regions so assistive tech announces messages:
//  - role="status" aria-live="polite" for success and info
//  - role="alert" aria-live="assertive" for errors
// Dependency-free and SSR-safe. Wrap the app with <LiveRegionProvider> and
// call useAnnounce() to push a message.

'use client';

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

export type AnnounceTone = 'polite' | 'assertive';

type AnnounceOptions = {
  /** 'polite' (default) for success/info, 'assertive' for errors. */
  tone?: AnnounceTone;
};

type Announce = (message: string, options?: AnnounceOptions) => void;

const LiveRegionContext = createContext<Announce | null>(null);

export function LiveRegionProvider({ children }: { children: ReactNode }) {
  const [polite, setPolite] = useState('');
  const [assertive, setAssertive] = useState('');
  const clearTimers = useRef<{ polite?: number; assertive?: number }>({});

  const announce = useCallback<Announce>((message, options) => {
    if (!message) return;
    const tone: AnnounceTone = options?.tone ?? 'polite';
    const set = tone === 'assertive' ? setAssertive : setPolite;
    // Clear first, then set on the next tick so repeated identical messages
    // are still announced (a region that does not change is not re-read).
    set('');
    const handle = window.setTimeout(() => set(message), 50);
    if (clearTimers.current[tone]) window.clearTimeout(clearTimers.current[tone]);
    clearTimers.current[tone] = handle;
  }, []);

  const sr = 'pointer-events-none absolute h-px w-px overflow-hidden whitespace-nowrap border-0 p-0 [clip:rect(0,0,0,0)]';

  const value = useMemo(() => announce, [announce]);

  return (
    <LiveRegionContext.Provider value={value}>
      {children}
      <div role="status" aria-live="polite" aria-atomic="true" className={sr}>
        {polite}
      </div>
      <div role="alert" aria-live="assertive" aria-atomic="true" className={sr}>
        {assertive}
      </div>
    </LiveRegionContext.Provider>
  );
}

/**
 * Returns an announce(message, { tone }) function that pushes a message to the
 * matching live region. Safe to call when no provider is mounted (no-op).
 */
export function useAnnounce(): Announce {
  const ctx = useContext(LiveRegionContext);
  return ctx ?? (() => {});
}
