// Built by Anointed Coder.
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CategoryHero } from '@/components/site/CategoryHero';
import { BackBar } from '@/components/site/BackBar';
import { useT, useLang } from '@/lib/i18n/context';
import { Crown, ShieldCheck, Headphones, BadgePercent, Wallet, Check, Loader2, X } from 'lucide-react';

interface TierRow {
  id: string;
  name: string;
  nameBn: string | null;
  position: number;
  description: string | null;
  descriptionBn: string | null;
  cashbackRatePercent: number | null;
  withdrawalMaxAmount: number | null;
  perksEn: string | null;
  perksBn: string | null;
  iconUrl: string | null;
  badgeColor: string | null;
}

interface StatusResponse {
  tier: TierRow | null;
  pendingApplication: { id: string; tierId: string | null; appliedAt: string; notes: string | null } | null;
}

const STATIC_PERKS = [
  { icon: BadgePercent, key: 'cashback' },
  { icon: Wallet, key: 'withdraw' },
  { icon: Headphones, key: 'support' },
  { icon: ShieldCheck, key: 'limits' },
];

const STATIC_PERK_COPY: Record<string, { bn: { title: string; body: string }; en: { title: string; body: string } }> = {
  cashback: {
    bn: { title: 'কাস্টম ক্যাশব্যাক', body: 'মাসিক প্লে অনুযায়ী বিশেষ ক্যাশব্যাক হার।' },
    en: { title: 'Custom cashback', body: 'Personalised cashback rate based on monthly play.' },
  },
  withdraw: {
    bn: { title: 'দ্রুত উইথড্র', body: 'ভিআইপি অগ্রাধিকার অনুযায়ী দ্রুত পেআউট।' },
    en: { title: 'Faster withdrawals', body: 'VIP-priority payouts pushed ahead of the queue.' },
  },
  support: {
    bn: { title: 'বিশেষ সাপোর্ট', body: '২৪ ঘণ্টা VIP লাইন এবং নির্ধারিত অ্যাকাউন্ট ম্যানেজার।' },
    en: { title: 'Dedicated support', body: '24/7 VIP line with an assigned account manager.' },
  },
  limits: {
    bn: { title: 'বাড়তি সীমা', body: 'উচ্চতর ডিপোজিট এবং উইথড্র সীমা।' },
    en: { title: 'Raised limits', body: 'Higher deposit and withdrawal limits across methods.' },
  },
};

export default function VipPage() {
  const t = useT();
  const { lang } = useLang();
  const bn = lang === 'bn';
  const [tiers, setTiers] = useState<TierRow[]>([]);
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [applyOpen, setApplyOpen] = useState(false);
  const [selectedTier, setSelectedTier] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/vip/tiers', { cache: 'no-store' })
      .then((r) => r.ok ? r.json() : null)
      .then((j) => { if (j?.tiers) setTiers(j.tiers as TierRow[]); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch('/api/auth/me', { cache: 'no-store', credentials: 'include' })
      .then((r) => r.ok ? r.json() : null)
      .then((j) => setAuthed(!!j?.user))
      .catch(() => setAuthed(false));
  }, []);

  useEffect(() => {
    if (authed !== true) return;
    fetch('/api/vip/status', { cache: 'no-store', credentials: 'include' })
      .then((r) => r.ok ? r.json() : null)
      .then((j) => { if (j) setStatus(j as StatusResponse); })
      .catch(() => {});
  }, [authed]);

  const submit = async () => {
    setSubmitting(true);
    setSubmitError(null);
    setSubmitMessage(null);
    try {
      const r = await fetch('/api/vip/apply', {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ tierId: selectedTier, notes: notes.trim() || undefined }),
      });
      const j = await r.json().catch(() => null);
      if (!r.ok) {
        setSubmitError(j?.message ?? j?.code ?? 'Submission failed');
        return;
      }
      setSubmitMessage(bn ? 'আপনার আবেদন জমা হয়েছে। অ্যাডমিন পর্যালোচনার পর জানানো হবে।' : 'Your application is in. An admin will review and notify you.');
      // Refresh status so the page shows pending state
      fetch('/api/vip/status', { cache: 'no-store', credentials: 'include' })
        .then((r2) => r2.ok ? r2.json() : null)
        .then((j2) => { if (j2) setStatus(j2 as StatusResponse); })
        .catch(() => {});
    } catch {
      // Network drop or server unreachable; without this catch the
      // operator saw nothing at all.
      setSubmitError(bn ? 'নেটওয়ার্ক সমস্যায় আবেদন জমা হয়নি। আবার চেষ্টা করুন।' : 'Could not submit your application because of a network problem. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const currentTier = status?.tier ?? null;
  const hasPending = !!status?.pendingApplication;
  const showApplyButton = authed === true && !currentTier && !hasPending;
  const showRegisterButton = authed === false;

  return (
    <div className="space-y-6">
      <BackBar title={t('vip.title')} />
      <CategoryHero
        kicker="VIP"
        title={t('vip.title')}
        description={t('vip.subtitle')}
        accent="royal"
        category="vip"
        chips={[
          { label: 'Elite', tone: 'gold' },
          { label: 'Invite Only', tone: 'rose' },
          { label: 'Higher Limits', tone: 'sky' },
        ]}
      />

      {currentTier ? (
        <section className="card-light p-6">
          <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
            <div className="flex items-start gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-xl shadow" style={{ background: currentTier.badgeColor ?? '#f5b400' }}>
                <Crown className="h-6 w-6 text-brand-ink" />
              </span>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-brand-inkMute">
                  {bn ? 'আপনার টিয়ার' : 'Your tier'}
                </p>
                <p className="text-xl font-extrabold text-brand-ink">{bn ? (currentTier.nameBn ?? currentTier.name) : currentTier.name}</p>
                {currentTier.description ? (
                  <p className="mt-1 text-sm text-brand-inkSoft">{bn ? (currentTier.descriptionBn ?? currentTier.description) : currentTier.description}</p>
                ) : null}
              </div>
            </div>
            <div className="flex flex-col items-end text-right">
              {currentTier.cashbackRatePercent != null ? (
                <p className="text-sm font-bold text-brand-ink">{currentTier.cashbackRatePercent}% {bn ? 'ক্যাশব্যাক' : 'cashback'}</p>
              ) : null}
              {currentTier.withdrawalMaxAmount != null ? (
                <p className="text-xs text-brand-inkSoft">{bn ? 'উইথড্র সীমা:' : 'Withdrawal cap:'} ৳{currentTier.withdrawalMaxAmount.toLocaleString()}</p>
              ) : null}
            </div>
          </div>
        </section>
      ) : null}

      <section className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        {STATIC_PERKS.map((p) => {
          const Icon = p.icon;
          const copy = STATIC_PERK_COPY[p.key][bn ? 'bn' : 'en'];
          return (
            <article key={p.key} className="card-light px-5 py-4">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-grad-yellow text-brand-ink">
                <Icon className="h-5 w-5" />
              </span>
              <p className="mt-3 text-base font-extrabold text-brand-ink">{copy.title}</p>
              <p className="mt-1 text-sm text-brand-inkSoft">{copy.body}</p>
            </article>
          );
        })}
      </section>

      {tiers.length > 0 ? (
        <section>
          <h2 className="text-lg font-extrabold text-brand-ink">{bn ? 'টিয়ার ল্যাডার' : 'Tier ladder'}</h2>
          <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {tiers.map((tier) => {
              const isCurrent = currentTier?.id === tier.id;
              const perks = bn ? (tier.perksBn ?? tier.perksEn ?? '') : (tier.perksEn ?? '');
              const perkLines = perks.split('\n').map((l) => l.trim()).filter(Boolean);
              return (
                <article key={tier.id} className={`card-light p-5 ${isCurrent ? 'ring-2 ring-brand-yellow-500' : ''}`}>
                  <div className="flex items-start gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl shadow" style={{ background: tier.badgeColor ?? '#f5b400' }}>
                      <Crown className="h-5 w-5 text-brand-ink" />
                    </span>
                    <div>
                      <p className="text-base font-extrabold text-brand-ink">{bn ? (tier.nameBn ?? tier.name) : tier.name}</p>
                      {tier.description ? (
                        <p className="text-xs text-brand-inkSoft">{bn ? (tier.descriptionBn ?? tier.description) : tier.description}</p>
                      ) : null}
                    </div>
                  </div>
                  <ul className="mt-3 space-y-1.5 text-sm text-brand-ink">
                    {tier.cashbackRatePercent != null ? (
                      <li className="flex items-start gap-2"><Check className="mt-0.5 h-4 w-4 text-emerald-600" /> {tier.cashbackRatePercent}% {bn ? 'ক্যাশব্যাক' : 'cashback'}</li>
                    ) : null}
                    {tier.withdrawalMaxAmount != null ? (
                      <li className="flex items-start gap-2"><Check className="mt-0.5 h-4 w-4 text-emerald-600" /> ৳{tier.withdrawalMaxAmount.toLocaleString()} {bn ? 'উইথড্র সীমা' : 'withdrawal cap'}</li>
                    ) : null}
                    {perkLines.map((line, i) => (
                      <li key={i} className="flex items-start gap-2"><Check className="mt-0.5 h-4 w-4 text-emerald-600" /> {line}</li>
                    ))}
                  </ul>
                  {isCurrent ? (
                    <p className="mt-3 inline-flex items-center gap-1 rounded-full bg-brand-yellow-500/20 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-brand-yellow-800">{bn ? 'আপনার বর্তমান টিয়ার' : 'Your current tier'}</p>
                  ) : null}
                </article>
              );
            })}
          </div>
        </section>
      ) : null}

      <section className="card-light p-6">
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-yellow-500 text-brand-ink">
              <Crown className="h-5 w-5" />
            </span>
            <div>
              <p className="text-base font-extrabold text-brand-ink">
                {bn ? 'ভিআইপি ক্লাবের জন্য আবেদন করুন' : 'Apply for the VIP Club'}
              </p>
              <p className="mt-1 text-sm text-brand-inkSoft">
                {currentTier
                  ? (bn ? `আপনি ইতিমধ্যেই ${currentTier.nameBn ?? currentTier.name} সদস্য।` : `You're already a ${currentTier.name} member.`)
                  : hasPending
                    ? (bn ? 'আপনার আবেদন পর্যালোচনাধীন।' : 'Your application is under review.')
                    : (bn ? 'অ্যাডমিন পর্যালোচনা করে আপনাকে যথাযথ টিয়ারে স্থাপন করবে।' : 'Admin reviews each application and assigns the appropriate tier.')}
              </p>
            </div>
          </div>
          {showApplyButton ? (
            <button onClick={() => setApplyOpen(true)} className="btn-yellow inline-flex h-10 items-center rounded-lg px-5 text-sm">
              {bn ? 'আবেদন করুন' : 'Apply now'}
            </button>
          ) : null}
          {showRegisterButton ? (
            <Link href="/?signup=1" className="btn-yellow inline-flex h-10 items-center rounded-lg px-5 text-sm">
              {bn ? 'রেজিস্টার করুন' : 'Register to qualify'}
            </Link>
          ) : null}
        </div>
      </section>

      {applyOpen ? (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-extrabold text-brand-ink">{bn ? 'ভিআইপি আবেদন' : 'VIP application'}</h3>
              <button onClick={() => setApplyOpen(false)} className="text-brand-inkMute hover:text-brand-ink"><X className="h-5 w-5" /></button>
            </div>
            <p className="mt-1 text-xs text-brand-inkSoft">{bn ? 'একটি টিয়ার পছন্দ করুন (ঐচ্ছিক) এবং আপনার মেসেজ লিখুন।' : 'Pick a tier you want to be considered for (optional) and add a short note.'}</p>

            {tiers.length > 0 ? (
              <div className="mt-3">
                <label className="text-xs font-bold uppercase tracking-wider text-brand-inkMute">{bn ? 'টিয়ার' : 'Tier'}</label>
                <select value={selectedTier ?? ''} onChange={(e) => setSelectedTier(e.target.value || null)} className="mt-1 w-full rounded-lg border border-brand-divider bg-white px-3 py-2 text-sm">
                  <option value="">{bn ? 'যে কোনো টিয়ার' : 'Any tier (admin decides)'}</option>
                  {tiers.map((t) => <option key={t.id} value={t.id}>{bn ? (t.nameBn ?? t.name) : t.name}</option>)}
                </select>
              </div>
            ) : null}

            <label className="mt-3 block text-xs font-bold uppercase tracking-wider text-brand-inkMute">{bn ? 'মেসেজ (ঐচ্ছিক)' : 'Note (optional)'}</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className="mt-1 w-full rounded-lg border border-brand-divider bg-white px-3 py-2 text-sm" placeholder={bn ? 'আপনি কেন ভিআইপি যোগ্য মনে করেন...' : 'Why you think you qualify for VIP...'} />

            {submitError ? <p className="mt-3 rounded-md bg-rose-50 px-3 py-2 text-xs text-rose-700">{submitError}</p> : null}
            {submitMessage ? <p className="mt-3 rounded-md bg-emerald-50 px-3 py-2 text-xs text-emerald-700">{submitMessage}</p> : null}

            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setApplyOpen(false)} className="rounded-lg border border-brand-divider px-4 py-2 text-sm font-semibold text-brand-ink">{bn ? 'বন্ধ' : 'Close'}</button>
              <button onClick={submit} disabled={submitting || !!submitMessage} className="btn-yellow inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-bold disabled:opacity-50">
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {submitMessage ? (bn ? 'জমা হয়েছে' : 'Submitted') : (bn ? 'আবেদন জমা দিন' : 'Submit application')}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
