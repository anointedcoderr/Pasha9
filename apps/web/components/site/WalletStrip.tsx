// Built by Anointed Coder.
// Babu-style premium wallet/balance strip for the homepage. Adapts between
// guest (login/register CTA) and logged-in (greeting + balance + actions).
//
// Reads /api/auth/me on mount and exposes a refresh action so a deposit that
// just got approved is reflected as soon as the user taps the icon. A custom
// 'pasha9:wallet-refresh' window event is also listened to so any other
// page action (deposit submit, withdrawal submit) can trigger a refresh.

'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowDownToLine, ArrowUpToLine, ReceiptText, RefreshCw, Sparkles, UserPlus, LogIn } from 'lucide-react';
import { useT, useLang } from '@/lib/i18n/context';
import { ROUTES } from '@/lib/constants/routes';
import { formatBDT } from '@/lib/utils/format';
import { cn } from '@/lib/utils/cn';

interface Me {
  id: string;
  username: string;
  wallet?: { balance: number | string; bonusBalance?: number | string };
}

const REFRESH_EVENT = 'pasha9:wallet-refresh';

export function WalletStrip() {
  const t = useT();
  const { lang } = useLang();
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await fetch('/api/auth/me', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setMe((data?.user as Me) ?? null);
      } else {
        setMe(null);
      }
    } catch {
      /* ignore */
    } finally {
      setRefreshing(false);
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    load();
    const handler = () => load();
    window.addEventListener(REFRESH_EVENT, handler);
    return () => window.removeEventListener(REFRESH_EVENT, handler);
  }, [load]);

  if (!loaded) {
    return (
      <section className="card-light h-[110px] animate-pulse bg-brand-surface" aria-hidden />
    );
  }

  if (!me) {
    return (
      <section className="relative overflow-hidden rounded-2xl bg-[linear-gradient(135deg,#15171C_0%,#1E2128_55%,#0F1115_100%)] p-5 text-white shadow-[0_10px_30px_-18px_rgba(15,17,21,0.7)]">
        <span
          aria-hidden
          className="pointer-events-none absolute -right-12 -top-12 h-44 w-44 rounded-full bg-brand-yellow-500/30 blur-3xl"
        />
        <span
          aria-hidden
          className="pointer-events-none absolute -left-8 bottom-0 h-32 w-32 rounded-full bg-brand-blue-500/30 blur-3xl"
        />
        <div className="relative flex flex-col items-stretch gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-yellow-500/15 text-brand-yellow-500">
              <Sparkles className="h-5 w-5" />
            </span>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-brand-yellow-300/90">
                {lang === 'bn' ? 'পাশা ৯ এ স্বাগতম' : 'Welcome to Pasha 9'}
              </p>
              <h2 className="mt-1 text-lg font-extrabold leading-tight sm:text-xl">
                {lang === 'bn' ? 'রেজিস্টার করুন এবং বোনাস দাবি করুন' : 'Register now and claim your bonus'}
              </h2>
              <p className="mt-1 text-xs text-white/70">
                {lang === 'bn' ? 'নতুন প্লেয়ারদের জন্য বিশেষ ফার্স্ট ডিপোজিট বোনাস।' : 'Special first deposit bonus waiting for you.'}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 gap-2">
            <Link
              href="/?signup=1"
              className="btn-yellow inline-flex h-11 items-center justify-center rounded-xl px-5 text-sm"
            >
              <UserPlus className="mr-1.5 h-4 w-4" />
              {t('navx.register')}
            </Link>
            <Link
              href="/?login=1"
              className="inline-flex h-11 items-center justify-center rounded-xl border border-white/20 bg-white/10 px-5 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/15"
            >
              <LogIn className="mr-1.5 h-4 w-4" />
              {t('navx.login')}
            </Link>
          </div>
        </div>
      </section>
    );
  }

  const balance = Number(me.wallet?.balance ?? 0);

  return (
    <section className="relative overflow-hidden rounded-2xl border border-brand-yellow-500/15 bg-[linear-gradient(135deg,#0F1115_0%,#1A1D24_60%,#0F1115_100%)] p-4 text-white shadow-[0_18px_44px_-26px_rgba(15,17,21,0.85)] md:p-5">
      {/* Decorative glows */}
      <span
        aria-hidden
        className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-brand-yellow-500/25 blur-3xl"
      />
      <span
        aria-hidden
        className="pointer-events-none absolute -left-10 bottom-0 h-40 w-40 rounded-full bg-brand-blue-500/20 blur-3xl"
      />
      {/* Diagonal hairline */}
      <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brand-yellow-500/60 to-transparent" />

      <div className="relative grid gap-4 md:grid-cols-[1fr_auto] md:items-center">
        <div className="flex items-start gap-3 min-w-0">
          <span className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#FFE066_0%,#FFCC00_55%,#F5B400_100%)] text-brand-ink shadow-[inset_0_1px_0_rgba(255,255,255,0.55),inset_0_-2px_4px_rgba(168,114,0,0.35),0_10px_22px_-6px_rgba(245,180,0,0.7)] ring-1 ring-black/10">
            <Sparkles className="h-5 w-5 drop-shadow-[0_1px_1px_rgba(0,0,0,0.25)]" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-[12px] font-semibold text-white/70">
              {lang === 'bn' ? 'হ্যালো' : 'Hi'}, <span className="font-bold text-white">{me.username}</span>
            </p>
            <div className="mt-0.5 flex items-baseline gap-2">
              <p
                className="truncate text-2xl font-black tabular-nums leading-none md:text-[28px]"
                style={{
                  backgroundImage:
                    'linear-gradient(180deg,#FFFFFF 0%,#FFE9A8 70%,#F5B400 100%)',
                  WebkitBackgroundClip: 'text',
                  backgroundClip: 'text',
                  color: 'transparent',
                }}
              >
                {formatBDT(balance)}
              </p>
              <button
                type="button"
                onClick={load}
                disabled={refreshing}
                aria-label={lang === 'bn' ? 'ব্যালেন্স রিফ্রেশ' : 'Refresh balance'}
                title={lang === 'bn' ? 'ব্যালেন্স রিফ্রেশ' : 'Refresh balance'}
                className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-white/70 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-yellow-500/60"
              >
                <RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} />
              </button>
            </div>
            <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.18em] text-white/55">
              {lang === 'bn' ? 'মূল ব্যালেন্স' : 'Main balance'}
            </p>
          </div>
        </div>

        <div className="relative z-10 grid grid-cols-3 gap-2 md:flex md:gap-2">
          <Link
            href={ROUTES.deposit}
            prefetch={false}
            onClick={(e) => { e.preventDefault(); router.push(ROUTES.deposit); }}
            className="btn-yellow inline-flex h-11 items-center justify-center rounded-xl px-3 text-[13px] shadow-[0_8px_16px_-6px_rgba(245,180,0,0.65)]"
          >
            <ArrowDownToLine className="mr-1.5 h-4 w-4" />
            {t('wallet.deposit')}
          </Link>
          <Link
            href={ROUTES.withdraw}
            prefetch={false}
            onClick={(e) => { e.preventDefault(); router.push(ROUTES.withdraw); }}
            className="inline-flex h-11 items-center justify-center rounded-xl border border-white/20 bg-white/[0.07] px-3 text-[13px] font-semibold text-white backdrop-blur transition hover:border-white/40 hover:bg-white/[0.13]"
          >
            <ArrowUpToLine className="mr-1.5 h-4 w-4 text-brand-yellow-400" />
            {t('wallet.withdraw')}
          </Link>
          <Link
            href={ROUTES.transactions}
            prefetch={false}
            onClick={(e) => { e.preventDefault(); router.push(ROUTES.transactions); }}
            className="inline-flex h-11 items-center justify-center rounded-xl border border-white/20 bg-white/[0.07] px-3 text-[13px] font-semibold text-white backdrop-blur transition hover:border-white/40 hover:bg-white/[0.13]"
          >
            <ReceiptText className="mr-1.5 h-4 w-4 text-brand-yellow-400" />
            {lang === 'bn' ? 'ইতিহাস' : 'History'}
          </Link>
        </div>
      </div>
    </section>
  );
}

export function triggerWalletRefresh() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(REFRESH_EVENT));
  }
}
