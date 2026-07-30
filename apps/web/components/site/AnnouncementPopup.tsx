// Built by Anointed Coder.
//
// Targeted announcement popups (#9). Reads every active popup from
// /api/content/popups and decides which to show based on:
//   - target: where/when it appears (entry, homepage, deposit_page,
//     deposit_click, withdrawal_page, auth_page, all_pages, custom_url)
//   - frequency: how often per visitor (always, once_per_session,
//     once_per_day, once_per_user) tracked in session/localStorage
// Each popup can carry an image, a CTA, and an uploaded voice/audio message
// played from a speaker control. Action popups (deposit_click) fire via a
// window event so a Deposit button can trigger them with firePopupAction.

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X, Volume2, Play, Pause, RotateCcw } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useT } from '@/lib/i18n/context';

const POPUP_ACTION_EVENT = 'pasha9:popup-action';

/** Fire an action-targeted popup (e.g. from a Deposit button click). */
export function firePopupAction(action: 'deposit_click') {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(POPUP_ACTION_EVENT, { detail: { action } }));
}

interface PopupItem {
  id: string;
  title: string;
  body: string;
  ctaLabel?: string | null;
  ctaHref?: string | null;
  target: string;
  targetUrl?: string | null;
  frequency: string;
  imageUrl?: string | null;
  audioUrl?: string | null;
}

function seenKey(id: string) {
  return `pasha9_popup_${id}`;
}

function hasSeen(p: PopupItem): boolean {
  if (typeof window === 'undefined') return true;
  const key = seenKey(p.id);
  try {
    if (p.frequency === 'once_per_session') return sessionStorage.getItem(key) === '1';
    if (p.frequency === 'once_per_user') return localStorage.getItem(key) === '1';
    if (p.frequency === 'once_per_day') return localStorage.getItem(key) === new Date().toISOString().slice(0, 10);
  } catch {
    /* storage blocked */
  }
  return false; // 'always'
}

function markSeen(p: PopupItem) {
  if (typeof window === 'undefined') return;
  const key = seenKey(p.id);
  try {
    if (p.frequency === 'once_per_session') sessionStorage.setItem(key, '1');
    else if (p.frequency === 'once_per_user') localStorage.setItem(key, '1');
    else if (p.frequency === 'once_per_day') localStorage.setItem(key, new Date().toISOString().slice(0, 10));
  } catch {
    /* storage blocked */
  }
}

// Popups dismissed during THIS page session. A module-level set (not React
// state) so a closed popup is never re-selected on the same render tick.
// Without this an 'always'-frequency popup re-opens itself immediately and
// reads as "the close button does not work / needs several clicks". Cleared
// on a full reload, where the frequency rules take over again.
const dismissedIds = new Set<string>();

// Normalize an admin-entered page path so custom-URL targeting matches the
// router pathname. Accepts a full URL, a bare path, or missing/extra slashes.
function normalizePath(raw: string | null | undefined): string {
  if (!raw) return '';
  let s = String(raw).trim();
  if (!s) return '';
  if (/^https?:\/\//i.test(s)) {
    try { s = new URL(s).pathname; } catch { /* keep raw */ }
  }
  s = s.split('?')[0].split('#')[0].trim();
  if (!s) return '/';
  if (!s.startsWith('/')) s = `/${s}`;
  s = s.replace(/\/{2,}/g, '/');
  return s.length > 1 ? s.replace(/\/+$/, '') : s;
}

// Normalize a CTA link: external URLs / mailto / tel / anchors pass through;
// an internal path gets a single leading slash so it never resolves relative
// to the current route.
function normalizeHref(raw: string | null | undefined): string {
  const s = (raw ?? '').trim();
  if (!s) return '';
  if (/^(https?:)?\/\//i.test(s) || /^(mailto:|tel:|#)/i.test(s)) return s;
  return s.startsWith('/') ? s : `/${s}`;
}

function matchesPage(p: PopupItem, pathname: string): boolean {
  switch (p.target) {
    case 'all_pages':
      return true;
    case 'entry':
      return true; // shows on load; frequency governs how often
    case 'homepage':
      return pathname === '/';
    case 'deposit_page':
      return pathname.startsWith('/deposit');
    case 'withdrawal_page':
      return pathname.startsWith('/withdraw');
    case 'auth_page':
      return pathname.startsWith('/auth') || pathname.startsWith('/login') || pathname.startsWith('/register');
    case 'custom_url': {
      const target = normalizePath(p.targetUrl);
      if (!target) return false;
      const path = normalizePath(pathname) || '/';
      return path === target || path.startsWith(`${target}/`);
    }
    case 'deposit_click':
      return false; // action-triggered only
    default:
      return false;
  }
}

export function AnnouncementPopup() {
  const t = useT();
  const pathname = usePathname() ?? '/';
  const [popups, setPopups] = useState<PopupItem[]>([]);
  const [active, setActive] = useState<PopupItem | null>(null);

  useEffect(() => {
    fetch('/api/content/popups')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setPopups(Array.isArray(d?.popups) ? (d.popups as PopupItem[]) : []))
      .catch(() => {});
  }, []);

  // Page-targeted popups: show the first eligible one for the current path.
  useEffect(() => {
    if (active) return;
    const candidate = popups.find((p) => p.target !== 'deposit_click' && matchesPage(p, pathname) && !hasSeen(p) && !dismissedIds.has(p.id));
    if (candidate) setActive(candidate);
  }, [popups, pathname, active]);

  // Action-targeted popups (deposit_click, ...) fired from a button.
  useEffect(() => {
    const onAction = (e: Event) => {
      const action = (e as CustomEvent).detail?.action as string | undefined;
      if (!action) return;
      setActive((prev) => prev ?? popups.find((p) => p.target === action && !hasSeen(p) && !dismissedIds.has(p.id)) ?? null);
    };
    window.addEventListener(POPUP_ACTION_EVENT, onAction);
    return () => window.removeEventListener(POPUP_ACTION_EVENT, onAction);
  }, [popups]);

  // A Deposit button anywhere (any link to /deposit, or an element tagged
  // data-deposit-trigger) fires a deposit_click popup. Observe-only in the
  // capture phase, so navigation still proceeds normally.
  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      const el = (e.target as HTMLElement | null)?.closest?.(
        'a[href="/deposit"], a[href^="/deposit?"], a[href^="/deposit#"], [data-deposit-trigger]',
      );
      if (!el) return;
      setActive((prev) => prev ?? popups.find((p) => p.target === 'deposit_click' && !hasSeen(p) && !dismissedIds.has(p.id)) ?? null);
    };
    document.addEventListener('click', onDocClick, true);
    return () => document.removeEventListener('click', onDocClick, true);
  }, [popups]);

  const close = useCallback(() => {
    setActive((cur) => {
      if (cur) {
        markSeen(cur);
        dismissedIds.add(cur.id);
      }
      return null;
    });
  }, []);

  if (!active) return null;

  return (
    <Dialog.Root open onOpenChange={(v) => { if (!v) close(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-2xl bg-brand-paper shadow-2xl">
          <div className="flex items-center justify-between border-b border-brand-divider px-5 py-3">
            <Dialog.Title className="text-sm font-semibold text-brand-ink">
              {t('home.announcementHeader')}
            </Dialog.Title>
            <Dialog.Close
              aria-label="Close"
              className="flex h-10 w-10 items-center justify-center rounded-full text-brand-inkMute hover:bg-brand-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue-500/40 sm:h-8 sm:w-8"
            >
              <X className="h-4 w-4" />
            </Dialog.Close>
          </div>

          {active.imageUrl ? (
            <div className="relative aspect-[5/3] w-full overflow-hidden bg-brand-surface">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={active.imageUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
            </div>
          ) : null}

          <div className="space-y-3 px-5 py-4">
            <h3 className="text-lg font-extrabold leading-tight text-brand-ink">{active.title}</h3>
            <p className="whitespace-pre-line text-sm text-brand-inkSoft">{active.body}</p>

            {active.audioUrl ? <PopupAudio src={active.audioUrl} /> : null}

            <div className="flex flex-col gap-2 pt-1 sm:flex-row sm:justify-end">
              <button onClick={close} className="btn-outline-ink inline-flex h-10 items-center justify-center rounded-lg px-4 text-sm">
                {t('common.cancel')}
              </button>
              {active.ctaLabel && active.ctaHref ? (
                <Link
                  href={normalizeHref(active.ctaHref)}
                  onClick={close}
                  className="btn-yellow inline-flex h-10 items-center justify-center rounded-lg px-5 text-sm"
                >
                  {active.ctaLabel}
                </Link>
              ) : null}
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

// Voice/audio control with a speaker icon, play/pause and replay.
function PopupAudio({ src }: { src: string }) {
  const ref = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);

  const toggle = () => {
    const a = ref.current;
    if (!a) return;
    if (a.paused) void a.play();
    else a.pause();
  };
  const replay = () => {
    const a = ref.current;
    if (!a) return;
    a.currentTime = 0;
    void a.play();
  };

  return (
    <div className="flex items-center gap-2 rounded-lg border border-brand-divider bg-brand-surface px-3 py-2">
      <Volume2 className="h-4 w-4 shrink-0 text-brand-blue-600" />
      <button
        type="button"
        onClick={toggle}
        aria-label={playing ? 'Pause voice message' : 'Play voice message'}
        className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-yellow-500 text-brand-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue-500/40"
      >
        {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
      </button>
      <button
        type="button"
        onClick={replay}
        aria-label="Replay voice message"
        className="flex h-8 w-8 items-center justify-center rounded-full border border-brand-divider text-brand-inkMute hover:bg-brand-paper focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue-500/40"
      >
        <RotateCcw className="h-3.5 w-3.5" />
      </button>
      <span className="text-xs font-semibold text-brand-inkMute">Listen to this message</span>
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <audio
        ref={ref}
        src={src}
        preload="none"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
      />
    </div>
  );
}
