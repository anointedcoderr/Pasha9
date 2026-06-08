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
import { usePathname, useRouter } from 'next/navigation';
import { ArrowDownToLine, ArrowUpToLine, ReceiptText, RefreshCw, Sparkles, UserPlus, LogIn, type LucideIcon } from 'lucide-react';
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
  const pathname = usePathname();
  const [me, setMe] = useState<Me | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loaded, setLoaded] = useState(false);
  // pendingActive lifts the active highlight to the tapped segment
  // immediately, before Next.js' router transitions the URL. usePathname
  // updates a few frames later; combining both keeps the indicator in
  // sync without a flash of empty selection.
  const [pendingActive, setPendingActive] = useState<string | null>(null);

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
          <SegmentedActions
            className="shrink-0"
            items={[
              {
                key: 'register',
                label: t('navx.register'),
                icon: UserPlus,
                href: '/?signup=1',
                onTap: () => {
                  setPendingActive('register');
                  // Dispatch a same-page event so Header opens the
                  // auth modal even when the URL is already at /.
                  if (typeof window !== 'undefined') {
                    window.dispatchEvent(new CustomEvent('pasha9:open-signup'));
                  }
                  router.push('/?signup=1');
                },
              },
              {
                key: 'login',
                label: t('navx.login'),
                icon: LogIn,
                href: '/?login=1',
                onTap: () => {
                  setPendingActive('login');
                  if (typeof window !== 'undefined') {
                    window.dispatchEvent(new CustomEvent('pasha9:open-login'));
                  }
                  router.push('/?login=1');
                },
              },
            ]}
            activeKey={pendingActive ?? 'register'}
          />
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

        <SegmentedActions
          items={[
            {
              key: 'deposit',
              label: t('wallet.deposit'),
              icon: ArrowDownToLine,
              href: ROUTES.deposit,
              onTap: () => { setPendingActive('deposit'); router.push(ROUTES.deposit); },
            },
            {
              key: 'withdraw',
              label: t('wallet.withdraw'),
              icon: ArrowUpToLine,
              href: ROUTES.withdraw,
              onTap: () => { setPendingActive('withdraw'); router.push(ROUTES.withdraw); },
            },
            {
              key: 'history',
              label: lang === 'bn' ? 'ইতিহাস' : 'History',
              icon: ReceiptText,
              href: ROUTES.transactions,
              onTap: () => { setPendingActive('history'); router.push(ROUTES.transactions); },
            },
          ]}
          activeKey={
            pendingActive
              ?? (pathname === ROUTES.withdraw ? 'withdraw' : pathname === ROUTES.transactions ? 'history' : pathname === ROUTES.deposit ? 'deposit' : 'deposit')
          }
        />
      </div>
    </section>
  );
}

export function triggerWalletRefresh() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(REFRESH_EVENT));
  }
}

interface SegmentedItem {
  key: string;
  label: string;
  icon: LucideIcon;
  href: string;
  onTap: () => void;
}

/**
 * Pill-tab style action group shared between the guest auth strip and
 * the logged-in wallet strip. The currently-active key gets a bright
 * yellow background; the others stay translucent. Tapping a tab calls
 * the supplied onTap (which lifts pendingActive and pushes the route)
 * and falls back to Link href for non-JS environments and crawlers.
 */
function SegmentedActions({
  items,
  activeKey,
  className,
}: {
  items: SegmentedItem[];
  activeKey: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'relative z-10 inline-flex w-full items-stretch rounded-xl border border-white/10 bg-white/[0.05] p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] backdrop-blur md:w-auto',
        className,
      )}
    >
      {items.map((item) => {
        const Icon = item.icon;
        const active = item.key === activeKey;
        return (
          <Link
            key={item.key}
            href={item.href}
            prefetch={false}
            onClick={(e) => {
              e.preventDefault();
              item.onTap();
            }}
            className={cn(
              'inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-lg px-3 text-[12px] font-semibold transition-all duration-200 sm:text-[13px] md:flex-none md:px-4',
              active
                ? 'bg-gradient-to-b from-brand-yellow-300 via-brand-yellow-500 to-[#F5B400] text-brand-ink shadow-[inset_0_1px_0_rgba(255,255,255,0.55),0_8px_18px_-8px_rgba(245,180,0,0.75)] [text-shadow:0_1px_0_rgba(255,255,255,0.35)]'
                : 'text-white/85 hover:bg-white/10 hover:text-white active:scale-[0.97]',
            )}
            aria-current={active ? 'page' : undefined}
          >
            <Icon className={cn('h-4 w-4', active ? 'text-brand-ink' : 'text-brand-yellow-400')} />
            <span className="truncate">{item.label}</span>
          </Link>
        );
      })}
    </div>
  );
}
