// Built by Anointed Coder.
'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { PageHeader } from '@/components/site/PageHeader';
import { Card, CardHeader } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { EmptyState } from '@/components/ui/EmptyState';
import { Modal } from '@/components/ui/Modal';
import { FormField, Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { useLang } from '@/lib/i18n/context';
import { formatBDT, formatDate } from '@/lib/utils/format';
import { Briefcase, Copy, Check, Wallet, Users, Share2, Send, MessageCircle, Lock, Sparkles, ImageIcon, Link2, Banknote } from 'lucide-react';
import { CopyRow } from '@/components/ui/CopyRow';

interface Me {
  user: {
    id: string;
    username: string;
    referralCode: string;
    isAffiliate: boolean;
    tier: { id: string; name: string; level1Pct: number | string; level2Pct: number | string; level3Pct: number | string; description?: string | null } | null;
  };
  application: { id: string; status: 'pending' | 'approved' | 'rejected' } | null;
  downline: { level1: number; level2: number; level3: number; active: number };
  commissions: { totalAll: number; pending: number; approved: number; paid: number; cancelled: number; withdrawable: number; inFlightPayouts: number };
  payouts: Array<{ id: string; amount: number; method: string; accountNumber: string; accountName: string; status: string; adminNote: string | null; reviewedAt: string | null; paidAt: string | null; createdAt: string }>;
  recentCommissions: Array<{ id: string; level: number; amount: number; status: string; basis: string; ratePct: number | null; createdAt: string; payoutId: string | null }>;
}

interface DownlineRow {
  id: string;
  username: string;
  phone: string;
  joinedAt: string;
  status: string;
  balance: number;
  txCount: number;
}

export default function DashboardAffiliateCenter() {
  const { lang } = useLang();
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [level, setLevel] = useState<1 | 2 | 3>(1);
  const [rows, setRows] = useState<DownlineRow[]>([]);
  const [rowsLoading, setRowsLoading] = useState(true);
  const [payoutOpen, setPayoutOpen] = useState(false);
  const [payoutAmount, setPayoutAmount] = useState(0);
  const [payoutMethod, setPayoutMethod] = useState<'bkash' | 'nagad' | 'rocket' | 'bank'>('bkash');
  const [payoutAccount, setPayoutAccount] = useState('');
  const [payoutAccountName, setPayoutAccountName] = useState('');
  const [payoutBusy, setPayoutBusy] = useState(false);
  const [payoutError, setPayoutError] = useState<string | null>(null);
  const [payoutToast, setPayoutToast] = useState<string | null>(null);

  const fetchMe = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch('/api/affiliate/me');
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? data.code);
      setMe(data as Me);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchMe(); }, [fetchMe]);

  const loadDownline = useCallback(async (lvl: 1 | 2 | 3) => {
    setRowsLoading(true);
    try {
      const res = await fetch(`/api/affiliate/downline?level=${lvl}&take=50`);
      const data = await res.json();
      if (res.ok) setRows((data.rows ?? []) as DownlineRow[]);
      else setRows([]);
    } catch {
      setRows([]);
    } finally {
      setRowsLoading(false);
    }
  }, []);

  useEffect(() => { if (me?.user.isAffiliate) loadDownline(level); }, [level, me?.user.isAffiliate, loadDownline]);

  const referralLink = me ? `${typeof window !== 'undefined' ? window.location.origin : 'https://pasha9.com'}/?r=${me.user.referralCode}` : '';

  const copy = async (value: string, key: string) => {
    if (typeof navigator !== 'undefined') {
      await navigator.clipboard.writeText(value);
      setCopied(key);
      setTimeout(() => setCopied((c) => (c === key ? null : c)), 1600);
    }
  };

  const submitPayout = async (e: React.FormEvent) => {
    e.preventDefault();
    setPayoutError(null);
    setPayoutBusy(true);
    try {
      const res = await fetch('/api/affiliate/payouts', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          amount: Number(payoutAmount),
          method: payoutMethod,
          accountNumber: payoutAccount.trim(),
          accountName: payoutAccountName.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        const code = typeof data?.code === 'string' ? data.code : null;
        const message = typeof data?.message === 'string' ? data.message : null;
        if (code === 'INSUFFICIENT_BALANCE') throw new Error(message ?? 'Insufficient commission balance.');
        if (code === 'BELOW_MIN') throw new Error(message ?? 'Below minimum payout.');
        if (code === 'NOT_AFFILIATE') throw new Error('Your affiliate account is not active.');
        throw new Error(message ?? code ?? 'Request failed');
      }
      setPayoutOpen(false);
      setPayoutAmount(0);
      setPayoutAccount('');
      setPayoutAccountName('');
      setPayoutToast(lang === 'bn' ? 'পেআউট অনুরোধ গৃহীত। অ্যাডমিন পর্যালোচনা করবে।' : 'Payout request submitted. Admin review pending.');
      setTimeout(() => setPayoutToast(null), 5000);
      fetchMe();
    } catch (e) {
      setPayoutError(e instanceof Error ? e.message : 'Request failed');
    } finally {
      setPayoutBusy(false);
    }
  };

  if (loading) {
    return (
      <>
        <PageHeader title="Affiliate Center" icon={<Briefcase className="h-5 w-5" />} />
        <div className="sr-only" role="status">{lang === 'bn' ? 'লোড হচ্ছে' : 'Loading'}</div>
        <Card padding="lg" className="mb-6">
          <div className="grid gap-4 md:grid-cols-2">
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
          </div>
        </Card>
        <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
        </div>
        <Card padding="lg"><Skeleton className="h-40" /></Card>
      </>
    );
  }

  if (error || !me) {
    return (
      <>
        <PageHeader title="Affiliate Center" icon={<Briefcase className="h-5 w-5" />} />
        <Card padding="lg"><p className="text-sm text-signal-danger">{error ?? 'Unable to load affiliate data'}</p></Card>
      </>
    );
  }

  if (!me.user.isAffiliate) {
    return (
      <>
        <PageHeader
          title={lang === 'bn' ? 'অ্যাফিলিয়েট সেন্টার' : 'Affiliate Center'}
          subtitle={lang === 'bn' ? 'অ্যাফিলিয়েট হিসেবে আবেদন করুন' : 'Apply to become an affiliate'}
          icon={<Briefcase className="h-5 w-5" />}
        />
        <Card padding="lg" className="text-center">
          <EmptyState
            title={
              me.application?.status === 'pending'
                ? (lang === 'bn' ? 'আবেদন পর্যালোচনাধীন' : 'Application under review')
                : me.application?.status === 'rejected'
                  ? (lang === 'bn' ? 'আবেদন প্রত্যাখ্যাত' : 'Previous application rejected')
                  : (lang === 'bn' ? 'এখনো অ্যাফিলিয়েট নন' : 'Not an affiliate yet')
            }
            description={
              me.application?.status === 'pending'
                ? (lang === 'bn' ? 'অ্যাডমিন শীঘ্রই আপনার আবেদন পর্যালোচনা করবে।' : 'A super admin will review your application shortly.')
                : (lang === 'bn' ? 'কয়েক সেকেন্ডে অ্যাফিলিয়েট হিসেবে আবেদন করুন।' : 'Apply in a few seconds and start sharing your link.')
            }
            action={<Link href="/affiliate#apply"><Button variant="gold">{lang === 'bn' ? 'আবেদন পেজ খুলুন' : 'Open application'}</Button></Link>}
          />
        </Card>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title={lang === 'bn' ? 'অ্যাফিলিয়েট সেন্টার' : 'Affiliate Center'}
        subtitle={lang === 'bn' ? 'আপনার অ্যাফিলিয়েট পরিসংখ্যান এবং কমিশন' : 'Your affiliate stats and commission balance'}
        icon={<Briefcase className="h-5 w-5" />}
        action={
          <Button
            variant="gold"
            leftIcon={<Banknote className="h-4 w-4" />}
            disabled={me.commissions.withdrawable <= 0}
            title={me.commissions.withdrawable <= 0 ? (lang === 'bn' ? 'কোনো উইথড্রয়েবল কমিশন নেই' : 'No withdrawable commission yet') : undefined}
            onClick={() => {
              setPayoutError(null);
              setPayoutAmount(Math.min(me.commissions.withdrawable, me.commissions.withdrawable));
              setPayoutOpen(true);
            }}
          >
            {lang === 'bn' ? 'পেআউট অনুরোধ' : 'Request Payout'}
          </Button>
        }
      />

      {payoutToast ? <Card padding="md" className="mb-4"><p className="text-sm text-signal-ok">{payoutToast}</p></Card> : null}

      <Card padding="lg" className="mb-6">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-lo">
              {lang === 'bn' ? 'আপনার রেফারেল কোড' : 'Your referral code'}
            </p>
            <div className="mt-2">
              <CopyRow
                value={me.user.referralCode}
                copyLabel={lang === 'bn' ? 'কপি' : 'Copy'}
                copiedLabel={lang === 'bn' ? 'কপি হয়েছে' : 'Copied'}
              />
            </div>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-lo">
              {lang === 'bn' ? 'রেফারেল লিঙ্ক' : 'Referral link'}
            </p>
            <div className="mt-2">
              <CopyRow
                value={referralLink}
                copyLabel={lang === 'bn' ? 'কপি' : 'Copy'}
                copiedLabel={lang === 'bn' ? 'কপি হয়েছে' : 'Copied'}
              />
            </div>
            <p className="mt-2 inline-flex flex-wrap gap-2 text-xs text-ink-lo">
              <span className="inline-flex items-center gap-1"><Share2 className="h-3 w-3" />{lang === 'bn' ? 'এক ট্যাপে শেয়ার' : 'Share via'}</span>
              <a className="hover:text-ink-hi" target="_blank" rel="noreferrer" href={`https://wa.me/?text=${encodeURIComponent(referralLink)}`}><MessageCircle className="inline h-3.5 w-3.5 text-[#25D366]" /> WhatsApp</a>
              <a className="hover:text-ink-hi" target="_blank" rel="noreferrer" href={`https://t.me/share/url?url=${encodeURIComponent(referralLink)}`}><Send className="inline h-3.5 w-3.5 text-[#229ED9]" /> Telegram</a>
            </p>
          </div>
        </div>
      </Card>

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi icon={<Users className="h-5 w-5 text-neon" />} label={lang === 'bn' ? 'মোট রেফার্ড' : 'Total referrals'} value={(me.downline.level1 + me.downline.level2 + me.downline.level3).toString()} sub={`L1 ${me.downline.level1} | L2 ${me.downline.level2} | L3 ${me.downline.level3}`} />
        <Kpi icon={<Sparkles className="h-5 w-5 text-neon" />} label={lang === 'bn' ? 'সক্রিয় রেফার্ড' : 'Active referrals'} value={me.downline.active.toString()} sub={lang === 'bn' ? 'লেনদেন আছে এমন' : 'with activity'} />
        <Kpi icon={<Wallet className="h-5 w-5 text-gold-300" />} label={lang === 'bn' ? 'অনুমোদিত কমিশন' : 'Approved commission'} value={formatBDT(me.commissions.approved)} sub={lang === 'bn' ? 'পেআউট প্রস্তুত' : 'ready for payout'} gold />
        <Kpi icon={<Lock className="h-5 w-5 text-gold-300" />} label={lang === 'bn' ? 'পেন্ডিং কমিশন' : 'Pending commission'} value={formatBDT(me.commissions.pending)} sub={lang === 'bn' ? 'যাচাইয়ের অপেক্ষায়' : 'awaiting review'} />
      </div>

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Card padding="md">
          <CardHeader
            title={lang === 'bn' ? 'টিয়ার' : 'Tier'}
            action={me.user.tier ? <Chip tone="ok">{me.user.tier.name}</Chip> : <Chip>-</Chip>}
          />
          {me.user.tier ? (
            <div className="space-y-1.5 text-sm">
              <p className="flex items-center justify-between"><span className="text-ink-lo">Level 1</span><span className="font-bold text-ink-hi">{Number(me.user.tier.level1Pct)}%</span></p>
              <p className="flex items-center justify-between"><span className="text-ink-lo">Level 2</span><span className="font-bold text-ink-hi">{Number(me.user.tier.level2Pct)}%</span></p>
              <p className="flex items-center justify-between"><span className="text-ink-lo">Level 3</span><span className="font-bold text-ink-hi">{Number(me.user.tier.level3Pct)}%</span></p>
            </div>
          ) : (
            <p className="text-sm text-signal-warn">
              {lang === 'bn'
                ? 'টিয়ার এখনো বরাদ্দ হয়নি। টিয়ার না থাকলে আপনার ডাউনলাইনের ডিপোজিট থেকে কোনো কমিশন জমা হবে না। দয়া করে সাপোর্টে যোগাযোগ করুন।'
                : 'No tier assigned yet. Without a tier, NO commission accrues from your downline deposits. Please contact support to be placed on a tier.'}
            </p>
          )}
        </Card>

        <Card padding="md" className="sm:col-span-2">
          <CardHeader
            title={lang === 'bn' ? 'প্রমো অ্যাসেট' : 'Promo assets'}
            subtitle={lang === 'bn' ? 'রেফার্ড লিঙ্কের সাথে ব্যবহার করুন' : 'Use these alongside your referral link'}
          />
          <div className="grid gap-3 sm:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="relative aspect-[16/9] overflow-hidden rounded-lg border border-neon/10 bg-gradient-to-br from-gold-300 via-gold-500 to-gold-700">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.25),transparent_55%)]" />
                <div className="absolute inset-0 flex items-center justify-center text-white">
                  <ImageIcon className="h-6 w-6 opacity-80" />
                </div>
                <p className="absolute bottom-1.5 left-2 text-[10px] font-bold uppercase text-white/85">Pack {i}</p>
              </div>
            ))}
          </div>
          <p className="mt-3 inline-flex items-center gap-2 text-[11px] text-ink-lo">
            <Lock className="h-3 w-3" /> {lang === 'bn' ? 'ব্র্যান্ড অনুমোদিত অ্যাসেট অ্যাডমিন থেকে যুক্ত হবে।' : 'Brand-approved assets will be added from the admin in a future update.'}
          </p>
        </Card>
      </div>

      <Card padding="lg" className="mb-6">
        <CardHeader
          title={lang === 'bn' ? 'কমিশন সারাংশ' : 'Commission summary'}
          subtitle={lang === 'bn' ? 'প্রতিটি অনুমোদিত ডিপোজিটে আপলাইন কমিশন অটো-গণনা হয়।' : 'Commission accrues automatically on every approved deposit in your downline.'}
        />
        <div className="grid gap-3 sm:grid-cols-5">
          <CommissionStat label={lang === 'bn' ? 'মোট' : 'Total'} value={formatBDT(me.commissions.totalAll)} />
          <CommissionStat label={lang === 'bn' ? 'উইথড্রয়েবল' : 'Withdrawable'} value={formatBDT(me.commissions.withdrawable)} accent="ok" />
          <CommissionStat label={lang === 'bn' ? 'অনুমোদিত' : 'Approved'} value={formatBDT(me.commissions.approved)} accent="ok" />
          <CommissionStat label={lang === 'bn' ? 'বকেয়া পেআউট' : 'In payout'} value={formatBDT(me.commissions.inFlightPayouts)} accent="warn" />
          <CommissionStat label={lang === 'bn' ? 'পরিশোধিত' : 'Paid'} value={formatBDT(me.commissions.paid)} accent="info" />
        </div>
      </Card>

      {me.payouts.length > 0 ? (
        <Card padding="lg" className="mb-6">
          <CardHeader title={lang === 'bn' ? 'পেআউট ইতিহাস' : 'Payout history'} subtitle={lang === 'bn' ? 'সর্বশেষ ২০টি অনুরোধ' : 'Last 20 requests'} />
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-neon/10 text-left text-xs font-semibold uppercase tracking-wider text-ink-lo">
                  <th className="py-2 pr-3">{lang === 'bn' ? 'তারিখ' : 'Date'}</th>
                  <th className="py-2 pr-3">{lang === 'bn' ? 'পরিমাণ' : 'Amount'}</th>
                  <th className="py-2 pr-3">{lang === 'bn' ? 'মেথড' : 'Method'}</th>
                  <th className="py-2 pr-3">{lang === 'bn' ? 'অ্যাকাউন্ট' : 'Account'}</th>
                  <th className="py-2 pr-3">{lang === 'bn' ? 'অবস্থা' : 'Status'}</th>
                  <th className="py-2 pr-3">{lang === 'bn' ? 'নোট' : 'Note'}</th>
                </tr>
              </thead>
              <tbody>
                {me.payouts.map((p) => (
                  <tr key={p.id} className="border-b border-neon/10 last:border-0">
                    <td className="py-2.5 pr-3 text-ink-lo">{formatDate(p.createdAt, lang)}</td>
                    <td className="py-2.5 pr-3 tabular-nums font-semibold text-ink-hi">{formatBDT(p.amount)}</td>
                    <td className="py-2.5 pr-3 uppercase text-ink-mid">{p.method}</td>
                    <td className="py-2.5 pr-3 font-mono text-xs text-ink-mid">{p.accountNumber}</td>
                    <td className="py-2.5 pr-3"><Chip tone={p.status === 'paid' ? 'ok' : p.status === 'approved' ? 'info' : p.status === 'rejected' ? 'danger' : 'warn'}>{p.status}</Chip></td>
                    <td className="py-2.5 pr-3 text-xs text-ink-lo">{p.adminNote ?? '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : null}

      <Card padding="none" className="overflow-hidden">
        <div className="border-b border-neon/10 px-5 py-3">
          <CardHeader
            title={lang === 'bn' ? 'ডাউনলাইন' : 'Downline'}
            subtitle={lang === 'bn' ? 'প্রতিটি স্তরের রেফার্ড ইউজার দেখুন' : 'See referred users at each level'}
          />
        </div>
        <div className="px-5 py-4">
          <Tabs value={String(level)} onValueChange={(v) => setLevel(Number(v) as 1 | 2 | 3)}>
            <TabsList>
              <TabsTrigger value="1">Level 1 ({me.downline.level1})</TabsTrigger>
              <TabsTrigger value="2">Level 2 ({me.downline.level2})</TabsTrigger>
              <TabsTrigger value="3">Level 3 ({me.downline.level3})</TabsTrigger>
            </TabsList>

            <TabsContent value={String(level)}>
              {rowsLoading ? (
                <div className="space-y-2 py-4" role="status" aria-label={lang === 'bn' ? 'লোড হচ্ছে' : 'Loading'}>
                  <Skeleton className="h-8" />
                  <Skeleton className="h-8" />
                  <Skeleton className="h-8" />
                  <Skeleton className="h-8" />
                </div>
              ) : rows.length === 0 ? (
                <EmptyState
                  title={lang === 'bn' ? 'এখনো কোনো ডাউনলাইন নেই' : 'No downline yet'}
                  description={lang === 'bn' ? 'আপনার রেফারেল লিঙ্ক শেয়ার করুন এবং অডিয়েন্সকে আমন্ত্রণ করুন।' : 'Share your referral link to start growing your network.'}
                />
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="border-b border-neon/10 text-left text-xs font-semibold uppercase tracking-wider text-ink-lo">
                        <th className="py-2 pr-3">{lang === 'bn' ? 'ইউজার' : 'User'}</th>
                        <th className="py-2 pr-3">{lang === 'bn' ? 'ফোন' : 'Phone'}</th>
                        <th className="py-2 pr-3">{lang === 'bn' ? 'যোগ' : 'Joined'}</th>
                        <th className="py-2 pr-3">{lang === 'bn' ? 'লেনদেন' : 'Activity'}</th>
                        <th className="py-2 pr-3">{lang === 'bn' ? 'ব্যালেন্স' : 'Balance'}</th>
                        <th className="py-2 pr-3">{lang === 'bn' ? 'অবস্থা' : 'Status'}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r) => (
                        <tr key={r.id} className="border-b border-neon/10 last:border-0">
                          <td className="py-2.5 pr-3 font-semibold text-ink-hi">{r.username}</td>
                          <td className="py-2.5 pr-3 font-mono text-xs text-ink-lo">{r.phone}</td>
                          <td className="py-2.5 pr-3 text-ink-lo">{formatDate(r.joinedAt, lang)}</td>
                          <td className="py-2.5 pr-3 tabular-nums text-ink-mid">{r.txCount}</td>
                          <td className="py-2.5 pr-3 tabular-nums text-ink-hi">{formatBDT(r.balance)}</td>
                          <td className="py-2.5 pr-3">
                            <Chip tone={r.status === 'active' ? 'ok' : r.status === 'blocked' ? 'danger' : 'warn'}>{r.status}</Chip>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </Card>

      <Modal open={payoutOpen} onOpenChange={setPayoutOpen} title={lang === 'bn' ? 'পেআউট অনুরোধ' : 'Request Payout'} size="md">
        <form className="space-y-4" onSubmit={submitPayout}>
          <div className="rounded-lg border border-neon/10 bg-base-deep/40 p-3 text-sm">
            <p className="text-ink-mid">
              {lang === 'bn' ? 'উইথড্রয়েবল কমিশন' : 'Withdrawable commission'}: <span className="font-semibold text-ink-hi">{formatBDT(me.commissions.withdrawable)}</span>
            </p>
            <p className="mt-1 text-xs text-ink-lo">
              {lang === 'bn' ? 'সর্বনিম্ন ৫০০ টাকা। অনুমোদিত হওয়ার পর কমিশন রেকর্ড লক হয়ে যাবে।' : 'Minimum 500 BDT. Approved commission rows are reserved until admin marks the payout paid.'}
            </p>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <FormField label={lang === 'bn' ? 'পরিমাণ' : 'Amount'} required>
              <Input type="number" min={500} max={me.commissions.withdrawable} step={100} value={payoutAmount} onChange={(e) => setPayoutAmount(Number(e.target.value))} />
            </FormField>
            <FormField label={lang === 'bn' ? 'মেথড' : 'Payout method'} required>
              <Select value={payoutMethod} onChange={(e) => setPayoutMethod(e.target.value as typeof payoutMethod)}>
                <option value="bkash">bKash</option>
                <option value="nagad">Nagad</option>
                <option value="rocket">Rocket</option>
                <option value="bank">Bank</option>
              </Select>
            </FormField>
            <FormField label={lang === 'bn' ? 'অ্যাকাউন্ট নম্বর' : 'Account number'} required>
              <Input value={payoutAccount} onChange={(e) => setPayoutAccount(e.target.value)} placeholder="01XXXXXXXXX" />
            </FormField>
            <FormField label={lang === 'bn' ? 'অ্যাকাউন্ট নাম' : 'Account name'} required>
              <Input value={payoutAccountName} onChange={(e) => setPayoutAccountName(e.target.value)} placeholder={lang === 'bn' ? 'অ্যাকাউন্টে দেওয়া নাম' : 'Full name on the account'} />
            </FormField>
          </div>
          {payoutError ? <p className="text-sm text-signal-danger">{payoutError}</p> : null}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" type="button" onClick={() => setPayoutOpen(false)}>{lang === 'bn' ? 'বাতিল' : 'Cancel'}</Button>
            <Button type="submit" variant="gold" loading={payoutBusy} disabled={payoutAmount <= 0 || !payoutAccount.trim() || !payoutAccountName.trim()}>
              {lang === 'bn' ? 'অনুরোধ পাঠান' : 'Submit request'}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}

function Kpi({ icon, label, value, sub, gold }: { icon: React.ReactNode; label: string; value: string; sub?: string; gold?: boolean }) {
  return (
    <div className="card-glow p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-ink-lo">{label}</p>
          <p className={gold ? 'mt-2 text-2xl font-semibold tabular-nums text-gradient-gold' : 'mt-2 text-2xl font-semibold tabular-nums text-ink-hi'}>{value}</p>
          {sub ? <p className="mt-1 text-xs text-ink-lo">{sub}</p> : null}
        </div>
        <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-neon/15 bg-gradient-to-br from-neon/15 to-transparent">
          {icon}
        </div>
      </div>
    </div>
  );
}

function CommissionStat({ label, value, accent }: { label: string; value: string; accent?: 'warn' | 'ok' | 'info' }) {
  const color =
    accent === 'warn' ? 'text-signal-warn' :
    accent === 'ok' ? 'text-neon' :
    accent === 'info' ? 'text-signal-info' :
    'text-ink-hi';
  return (
    <div className="rounded-xl border border-neon/10 bg-base-deep/40 p-4">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-lo">{label}</p>
      <p className={`mt-1 text-lg font-extrabold tabular-nums ${color}`}>{value}</p>
    </div>
  );
}
