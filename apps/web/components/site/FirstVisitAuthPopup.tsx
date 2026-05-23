// Built by Anointed Coder.
//
// First-visit login / register popup. Shows automatically the first time
// a guest visitor lands on the site and stays dismissed for 30 days via
// the pasha9_first_visit_seen cookie. Hidden entirely for logged-in
// users and for visitors who have already dismissed it.
//
// Opening Login or Register routes through ?login=1 / ?signup=1 so the
// existing Header auth modal handles the actual flow without us having
// to duplicate the form here.

'use client';

import { useEffect, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { useRouter } from 'next/navigation';
import { X, UserPlus, LogIn, Sparkles } from 'lucide-react';
import { useLang } from '@/lib/i18n/context';

const COOKIE_KEY = 'pasha9_first_visit_seen';
const COOKIE_DAYS = 30;
const SHOW_DELAY_MS = 1200;

function hasSeenCookie(): boolean {
  if (typeof document === 'undefined') return true;
  return document.cookie.split('; ').some((row) => row.startsWith(`${COOKIE_KEY}=`));
}

function setSeenCookie() {
  if (typeof document === 'undefined') return;
  const maxAge = COOKIE_DAYS * 24 * 60 * 60;
  document.cookie = `${COOKIE_KEY}=1; max-age=${maxAge}; path=/; samesite=lax`;
}

export function FirstVisitAuthPopup() {
  const { lang } = useLang();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (hasSeenCookie()) return;
    let cancelled = false;

    // Only show for guests. If /api/auth/me returns a user we silently
    // mark the popup as seen so logged-in returning users do not get it.
    fetch('/api/auth/me', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled) return;
        if (data?.user) {
          setSeenCookie();
          return;
        }
        // Delay slightly so it does not steal focus from first paint.
        const id = window.setTimeout(() => {
          if (!cancelled) setOpen(true);
        }, SHOW_DELAY_MS);
        return () => window.clearTimeout(id);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, []);

  const close = () => {
    setSeenCookie();
    setOpen(false);
  };

  const choose = (kind: 'login' | 'signup') => {
    setSeenCookie();
    setOpen(false);
    router.push(`/?${kind}=1`);
  };

  return (
    <Dialog.Root open={open} onOpenChange={(v) => { if (!v) close(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[60] bg-black/65 backdrop-blur-sm" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed left-1/2 top-1/2 z-[60] w-[calc(100%-1.5rem)] max-w-[400px] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-2xl bg-brand-paper shadow-2xl outline-none"
        >
          <Dialog.Title className="sr-only">
            {lang === 'bn' ? 'পাশা ৯ এ স্বাগতম' : 'Welcome to Pasha 9'}
          </Dialog.Title>
          <div className="relative">
            <Dialog.Close
              aria-label={lang === 'bn' ? 'বন্ধ' : 'Close'}
              className="absolute right-3 top-3 z-10 inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/80 text-brand-ink shadow transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue-500/40"
            >
              <X className="h-4 w-4" />
            </Dialog.Close>

            <div className="relative overflow-hidden bg-[linear-gradient(135deg,#0F1115_0%,#1A1D24_60%,#0F1115_100%)] px-6 pb-10 pt-12 text-white">
              <span
                aria-hidden
                className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-brand-yellow-500/30 blur-3xl"
              />
              <span
                aria-hidden
                className="pointer-events-none absolute -left-10 bottom-0 h-32 w-32 rounded-full bg-brand-blue-500/30 blur-3xl"
              />
              <div className="relative">
                <span className="inline-flex items-center gap-2 rounded-full bg-brand-yellow-500/15 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-brand-yellow-300">
                  <Sparkles className="h-3.5 w-3.5" />
                  {lang === 'bn' ? 'স্বাগতম' : 'Welcome'}
                </span>
                <h2 className="mt-3 text-2xl font-extrabold leading-tight">
                  {lang === 'bn' ? 'পাশা ৯ এ যোগ দিন' : 'Join Pasha 9'}
                </h2>
                <p className="mt-2 text-sm text-white/75">
                  {lang === 'bn'
                    ? 'রেজিস্টার করে প্রথম ডিপোজিট বোনাস দাবি করুন, অথবা লগইন করে খেলা শুরু করুন।'
                    : 'Register to claim the first deposit bonus, or log in to keep playing.'}
                </p>
              </div>
            </div>

            <div className="space-y-2 px-6 pb-6 pt-4">
              <button
                type="button"
                onClick={() => choose('signup')}
                className="btn-yellow flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold"
              >
                <UserPlus className="h-4 w-4" />
                {lang === 'bn' ? 'এখন রেজিস্টার করুন' : 'Register now'}
              </button>
              <button
                type="button"
                onClick={() => choose('login')}
                className="btn-outline-ink flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm"
              >
                <LogIn className="h-4 w-4 text-brand-blue-600" />
                {lang === 'bn' ? 'আমার অ্যাকাউন্ট আছে, লগইন' : 'I have an account, log in'}
              </button>
              <button
                type="button"
                onClick={close}
                className="block w-full pt-1 text-center text-xs font-semibold text-brand-inkMute hover:text-brand-ink"
              >
                {lang === 'bn' ? 'পরে দেখব' : 'Maybe later'}
              </button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
