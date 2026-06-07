// Built by Anointed Coder.

'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { CategoryHero } from '@/components/site/CategoryHero';
import { BackBar } from '@/components/site/BackBar';
import { PromotionBannerSlider, type PromotionBannerRow } from '@/components/site/PromotionBannerSlider';
import { useT, useLang } from '@/lib/i18n/context';
import { Gift, Sparkles, Crown, Repeat, Users, Send, Ticket, Star, BadgePlus, AlertCircle, CheckCircle2, Lock } from 'lucide-react';
import { formatBDT } from '@/lib/utils/format';

type PromoType = 'first_deposit' | 'daily' | 'weekly' | 'referral' | 'vip' | 'invite' | 'reload' | 'manual' | 'promo';
type PromoCategory = 'first_deposit_bonus' | 'daily_bonus' | 'weekly_reward' | 'referral_bonus' | 'vip_reward' | 'invite_friend_offer' | 'other';
type Filter = 'all' | Exclude<PromoCategory, 'other'>;

interface Promo {
  id: string;
  name: string;
  nameBn: string | null;
  type: PromoType;
  category: PromoCategory;
  description: string | null;
  descriptionBn: string | null;
  bannerUrl: string | null;
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
  termsEn: string | null;
  termsBn: string | null;
  claimed: boolean | null;
  disabledReason: string | null;
  claimAction: 'direct' | 'deposit' | 'redirect' | 'disabled';
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

const ACCENT: Record<PromoType, string> = {
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
  const [banners, setBanners] = useState<PromotionBannerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [authed, setAuthed] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [claiming, setClaiming] = useState<string | null>(null);
  const [toast, setToast] = useState<ClaimToast | null>(null);

  const loadPromotions = () => {
    fetch('/api/content/promotions', { cache: 'no-store' })
      .then((response) => response.ok ? response.json() : null)
      .then((data) => { if (Array.isArray(data?.promotions)) setList(data.promotions as Promo[]); })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    let alive = true;
    fetch('/api/auth/me', { cache: 'no-store', credentials: 'include' })
      .then((response) => response.ok ? response.json() : null)
      .then((data: MeShape | null) => { if (alive) setAuthed(Boolean(data?.user?.username)); })
      .catch(() => { if (alive) setAuthed(false); })
      .finally(() => { if (alive) setAuthChecked(true); });
    fetch('/api/content/promotions/banners', { cache: 'no-store' })
      .then((response) => response.ok ? response.json() : { banners: [] })
      .then((data) => { if (alive) setBanners(Array.isArray(data?.banners) ? data.banners : []); })
      .catch(() => { if (alive) setBanners([]); });
    loadPromotions();
    return () => { alive = false; };
  }, []);

  const filtered = useMemo(
    () => filter === 'all' ? list : list.filter((promotion) => promotion.category === filter),
    [filter, list],
  );

  const filters: Array<{ key: Filter; label: string }> = [
    { key: 'all', label: t('common.all') },
    { key: 'first_deposit_bonus', label: t('promotions.firstDeposit') },
    { key: 'daily_bonus', label: t('promotions.daily') },
    { key: 'weekly_reward', label: t('promotions.weekly') },
    { key: 'referral_bonus', label: t('promotions.referral') },
    { key: 'vip_reward', label: t('promotions.vip') },
    { key: 'invite_friend_offer', label: t('promotions.invite') },
  ];

  const handleClaim = async (promotion: Promo) => {
    if (!authChecked) return;
    if (!authed) {
      window.location.assign('/?login=1');
      return;
    }
    setClaiming(promotion.id);
    setToast(null);
    try {
      const response = await fetch(`/api/promotions/${encodeURIComponent(promotion.id)}/claim`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
      });
      const data = await response.json().catch(() => null);
      if (response.status === 401) {
        window.location.assign('/?login=1');
        return;
      }
      if (data?.action === 'redirect' && typeof data?.url === 'string') {
        window.location.assign(data.url);
        return;
      }
      if (!response.ok || data?.action !== 'direct_claim_success') {
        setToast({
          promoId: promotion.id,
          kind: 'err',
          message: data?.message ?? (lang === 'bn' ? 'এই প্রমোশনটি এখন উপলব্ধ নয়।' : 'This promotion is not available right now.'),
        });
        return;
      }
      setToast({
        promoId: promotion.id,
        kind: 'ok',
        message: lang === 'bn'
          ? `${formatBDT(Number(data.amount ?? 0))} বোনাস আপনার অ্যাকাউন্টে যোগ হয়েছে।`
          : `${formatBDT(Number(data.amount ?? 0))} bonus credited to your account.`,
      });
      loadPromotions();
    } catch (cause) {
      setToast({ promoId: promotion.id, kind: 'err', message: cause instanceof Error ? cause.message : 'Claim failed' });
    } finally {
      setClaiming(null);
    }
  };

  return (
    <div className="space-y-6 pb-24 md:pb-6">
      <BackBar title={t('promotions.title')} />
      {banners.length > 0 ? (
        <PromotionBannerSlider banners={banners} />
      ) : (
        <CategoryHero
          kicker={t('promotions.title')}
          title={t('promotions.title')}
          description={t('promotions.subtitle')}
          accent="yellow"
          category="promotions"
          chips={[{ label: 'Bonus', tone: 'gold' }, { label: 'Wallet Connected', tone: 'sky' }]}
        />
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          {filters.map((item) => (
            <button key={item.key} type="button" onClick={() => setFilter(item.key)} className="pill-provider" data-active={filter === item.key}>
              {item.label}
            </button>
          ))}
        </div>
        <p className="text-xs text-brand-inkMute">{filtered.length} {t('cat.results')}</p>
      </div>

      {loading ? (
        <p className="text-sm text-brand-inkSoft">Loading promotions...</p>
      ) : filtered.length === 0 ? (
        <div className="card-light p-6 text-center text-sm text-brand-inkSoft">
          {lang === 'bn' ? 'এখন কোনো সক্রিয় প্রমোশন নেই। শিগগিরই আবার দেখুন।' : 'No live promotions right now. Check back soon.'}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((promotion) => (
            <PromoCard
              key={promotion.id}
              promo={promotion}
              lang={lang}
              busy={claiming === promotion.id}
              toast={toast?.promoId === promotion.id ? toast : null}
              onClaim={() => handleClaim(promotion)}
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
  t: (key: string) => string;
}) {
  const Icon = ICON[promo.type] ?? Ticket;
  const tagLabel =
    promo.category === 'first_deposit_bonus' ? t('promotions.firstDeposit') :
    promo.category === 'daily_bonus' ? t('promotions.daily') :
    promo.category === 'weekly_reward' ? t('promotions.weekly') :
    promo.category === 'referral_bonus' ? t('promotions.referral') :
    promo.category === 'vip_reward' ? t('promotions.vip') :
    promo.category === 'invite_friend_offer' ? t('promotions.invite') :
    (lang === 'bn' ? 'অন্যান্য প্রমোশন' : 'Other Promotion');
  const headline = promo.percentage > 0 ? `${promo.percentage}%` : promo.amount > 0 ? formatBDT(promo.amount) : 'Offer';
  const banner = promo.bannerUrl ?? promo.bannerDesktopUrl ?? promo.bannerMobileUrl ?? promo.thumbnailUrl ?? null;
  const description = lang === 'bn' ? (promo.descriptionBn?.trim() || promo.description) : promo.description;
  const name = lang === 'bn' ? (promo.nameBn?.trim() || promo.name) : promo.name;
  const terms = lang === 'bn' && promo.termsBn ? promo.termsBn : promo.termsEn;
  const disabled = busy || Boolean(promo.claimed) || Boolean(promo.disabledReason && authed);

  const disabledMessage = promo.claimed
    ? (lang === 'bn' ? 'এই সময়ের জন্য ইতিমধ্যে দাবি করা হয়েছে' : 'Already claimed for this period')
    : promo.disabledReason === 'config_error'
      ? (lang === 'bn' ? 'এই প্রমোশনটি সাময়িকভাবে উপলব্ধ নয়' : 'This promotion is temporarily unavailable')
      : promo.disabledReason === 'disabled'
        ? (lang === 'bn' ? 'দাবি এখন বন্ধ আছে' : 'Claim is currently disabled')
        : null;

  const claimLabel = promo.claimed
    ? (lang === 'bn' ? 'দাবি করা হয়েছে' : 'Claimed')
    : busy
      ? (lang === 'bn' ? 'প্রসেসিং...' : 'Processing...')
      : promo.claimAction === 'deposit'
        ? (lang === 'bn' ? 'ডিপোজিট করে দাবি করুন' : 'Deposit to Claim')
        : promo.claimAction === 'redirect'
          ? (lang === 'bn' ? 'অফার দেখুন' : 'View Offer')
          : promo.claimAction === 'disabled'
            ? (lang === 'bn' ? 'উপলব্ধ নয়' : 'Unavailable')
            : (lang === 'bn' ? 'দাবি করুন' : 'Claim');

  return (
    <article className="overflow-hidden rounded-2xl border border-brand-divider bg-brand-paper">
      <div className={`relative aspect-[16/9] overflow-hidden bg-gradient-to-br ${ACCENT[promo.type] ?? ACCENT.promo}`}>
        {banner ? (
          <picture>
            {promo.bannerMobileUrl ? <source media="(max-width: 768px)" srcSet={promo.bannerMobileUrl} /> : null}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={banner} alt={name} className="absolute inset-0 h-full w-full object-cover" loading="lazy" />
          </picture>
        ) : null}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.25),transparent_55%)]" />
        <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-3 px-4 py-3 text-white">
          <span className="text-[10px] font-bold uppercase tracking-wider drop-shadow">{tagLabel}</span>
          <span className="rounded-full bg-black/35 px-2.5 py-1 text-[11px] font-semibold backdrop-blur">{headline}</span>
        </div>
        <div className="absolute right-4 top-4 flex h-12 w-12 items-center justify-center rounded-xl bg-white/15 text-white backdrop-blur">
          <Icon className="h-5 w-5" />
        </div>
      </div>

      <div className="px-5 py-4">
        <h3 className="text-base font-extrabold text-brand-ink">{name}</h3>
        {description ? <p className="mt-1.5 whitespace-pre-line text-sm text-brand-inkSoft">{description}</p> : null}
        <p className="mt-2 text-xs text-brand-inkMute">{promo.effective}</p>
        <dl className="mt-4 grid grid-cols-2 gap-3 text-xs">
          <Cell label={lang === 'bn' ? 'সর্বনিম্ন ডিপোজিট' : 'Min Deposit'} value={promo.minDeposit > 0 ? formatBDT(promo.minDeposit) : '-'} />
          <Cell label={lang === 'bn' ? 'সর্বোচ্চ বোনাস' : 'Max Bonus'} value={promo.maxBonus > 0 ? formatBDT(promo.maxBonus) : (lang === 'bn' ? 'সীমা নেই' : 'No cap')} />
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
          <span className="text-xs font-semibold text-emerald-700">{lang === 'bn' ? 'সক্রিয়' : 'Live'}</span>
          {!authChecked || authed ? (
            <button type="button" disabled={disabled} onClick={onClaim} className={`btn-yellow inline-flex h-9 items-center rounded-lg px-4 text-xs ${disabled ? 'opacity-60' : ''}`}>
              {promo.claimed ? <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> : null}
              {claimLabel}
            </button>
          ) : (
            <Link href="/?signup=1" className="btn-yellow inline-flex h-9 items-center rounded-lg px-4 text-xs">
              {lang === 'bn' ? 'দাবি করুন' : 'Claim'}
            </Link>
          )}
        </div>
        {disabledMessage ? <p className="mt-2 inline-flex items-start gap-1 text-[11px] text-brand-inkMute"><Lock className="mt-0.5 h-3 w-3" /><span>{disabledMessage}</span></p> : null}
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
