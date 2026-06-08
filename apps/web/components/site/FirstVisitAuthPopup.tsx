// Built by Anointed Coder.
//
// First-visit welcome popup. Now consumes the admin config exposed by
// /api/content/welcome-popup; every text and button is rendered
// conditionally so the operator can ship an image-only popup or
// suppress individual buttons without producing empty placeholders.
// Falls back to bundled defaults when the operator has not configured
// any value so a fresh database still shows a useful welcome.

'use client';

import { useEffect, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { useRouter } from 'next/navigation';
import { X, UserPlus, LogIn, Sparkles } from 'lucide-react';
import { useLang } from '@/lib/i18n/context';
import { cn } from '@/lib/utils/cn';

const COOKIE_KEY = 'pasha9_first_visit_seen';
const SHOW_DELAY_MS = 1200;
const FREQ_TO_MAX_AGE: Record<string, number | null> = {
  every_visit: 0,
  once_per_session: 0,
  once_per_day: 24 * 60 * 60,
  once_per_30_days: 30 * 24 * 60 * 60,
};

interface RemoteConfig {
  enabled: boolean;
  imageOnly: boolean;
  frequency: keyof typeof FREQ_TO_MAX_AGE;
  imageUrl: string | null;
  titleEn: string | null;
  titleBn: string | null;
  bodyEn: string | null;
  bodyBn: string | null;
  registerTextEn: string | null;
  registerTextBn: string | null;
  registerUrl: string | null;
  loginTextEn: string | null;
  loginTextBn: string | null;
  loginUrl: string | null;
  laterTextEn: string | null;
  laterTextBn: string | null;
}

function hasSeenCookie(): boolean {
  if (typeof document === 'undefined') return true;
  return document.cookie.split('; ').some((row) => row.startsWith(`${COOKIE_KEY}=`));
}

function hasSeenSession(): boolean {
  if (typeof window === 'undefined') return true;
  try { return window.sessionStorage.getItem(COOKIE_KEY) === '1'; } catch { return false; }
}

function setSeen(frequency: string) {
  if (typeof document === 'undefined') return;
  const maxAge = FREQ_TO_MAX_AGE[frequency] ?? FREQ_TO_MAX_AGE.once_per_30_days!;
  if (frequency === 'once_per_session') {
    try { window.sessionStorage.setItem(COOKIE_KEY, '1'); } catch { /* ignore */ }
    return;
  }
  if (!maxAge || maxAge <= 0) return; // every_visit: do not persist
  document.cookie = `${COOKIE_KEY}=1; max-age=${maxAge}; path=/; samesite=lax`;
}

export function FirstVisitAuthPopup() {
  const { lang } = useLang();
  const bn = lang === 'bn';
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [config, setConfig] = useState<RemoteConfig | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/content/welcome-popup', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: RemoteConfig | null) => {
        if (!cancelled && data) setConfig(data);
      })
      .catch(() => { /* fall back to defaults below */ });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!config) return;
    if (!config.enabled) return;
    const freq = config.frequency;
    if (freq === 'once_per_session' && hasSeenSession()) return;
    if ((freq === 'once_per_day' || freq === 'once_per_30_days') && hasSeenCookie()) return;

    let cancelled = false;
    fetch('/api/auth/me', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled) return;
        if (data?.user) {
          setSeen(freq);
          return;
        }
        const id = window.setTimeout(() => { if (!cancelled) setOpen(true); }, SHOW_DELAY_MS);
        return () => window.clearTimeout(id);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [config]);

  if (!config) return null;
  const freq = config.frequency;
  const close = () => { setSeen(freq); setOpen(false); };

  const pick = (en: string | null, bn1: string | null, fallback: string): string => (
    bn ? (bn1?.trim() || en?.trim() || fallback) : (en?.trim() || fallback)
  );
  const title = config.titleEn || config.titleBn
    ? pick(config.titleEn, config.titleBn, '')
    : (bn ? 'পাশা ৯ এ যোগ দিন' : 'Join Pasha 9');
  const body = config.bodyEn || config.bodyBn
    ? pick(config.bodyEn, config.bodyBn, '')
    : (bn
        ? 'রেজিস্টার করে প্রথম ডিপোজিট বোনাস দাবি করুন, অথবা লগইন করে খেলা শুরু করুন।'
        : 'Register to claim the first deposit bonus, or log in to keep playing.');
  const registerText = config.registerTextEn || config.registerTextBn
    ? pick(config.registerTextEn, config.registerTextBn, '')
    : (bn ? 'এখন রেজিস্টার করুন' : 'Register now');
  const loginText = config.loginTextEn || config.loginTextBn
    ? pick(config.loginTextEn, config.loginTextBn, '')
    : (bn ? 'আমার অ্যাকাউন্ট আছে, লগইন' : 'I have an account, log in');
  const laterText = config.laterTextEn || config.laterTextBn
    ? pick(config.laterTextEn, config.laterTextBn, '')
    : (bn ? 'পরে দেখব' : 'Maybe later');

  const registerUrl = config.registerUrl?.trim() || '/?signup=1';
  const loginUrl = config.loginUrl?.trim() || '/?login=1';

  const choose = (kind: 'login' | 'signup', target: string) => {
    setSeen(freq); setOpen(false);
    if (target.startsWith('http')) { window.location.href = target; return; }
    router.push(target.startsWith('/') ? target : `/?${kind}=1`);
  };

  const imageOnly = config.imageOnly && Boolean(config.imageUrl);
  const showRegister = !imageOnly && Boolean(registerText);
  const showLogin = !imageOnly && Boolean(loginText);
  const showLater = Boolean(laterText);

  return (
    <Dialog.Root open={open} onOpenChange={(v) => { if (!v) close(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[60] bg-black/65 backdrop-blur-sm" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed left-1/2 top-1/2 z-[60] w-[calc(100%-1.5rem)] max-w-[400px] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-2xl bg-brand-paper shadow-2xl outline-none"
        >
          <Dialog.Title className="sr-only">{title || (bn ? 'স্বাগতম' : 'Welcome')}</Dialog.Title>
          <div className="relative">
            <Dialog.Close
              aria-label={bn ? 'বন্ধ' : 'Close'}
              className="absolute right-3 top-3 z-10 inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/85 text-brand-ink shadow transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue-500/40"
            >
              <X className="h-4 w-4" />
            </Dialog.Close>

            {imageOnly ? (
              <a href={registerUrl} onClick={(e) => { e.preventDefault(); choose('signup', registerUrl); }} className="block">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={config.imageUrl ?? ''} alt="" className="block h-auto w-full" />
              </a>
            ) : (
              <div
                className={cn(
                  'relative overflow-hidden bg-[linear-gradient(135deg,#0F1115_0%,#1A1D24_60%,#0F1115_100%)] px-6 pb-10 pt-12 text-white',
                )}
              >
                {config.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={config.imageUrl} alt="" aria-hidden className="absolute inset-0 h-full w-full object-cover opacity-55" />
                ) : (
                  <>
                    <span aria-hidden className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-brand-yellow-500/30 blur-3xl" />
                    <span aria-hidden className="pointer-events-none absolute -left-10 bottom-0 h-32 w-32 rounded-full bg-brand-blue-500/30 blur-3xl" />
                  </>
                )}
                <div className="relative">
                  <span className="inline-flex items-center gap-2 rounded-full bg-brand-yellow-500/15 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-brand-yellow-300">
                    <Sparkles className="h-3.5 w-3.5" />
                    {bn ? 'স্বাগতম' : 'Welcome'}
                  </span>
                  {title ? <h2 className="mt-3 text-2xl font-extrabold leading-tight [text-shadow:0_1px_8px_rgba(0,0,0,0.75)]">{title}</h2> : null}
                  {body ? <p className="mt-2 text-sm text-white/85 [text-shadow:0_1px_6px_rgba(0,0,0,0.6)]">{body}</p> : null}
                </div>
              </div>
            )}

            {(showRegister || showLogin || showLater) ? (
              <div className="space-y-2 px-6 pb-6 pt-4">
                {showRegister ? (
                  <button
                    type="button"
                    onClick={() => choose('signup', registerUrl)}
                    className="btn-yellow flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold"
                  >
                    <UserPlus className="h-4 w-4" />
                    {registerText}
                  </button>
                ) : null}
                {showLogin ? (
                  <button
                    type="button"
                    onClick={() => choose('login', loginUrl)}
                    className="btn-outline-ink flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm"
                  >
                    <LogIn className="h-4 w-4 text-brand-blue-600" />
                    {loginText}
                  </button>
                ) : null}
                {showLater ? (
                  <button
                    type="button"
                    onClick={close}
                    className="block w-full pt-1 text-center text-xs font-semibold text-brand-inkMute hover:text-brand-ink"
                  >
                    {laterText}
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
