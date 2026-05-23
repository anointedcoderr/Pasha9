// Built by Anointed Coder.
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { CategoryHero } from '@/components/site/CategoryHero';
import { BackBar } from '@/components/site/BackBar';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { FormField, Input, Textarea } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { useT, useLang } from '@/lib/i18n/context';
import { Briefcase, Wallet, Share2, Trophy, Sparkles, ChevronRight, Link2, Image as ImageIcon, BadgeDollarSign, ShieldCheck, ChevronDown, CheckCircle2 } from 'lucide-react';

interface Tier {
  id: string;
  name: string;
  description?: string | null;
  level1Pct: number | string;
  level2Pct: number | string;
  level3Pct: number | string;
  minActiveReferrals: number;
  minMonthlyVolume: number | string;
}

interface Me {
  user: {
    id: string;
    username: string;
    referralCode: string;
    isAffiliate: boolean;
    tier: { id: string; name: string } | null;
  };
  application: { id: string; status: 'pending' | 'approved' | 'rejected'; channel: string | null } | null;
}

const applySchema = z.object({
  channel: z.string().min(2, 'Tell us your primary channel').max(60),
  audience: z.string().min(2, 'Tell us your audience size').max(60),
  notes: z.string().max(800).optional(),
});
type ApplyInput = z.infer<typeof applySchema>;

export default function AffiliatePage() {
  const t = useT();
  const { lang } = useLang();
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [me, setMe] = useState<Me | null>(null);
  const [loadedMe, setLoadedMe] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    fetch('/api/content/commission-tiers')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { if (data?.tiers) setTiers(data.tiers as Tier[]); })
      .catch(() => {});
    fetch('/api/affiliate/me')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { if (data?.user) setMe(data as Me); })
      .catch(() => {})
      .finally(() => setLoadedMe(true));
  }, []);

  const { register, handleSubmit, formState: { errors } } = useForm<ApplyInput>({
    resolver: zodResolver(applySchema),
    defaultValues: { channel: '', audience: '', notes: '' },
  });

  const onApply = async (values: ApplyInput) => {
    setServerError(null);
    setSubmitting(true);
    try {
      const res = await fetch('/api/affiliate/apply', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(values),
      });
      const data = await res.json();
      if (!res.ok) {
        setServerError(data.message ?? data.code ?? 'Could not submit application');
        return;
      }
      setSubmitted(true);
      // refresh me
      fetch('/api/affiliate/me').then((r) => (r.ok ? r.json() : null)).then((d) => { if (d?.user) setMe(d as Me); });
    } catch {
      setServerError('Network error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <BackBar title={lang === 'bn' ? 'অ্যাফিলিয়েট প্রোগ্রাম' : 'Affiliate Program'} />
      <CategoryHero
        kicker={lang === 'bn' ? 'অ্যাফিলিয়েট প্রোগ্রাম' : 'Affiliate Program'}
        title={lang === 'bn' ? 'বন্ধু আমন্ত্রণ করুন, লাইফটাইম কমিশন' : 'Invite your network, earn lifetime commission'}
        description={lang === 'bn' ? 'তিন স্তরে কমিশন, স্বচ্ছ ট্র্যাকিং এবং প্রতিদিন পেআউটের সুযোগ।' : 'Three-level commission, transparent tracking and daily payout potential.'}
        accent="navy"
      />

      <section className="grid gap-3 md:grid-cols-4">
        <PerkCard icon={<Wallet className="h-5 w-5" />} title={lang === 'bn' ? 'লাইফটাইম কমিশন' : 'Lifetime commission'} body={lang === 'bn' ? 'প্রতিটি রেফার্ড প্লেয়ার থেকে চিরকালীন আয়।' : 'Earn forever on every player you bring in.'} />
        <PerkCard icon={<Trophy className="h-5 w-5" />} title={lang === 'bn' ? 'টিয়ার আপগ্রেড' : 'Tier upgrades'} body={lang === 'bn' ? 'পারফরম্যান্স অনুযায়ী উচ্চতর কমিশন রেট আনলক করুন।' : 'Unlock higher rates as your network grows.'} />
        <PerkCard icon={<BadgeDollarSign className="h-5 w-5" />} title={lang === 'bn' ? 'দ্রুত পেআউট' : 'Fast payouts'} body={lang === 'bn' ? 'অনুমোদন পরে দ্রুত পেআউট প্রসেস।' : 'Approved commissions paid out quickly.'} />
        <PerkCard icon={<ShieldCheck className="h-5 w-5" />} title={lang === 'bn' ? 'স্বচ্ছ ড্যাশবোর্ড' : 'Transparent dashboard'} body={lang === 'bn' ? 'প্রতিদিনের পরিসংখ্যান এবং ডাউনলাইন দেখুন।' : 'See every referred user and commission in real time.'} />
      </section>

      <section className="card-light p-6">
        <CardHeader
          title={lang === 'bn' ? 'কমিশন স্তর' : 'Commission tiers'}
          subtitle={lang === 'bn' ? 'টিয়ার অনুযায়ী তিন স্তরে কমিশন রেট' : 'Commission rate by tier across three referral levels'}
        />
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-brand-divider text-left text-xs font-semibold uppercase tracking-wider text-brand-inkMute">
                <th className="py-3 pr-4">{lang === 'bn' ? 'টিয়ার' : 'Tier'}</th>
                <th className="py-3 pr-4">L1</th>
                <th className="py-3 pr-4">L2</th>
                <th className="py-3 pr-4">L3</th>
                <th className="py-3 pr-4 whitespace-nowrap">{lang === 'bn' ? 'সক্রিয় রেফারেল' : 'Active referrals'}</th>
                <th className="py-3 pr-4 whitespace-nowrap">{lang === 'bn' ? 'মাসিক ভলিউম' : 'Monthly volume'}</th>
              </tr>
            </thead>
            <tbody>
              {tiers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-sm text-brand-inkMute">
                    {lang === 'bn' ? 'টিয়ার লোড হচ্ছে...' : 'Tiers loading...'}
                  </td>
                </tr>
              ) : (
                tiers.map((tier) => (
                  <tr key={tier.id} className="border-b border-brand-divider last:border-0">
                    <td className="py-3 pr-4">
                      <p className="font-extrabold capitalize text-brand-ink">{tier.name}</p>
                      {tier.description ? <p className="mt-0.5 text-xs text-brand-inkMute">{tier.description}</p> : null}
                    </td>
                    <td className="py-3 pr-4 font-extrabold text-brand-yellow-700 tabular-nums">{Number(tier.level1Pct)}%</td>
                    <td className="py-3 pr-4 font-extrabold text-brand-blue-600 tabular-nums">{Number(tier.level2Pct)}%</td>
                    <td className="py-3 pr-4 font-extrabold text-fuchsia-600 tabular-nums">{Number(tier.level3Pct)}%</td>
                    <td className="py-3 pr-4 text-brand-inkSoft tabular-nums">{tier.minActiveReferrals}+</td>
                    <td className="py-3 pr-4 text-brand-inkSoft tabular-nums">৳ {Number(tier.minMonthlyVolume).toLocaleString()}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <HowItWorks lang={lang} />

      <section className="grid gap-4 md:grid-cols-2">
        <Card padding="lg">
          <CardHeader
            title={lang === 'bn' ? 'লিঙ্ক এবং প্রমো অ্যাসেট' : 'Invite link and promo assets'}
            subtitle={lang === 'bn' ? 'অ্যাকাউন্ট তৈরি করলে রেফারেল কোড এবং প্রস্তুত ব্যানার পান।' : 'Sign up to receive your referral code and ready-made banners.'}
          />
          <div className="space-y-3">
            <Bullet icon={<Link2 className="h-4 w-4" />} text={lang === 'bn' ? 'অনন্য রেফারেল কোড এবং লিঙ্ক' : 'Unique referral code and link'} />
            <Bullet icon={<ImageIcon className="h-4 w-4" />} text={lang === 'bn' ? 'সোশ্যাল ব্যানার এবং ভিজ্যুয়াল প্যাক' : 'Social banners and visual pack'} />
            <Bullet icon={<Sparkles className="h-4 w-4" />} text={lang === 'bn' ? 'কাস্টম প্রমোশনাল কপি' : 'Custom promotional copy'} />
          </div>
          <p className="mt-4 inline-flex items-center gap-2 rounded-md bg-brand-yellow-500/10 px-3 py-1 text-[11px] font-semibold text-brand-yellow-700">
            {lang === 'bn' ? 'পেআউট প্রসেসিং মাইলস্টোন ২-এ যুক্ত হবে' : 'Automated payouts ship in Milestone 2'}
          </p>
        </Card>

        <Card padding="lg" id="apply">
          <CardHeader
            title={lang === 'bn' ? 'অ্যাফিলিয়েট হিসেবে আবেদন করুন' : 'Apply as an affiliate'}
            subtitle={lang === 'bn' ? 'কয়েকটি বিবরণ দিন, সুপার অ্যাডমিন আপনার আবেদন পর্যালোচনা করবে।' : 'Share a few details. Our super admin reviews each application.'}
          />

          {!loadedMe ? (
            <p className="text-sm text-brand-inkMute">{lang === 'bn' ? 'লোড হচ্ছে...' : 'Loading...'}</p>
          ) : !me ? (
            <div className="space-y-4">
              <p className="text-sm text-brand-inkSoft">
                {lang === 'bn' ? 'আবেদন করতে অনুগ্রহ করে লগইন বা রেজিস্টার করুন।' : 'Please log in or register to apply.'}
              </p>
              <div className="flex flex-wrap gap-2">
                <Link href="/?signup=1"><Button variant="yellow">{lang === 'bn' ? 'রেজিস্টার' : 'Register'}</Button></Link>
                <Link href="/?login=1"><Button variant="blue">{lang === 'bn' ? 'লগইন' : 'Login'}</Button></Link>
              </div>
            </div>
          ) : me.user.isAffiliate ? (
            <div className="space-y-3">
              <p className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-700">
                <CheckCircle2 className="h-4 w-4" /> {lang === 'bn' ? 'আপনি ইতিমধ্যে অ্যাফিলিয়েট।' : 'You are already an affiliate.'}
              </p>
              {me.user.tier ? (
                <p className="text-sm text-brand-inkSoft capitalize">
                  {lang === 'bn' ? 'বর্তমান টিয়ার' : 'Current tier'}: <span className="font-bold text-brand-ink">{me.user.tier.name}</span>
                </p>
              ) : null}
              <Link href="/dashboard/affiliate"><Button variant="yellow" rightIcon={<ChevronRight className="h-4 w-4" />}>{lang === 'bn' ? 'অ্যাফিলিয়েট সেন্টার খুলুন' : 'Open Affiliate Center'}</Button></Link>
            </div>
          ) : me.application?.status === 'pending' ? (
            <p className="rounded-lg border border-brand-yellow-500/30 bg-brand-yellow-500/10 px-4 py-3 text-sm text-brand-yellow-700">
              {lang === 'bn' ? 'আপনার আবেদন পর্যালোচনাধীন।' : 'Your application is under review.'}
            </p>
          ) : me.application?.status === 'rejected' ? (
            <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-700 mb-4">
              {lang === 'bn' ? 'আগের আবেদন প্রত্যাখ্যাত হয়েছিল। আপনি আবার চেষ্টা করতে পারেন।' : 'Previous application was rejected. You can try again.'}
            </p>
          ) : null}

          {me && !me.user.isAffiliate && me.application?.status !== 'pending' ? (
            submitted ? (
              <p className="inline-flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm font-semibold text-emerald-700">
                <CheckCircle2 className="h-4 w-4" /> {lang === 'bn' ? 'আবেদন গ্রহণ করা হয়েছে।' : 'Application received. We will review it soon.'}
              </p>
            ) : (
              <form onSubmit={handleSubmit(onApply)} className="space-y-3">
                <FormField label={lang === 'bn' ? 'প্রধান চ্যানেল' : 'Primary channel'} required error={errors.channel?.message}>
                  <Select {...register('channel')} invalid={!!errors.channel}>
                    <option value="">--</option>
                    <option value="telegram">Telegram</option>
                    <option value="facebook">Facebook</option>
                    <option value="youtube">YouTube</option>
                    <option value="instagram">Instagram</option>
                    <option value="tiktok">TikTok</option>
                    <option value="blog">Blog or website</option>
                    <option value="other">Other</option>
                  </Select>
                </FormField>
                <FormField label={lang === 'bn' ? 'অডিয়েন্স সাইজ' : 'Audience size'} required error={errors.audience?.message}>
                  <Input placeholder="e.g. 5,000 Telegram subscribers" {...register('audience')} invalid={!!errors.audience} />
                </FormField>
                <FormField label={lang === 'bn' ? 'নোট' : 'Notes (optional)'}>
                  <Textarea rows={3} placeholder={lang === 'bn' ? 'কেন আপনি ভালো অ্যাফিলিয়েট হবেন' : 'Tell us why you would be a great affiliate'} {...register('notes')} />
                </FormField>
                {serverError ? <p className="text-sm text-signal-danger">{serverError}</p> : null}
                <Button type="submit" variant="yellow" loading={submitting} leftIcon={<Briefcase className="h-4 w-4" />}>
                  {lang === 'bn' ? 'আবেদন জমা দিন' : 'Submit application'}
                </Button>
              </form>
            )
          ) : null}
        </Card>
      </section>

      <FaqSection lang={lang} />
    </div>
  );
}

function PerkCard({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <article className="card-light px-4 py-4">
      <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-grad-yellow text-brand-ink">{icon}</span>
      <p className="mt-3 text-base font-extrabold text-brand-ink">{title}</p>
      <p className="mt-1 text-sm text-brand-inkSoft">{body}</p>
    </article>
  );
}

function Bullet({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <p className="flex items-center gap-2 text-sm text-brand-inkSoft">
      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-surface text-brand-yellow-700">{icon}</span>
      {text}
    </p>
  );
}

function HowItWorks({ lang }: { lang: 'bn' | 'en' }) {
  const steps = [
    {
      title: lang === 'bn' ? 'আবেদন করুন' : 'Apply',
      body: lang === 'bn' ? 'অ্যাকাউন্ট তৈরি করুন এবং অ্যাফিলিয়েট হিসেবে আবেদন করুন।' : 'Create an account and submit your affiliate application.',
    },
    {
      title: lang === 'bn' ? 'লিঙ্ক শেয়ার করুন' : 'Share your link',
      body: lang === 'bn' ? 'অনন্য রেফারেল লিঙ্ক বন্ধু এবং অডিয়েন্সের সাথে শেয়ার করুন।' : 'Share your unique referral link with your network.',
    },
    {
      title: lang === 'bn' ? 'কমিশন উপার্জন করুন' : 'Earn commission',
      body: lang === 'bn' ? 'রেফার্ড প্লেয়ারদের কার্যকলাপ থেকে তিন স্তরে কমিশন।' : 'Earn three-level commission on referred player activity.',
    },
  ];
  return (
    <section className="card-light p-6">
      <CardHeader
        title={lang === 'bn' ? 'কীভাবে কাজ করে' : 'How it works'}
        subtitle={lang === 'bn' ? 'মাত্র তিন ধাপে শুরু করুন' : 'Get started in three simple steps'}
      />
      <div className="grid gap-3 md:grid-cols-3">
        {steps.map((s, i) => (
          <div key={s.title} className="rounded-xl border border-brand-divider bg-brand-surface p-4">
            <p className="flex h-9 w-9 items-center justify-center rounded-full bg-grad-yellow text-base font-extrabold text-brand-ink">{i + 1}</p>
            <p className="mt-3 text-base font-extrabold text-brand-ink">{s.title}</p>
            <p className="mt-1 text-sm text-brand-inkSoft">{s.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function FaqSection({ lang }: { lang: 'bn' | 'en' }) {
  const items = [
    {
      q: lang === 'bn' ? 'অ্যাফিলিয়েট হতে কত সময় লাগে?' : 'How long does approval take?',
      a: lang === 'bn' ? 'আবেদন সাধারণত ২৪ ঘণ্টার মধ্যে পর্যালোচনা করা হয়।' : 'Applications are typically reviewed within 24 hours.',
    },
    {
      q: lang === 'bn' ? 'কীভাবে কমিশন গণনা করা হয়?' : 'How are commissions calculated?',
      a: lang === 'bn' ? 'প্রতিটি টিয়ারের জন্য নির্ধারিত শতাংশ অনুযায়ী রেফার্ড প্লেয়ারের কার্যকলাপ থেকে গণনা।' : 'Per-tier percentage applied to your referred players activity. Auto calculation launches in Milestone 2.',
    },
    {
      q: lang === 'bn' ? 'কখন পেআউট পাওয়া যায়?' : 'When are payouts processed?',
      a: lang === 'bn' ? 'অনুমোদিত কমিশনের পেআউট প্রক্রিয়া মাইলস্টোন ২-এ যুক্ত হবে।' : 'Approved commission payout pipeline ships in Milestone 2.',
    },
    {
      q: lang === 'bn' ? 'আমার পরিচিতি কি প্রকাশ পাবে?' : 'Is my identity exposed to referred players?',
      a: lang === 'bn' ? 'না, রেফার্ড প্লেয়াররা আপনার পরিচিতি দেখে না, শুধু আপনার রেফারেল কোড সংযুক্ত থাকে।' : 'No. Referred players never see your identity, only the referral code is recorded internally.',
    },
  ];
  const [openIdx, setOpenIdx] = useState<number | null>(0);
  return (
    <section className="card-light p-6">
      <CardHeader title="FAQ" subtitle={lang === 'bn' ? 'সাধারণ প্রশ্ন' : 'Common questions'} />
      <div className="space-y-2">
        {items.map((item, idx) => (
          <button
            key={item.q}
            type="button"
            onClick={() => setOpenIdx((c) => (c === idx ? null : idx))}
            className="w-full rounded-xl border border-brand-divider bg-brand-surface px-4 py-3 text-left transition hover:border-brand-yellow-500"
          >
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-semibold text-brand-ink">{item.q}</span>
              <ChevronDown className={`h-4 w-4 text-brand-inkMute transition ${openIdx === idx ? 'rotate-180 text-brand-yellow-700' : ''}`} />
            </div>
            {openIdx === idx ? <p className="mt-2 text-sm text-brand-inkSoft">{item.a}</p> : null}
          </button>
        ))}
      </div>
      <p className="mt-4 inline-flex items-center gap-2 text-xs text-brand-inkMute">
        <Share2 className="h-3.5 w-3.5" />
        {lang === 'bn' ? 'অতিরিক্ত প্রশ্ন? সাপোর্ট টিমে যোগাযোগ করুন।' : 'More questions? Reach out to support.'}
      </p>
    </section>
  );
}
