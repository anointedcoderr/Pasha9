// Built by Anointed Coder.
//
// Public /promotions page. M4 Phase D:
//   - Pulls banner / thumbnail / background / terms columns from the
//     extended /api/content/promotions endpoint.
//   - Claim button respects auth state. Guests are routed to the
//     register flow. Signed-in players hit /api/promotions/[id]/claim
//     and see the result inline.
//   - Per-rule disabledReason from the API drives a chip explaining
//     why a card cannot be self-claimed (first-deposit auto, VIP
//     not configured, etc.) instead of pretending to be claimable.
//   - Mobile responsive: banner uses a 16/9 fallback when no image is
//     uploaded; card height honours bottom-nav safe area.

'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { CategoryHero } from '@/components/site/CategoryHero';
import { BackBar } from '@/components/site/BackBar';
import { useT, useLang } from '@/lib/i18n/context';
import { Gift, Sparkles, Crown, Repeat, Users, Send, Ticket, Star, BadgePlus, AlertCircle, CheckCircle2, Lock } from 'lucide-react';
import { formatBDT } from '@/lib/utils/format';

type PromoType = 'first_deposit' | 'daily' | 'weekly' | 'referral' | 'vip' | 'invite' | 'reload' | 'manual' | 'promo';
type Filter = 'all' | PromoType;

interface Promo {
  id: string;
  name: string;
  type: PromoType;
  description: string | null;
  percentage: number;
  amount: number;
  minDeposit: number;
  maxBonus: number;
  turnoverX: number;
  validityDays: number;
  effective: string;
  bannerDesktopUrl: string | null;
  bannerMobileUrl: string | null;
  thumbnailUrl: string | null;
  backgroundUrl: string | null;
  termsEn: string | null;
  termsBn: string | null;
  claimedToday: boolean | null;
  claimedThisWeek: boolean | null;
  lastClaimAt: string | null;
  disabledReason: string | null;
  startsAt: string | null;
  endsAt: string | null;
}

interface MeShape { user?: { username?: string } }

const ICON: Record<PromoType, React.ComponentType<{ className?: string }>> = {
  first_deposit: Sparkles,
  daily: Repeat,
  weekly: Gift,
  referral: Users,
  vip: Crown,
  invite: Send,
  reload: Repeat,
  manual: BadgePlus,
  promo: Star,
};

const ACCENT_GRADIENT: Record<PromoType, string> = {
  first_deposit: 'from-brand-yellow-400 via-amber-500 to-orange-500',
  daily: 'from-emerald-400 via-emerald-600 to-teal-700',
  weekly: 'from-brand-blue-500 via-brand-blue-600 to-brand-blue-700',
  referral: 'from-fuchsia-500 via-indigo-600 to-indigo-800',
  vip: 'from-amber-400 via-orange-500 to-rose-600',
  invite: 'from-rose-400 via-rose-600 to-orange-600',
  reload: 'from-cyan-400 via-cyan-600 to-blue-700',
  manual: 'from-slate-500 via-slate-700 to-slate-900',
  promo: 'from-pink-400 via-rose-500 to-red-600',
};

type ClaimToast = { promoId: string; kind: 'ok' | 'err'; message: string };

export default function PromotionsPage() {
  const t = useT();
  const { lang } = useLang();
  const [filter, setFilter] = useState<Filter>('all');
  const [list, setList] = useState<Promo[]>([]);
  const [loading, setLoading] = useState(true);
  const [authed, setAuthed] = useState<boolean>(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [claiming, setClaiming] = useState<string | null>(null);
  const [toast, setToast] = useState<ClaimToast | null>(null);

  const load = () => {
    fetch('/api/content/promotions', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (Array.isArray(data?.promotions)) setList(data.promotions as Promo[]);
      })
      .catch(() => { /* keep empty */ })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    let alive = true;
    fetch('/api/auth/me', { cache: 'no-store', credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: MeShape | null) => {
        if (!alive) return;
        setAuthed(Boolean(j?.user?.username));
      })
      .catch(() => { if (alive) setAuthed(false); })
      .finally(() => { if (alive) setAuthChecked(true); });
    load();
    return () => { alive = false; };
  }, []);

  const filtered = useMemo(() => {
    if (filter === 'all') return list;
    return list.filter((r) => r.type === filter);
  }, [filter, list]);

  const filters: Array<{ key: Filter; label: string }> = [
    { key: 'all', label: t('common.all') },
    { key: 'first_deposit', label: t('promotions.firstDeposit') },
    { key: 'daily', label: t('promotions.daily') },
    { key: 'weekly', label: t('promotions.weekly') },
    { key: 'referral', label: t('promotions.referral') },
    { key: 'vip', label: t('promotions.vip') },
    { key: 'invite', label: t('promotions.invite') },
  ];

  const handleClaim = async (promo: Promo) => {
    if (!authChecked) return;
    if (!authed) { window.location.href = '/?login=1'; return; }
    setClaiming(promo.id);
    setToast(null);
    try {
      const r = await fetch(`/api/promotions/${encodeURIComponent(promo.id)}/claim`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
      });
      const j = await r.json().catch(() => null);
      if (!r.ok) {
        const code = j?.code as string | undefined;
        const message = j?.message as string | undefined;
        if (r.status === 401) { window.location.href = '/?login=1'; return; }
        setToast({ promoId: promo.id, kind: 'err', message: message ?? code ?? 'Claim failed' });
        return;
      }
      setToast({
        promoId: promo.id,
        kind: 'ok',
        message: lang === 'bn'
          ? `${formatBDT(Number(j?.amount ?? 0))} বোনাস আপনার অ্যাকাউন্টে যোগ হয়েছে।`
          : `${formatBDT(Number(j?.amount ?? 0))} bonus credited to your account.`,
      });
      load();
    } catch (e) {
      setToast({ promoId: promo.id, kind: 'err', message: e instanceof Error ? e.message : 'Claim failed' });
    } finally {
      setClaiming(null);
    }
  };

  return (
    <div className="space-y-6 pb-24 md:pb-6">
      <BackBar title={t('promotions.title')} />
      <CategoryHero
        kicker={t('promotions.title')}
        title={t('promotions.title')}
        description={t('promotions.subtitle')}
        accent="yellow"
        category="promotions"
        chips={[
          { label: 'Bonus', tone: 'gold' },
          { label: 'Wallet Connected', tone: 'sky' },
        ]}
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          {filters.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className="pill-provider"
              data-active={filter === f.key}
            >
              {f.label}
            </button>
          ))}
        </div>
        <p className="text-xs text-brand-inkMute">
          {filtered.length} {t('cat.results')}
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-brand-inkSoft">Loading promotions...</p>
      ) : filtered.length === 0 ? (
        <div className="card-light p-6 text-center text-sm text-brand-inkSoft">
          {lang === 'bn' ? 'এখন কোনো প্রোমো নেই। শিগগিরই আবার দেখুন।' : 'No live promotions right now. Check back soon.'}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((rule) => (
            <PromoCard
              key={rule.id}
              promo={rule}
              lang={lang}
              busy={claiming === rule.id}
              toast={toast?.promoId === rule.id ? toast : null}
              onClaim={() => handleClaim(rule)}
              authChecked={authChecked}
              authed={authed}
              t={t}
            />
          ))}
        </div>
      )}

      <section className="card-light p-6">
        <h2 className="text-lg font-extrabold text-brand-ink">{t('promotions.termsTitle')}</h2>
        <p className="mt-2 text-sm text-brand-inkSoft">{t('promotions.termsBody')}</p>
      </section>
    </div>
  );
}

function PromoCard({
  promo, lang, busy, toast, onClaim, authChecked, authed, t,
}: {
  promo: Promo;
  lang: 'en' | 'bn';
  busy: boolean;
  toast: ClaimToast | null;
  onClaim: () => void;
  authChecked: boolean;
  authed: boolean;
  t: (k: string) => string;
}) {
  const Icon = ICON[promo.type] ?? Ticket;
  const tagLabel =
    promo.type === 'first_deposit' ? t('promotions.firstDeposit') :
    promo.type === 'daily' ? t('promotions.daily') :
    promo.type === 'weekly' ? t('promotions.weekly') :
    promo.type === 'referral' ? t('promotions.referral') :
    promo.type === 'vip' ? t('promotions.vip') :
    promo.type === 'invite' ? t('promotions.invite') :
    promo.type === 'reload' ? (lang === 'bn' ? 'রিলোড' : 'Reload') :
    promo.type === 'manual' ? (lang === 'bn' ? 'বিশেষ' : 'Special') :
    (lang === 'bn' ? 'প্রোমো' : 'Promo');
  const headlineValue = promo.percentage > 0
    ? `${promo.percentage}%`
    : promo.amount > 0 ? formatBDT(promo.amount) : '-';

  const banner = promo.bannerDesktopUrl ?? promo.bannerMobileUrl ?? promo.thumbnailUrl ?? null;
  const terms = lang === 'bn' && promo.termsBn ? promo.termsBn : promo.termsEn;

  const claimed = promo.type === 'weekly' ? promo.claimedThisWeek : promo.claimedToday;

  const disabled = (() => {
    if (busy) return true;
    if (claimed) return true;
    if (promo.disabledReason && authed) return true;
    return false;
  })();

  const disabledMessage = (() => {
    if (claimed) return lang === 'bn' ? 'আজ ইতিমধ্যে দাবি করা হয়েছে' : 'Already claimed';
    if (!authed) return null;
    switch (promo.disabledReason) {
      case 'auto_first_deposit': return lang === 'bn' ? 'প্রথম ডিপোজিটে অটো ক্রেডিট' : 'Auto-credited on first deposit';
      case 'vip_not_configured': return lang === 'bn' ? 'VIP কনফিগার করা হয়নি' : 'VIP not configured yet';
      case 'cashback_not_configured': return lang === 'bn' ? 'ক্যাশব্যাক কনফিগার করা হয়নি' : 'Cashback not configured yet';
      default: return null;
    }
  })();

  const claimLabel = claimed
    ? (lang === 'bn' ? 'দাবি করা হয়েছে' : 'Claimed')
    : busy
      ? (lang === 'bn' ? 'লোড...' : 'Claiming...')
      : (lang === 'bn' ? 'দাবি করুন' : 'Claim');

  return (
    <article className="overflow-hidden rounded-2xl border border-brand-divider bg-brand-paper">
      <div className={`relative aspect-[16/9] overflow-hidden bg-gradient-to-br ${ACCENT_GRADIENT[promo.type] ?? ACCENT_GRADIENT.promo}`}>
        {banner ? (
          <picture>
            {promo.bannerMobileUrl ? (
              <source media="(max-width: 768px)" srcSet={promo.bannerMobileUrl} />
            ) : null}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={banner}
              alt={promo.name}
              className="absolute inset-0 h-full w-full object-cover"
              loading="lazy"
            />
          </picture>
        ) : null}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.25),transparent_55%)]" />
        <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-3 px-4 py-3 text-white">
          <span className="text-[10px] font-bold uppercase tracking-wider drop-shadow">{tagLabel}</span>
          <span className="rounded-full bg-black/35 px-2.5 py-1 text-[11px] font-semibold backdrop-blur">{headlineValue}</span>
        </div>
        <div className="absolute right-4 top-4 flex h-12 w-12 items-center justify-center rounded-xl bg-white/15 text-white backdrop-blur">
          <Icon className="h-5 w-5" />
        </div>
      </div>

      <div className="px-5 py-4">
        <h3 className="text-base font-extrabold text-brand-ink">{promo.name}</h3>
        {promo.description ? <p className="mt-1.5 text-sm text-brand-inkSoft">{promo.description}</p> : null}
        <p className="mt-2 text-xs text-brand-inkMute">{promo.effective}</p>

        <dl className="mt-4 grid grid-cols-2 gap-3 text-xs">
          <Cell label={lang === 'bn' ? 'সর্বনিম্ন' : 'Min Deposit'} value={promo.minDeposit > 0 ? formatBDT(promo.minDeposit) : '-'} />
          <Cell label={lang === 'bn' ? 'সর্বোচ্চ' : 'Max Bonus'} value={promo.maxBonus > 0 ? formatBDT(promo.maxBonus) : (lang === 'bn' ? 'কোনো সীমা নেই' : 'No cap')} />
          <Cell label={lang === 'bn' ? 'টার্নওভার' : 'Turnover'} value={promo.turnoverX > 0 ? `${promo.turnoverX}x` : (lang === 'bn' ? 'নেই' : 'None')} />
          <Cell label={lang === 'bn' ? 'মেয়াদ' : 'Validity'} value={promo.validityDays > 0 ? `${promo.validityDays} d` : (lang === 'bn' ? 'মেয়াদহীন' : 'No expiry')} />
        </dl>

        {terms ? (
          <details className="mt-3 rounded-lg border border-brand-divider bg-brand-surface p-2 text-xs">
            <summary className="cursor-pointer font-semibold text-brand-ink">{lang === 'bn' ? 'শর্তাবলী' : 'Terms and conditions'}</summary>
            <p className="mt-2 whitespace-pre-wrap leading-relaxed text-brand-inkSoft">{terms}</p>
          </details>
        ) : null}

        <div className="mt-4 flex items-center justify-between gap-2">
          <span className="text-xs font-semibold text-emerald-700">{lang === 'bn' ? 'চলছে' : 'Live'}</span>
          {!authChecked || authed ? (
            <button
              type="button"
              disabled={disabled}
              onClick={onClaim}
              className={`btn-yellow inline-flex h-9 items-center rounded-lg px-4 text-xs ${disabled ? 'opacity-60' : ''}`}
            >
              {claimed ? <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> : null}
              {claimLabel}
            </button>
          ) : (
            <Link href="/?signup=1" className="btn-yellow inline-flex h-9 items-center rounded-lg px-4 text-xs">
              {lang === 'bn' ? 'দাবি করুন' : 'Claim'}
            </Link>
          )}
        </div>
        {disabledMessage ? (
          <p className="mt-2 inline-flex items-start gap-1 text-[11px] text-brand-inkMute">
            <Lock className="mt-0.5 h-3 w-3" />
            <span>{disabledMessage}</span>
          </p>
        ) : null}
        {toast ? (
          <p className={`mt-2 inline-flex items-start gap-1 text-[12px] ${toast.kind === 'ok' ? 'text-emerald-700' : 'text-rose-600'}`}>
            {toast.kind === 'ok' ? <CheckCircle2 className="mt-0.5 h-3.5 w-3.5" /> : <AlertCircle className="mt-0.5 h-3.5 w-3.5" />}
            <span>{toast.message}</span>
          </p>
        ) : null}
      </div>
    </article>
  );
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-brand-divider bg-brand-surface p-2">
      <dt className="text-[10px] font-semibold uppercase tracking-wider text-brand-inkMute">{label}</dt>
      <dd className="mt-0.5 font-semibold text-brand-ink tabular-nums">{value}</dd>
    </div>
  );
}
