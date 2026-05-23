// Built by Anointed Coder.
'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { PageHeader } from '@/components/site/PageHeader';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { EmptyState } from '@/components/ui/EmptyState';
import { useLang } from '@/lib/i18n/context';
import { formatBDT, formatDate } from '@/lib/utils/format';
import { Briefcase, Copy, Check, Wallet, Users, Share2, Send, MessageCircle, Lock, Sparkles, ImageIcon, Link2 } from 'lucide-react';

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
  commissions: { totalAll: number; pending: number; approved: number; paid: number; cancelled: number };
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

  if (loading) {
    return (
      <>
        <PageHeader title="Affiliate Center" icon={<Briefcase className="h-5 w-5" />} />
        <Card padding="lg">Loading...</Card>
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
          <Button variant="ghost" disabled title={lang === 'bn' ? 'পেআউট মাইলস্টোন ২-এ যুক্ত হবে' : 'Payout pipeline ships in Milestone 2'} leftIcon={<Lock className="h-4 w-4" />}>
            {lang === 'bn' ? 'পেআউট অনুরোধ' : 'Request Payout'}
          </Button>
        }
      />

      <Card padding="lg" className="mb-6">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-lo">
              {lang === 'bn' ? 'আপনার রেফারেল কোড' : 'Your referral code'}
            </p>
            <div className="mt-2 flex items-center gap-2">
              <code className="flex-1 truncate rounded-lg border border-neon/15 bg-base-deep/40 px-3 py-2.5 font-mono text-base font-bold text-ink-hi">
                {me.user.referralCode}
              </code>
              <Button variant="neon" leftIcon={copied === 'code' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} onClick={() => copy(me.user.referralCode, 'code')}>
                {copied === 'code' ? (lang === 'bn' ? 'কপি হয়েছে' : 'Copied') : (lang === 'bn' ? 'কপি' : 'Copy')}
              </Button>
            </div>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-lo">
              {lang === 'bn' ? 'রেফারেল লিঙ্ক' : 'Referral link'}
            </p>
            <div className="mt-2 flex items-center gap-2">
              <code className="flex-1 truncate rounded-lg border border-neon/15 bg-base-deep/40 px-3 py-2.5 font-mono text-sm text-ink-hi">
                {referralLink}
              </code>
              <Button variant="gold" leftIcon={copied === 'link' ? <Check className="h-4 w-4" /> : <Link2 className="h-4 w-4" />} onClick={() => copy(referralLink, 'link')}>
                {copied === 'link' ? (lang === 'bn' ? 'কপি হয়েছে' : 'Copied') : (lang === 'bn' ? 'কপি' : 'Copy')}
              </Button>
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
            <p className="text-sm text-ink-lo">
              {lang === 'bn' ? 'টিয়ার এখনো বরাদ্দ হয়নি, অ্যাডমিনের সাথে যোগাযোগ করুন।' : 'No tier assigned yet, contact admin for tier assignment.'}
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
          subtitle={lang === 'bn' ? 'কমিশন অটো-গণনা মাইলস্টোন ২-এ চালু হবে' : 'Automatic commission accrual launches in Milestone 2'}
        />
        <div className="grid gap-3 sm:grid-cols-4">
          <CommissionStat label={lang === 'bn' ? 'মোট' : 'Total'} value={formatBDT(me.commissions.totalAll)} />
          <CommissionStat label={lang === 'bn' ? 'পেন্ডিং' : 'Pending'} value={formatBDT(me.commissions.pending)} accent="warn" />
          <CommissionStat label={lang === 'bn' ? 'অনুমোদিত' : 'Approved'} value={formatBDT(me.commissions.approved)} accent="ok" />
          <CommissionStat label={lang === 'bn' ? 'পরিশোধিত' : 'Paid'} value={formatBDT(me.commissions.paid)} accent="info" />
        </div>
      </Card>

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
                <p className="py-6 text-center text-sm text-ink-lo">Loading...</p>
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
