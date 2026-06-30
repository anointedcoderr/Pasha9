// Built by Anointed Coder.
//
// Public /referral page. M4 Phase E:
//   - Drops the mock stats; every number is read from
//     /api/me/referrals (real AffiliateCommission + ReferralBalance).
//   - Guests see a sign-in banner with no fake numbers behind it.
//   - Auth'd players see referral code + invite link with copy
//     buttons, level 1/2/3 counts, real balance tiles, Claim button
//     gated by cadence + claimable balance.
//   - Latest referrals table is the masked level-1 invite list.

'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { PageHeader } from '@/components/site/PageHeader';
import { BackBar } from '@/components/site/BackBar';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { Users, Copy, Check, LogIn, Wallet, Clock, AlertCircle, Share2, ArrowRight, RefreshCw, MessageCircle, Send, Facebook, MessageSquare, Mail } from 'lucide-react';
import { CopyRow } from '@/components/ui/CopyRow';
import { useT, useLang } from '@/lib/i18n/context';
import { formatBDT, formatDate, formatDateTime } from '@/lib/utils/format';
import { triggerWalletRefresh } from '@/components/site/WalletStrip';

interface MeResponse {
  user: { username: string; referralCode: string; inviteLink: string };
  downline: { level1Total: number; level1Active: number; level2Total: number; level3Total: number };
  level1Invited: Array<{ username: string; phone: string; joinedAt: string }>;
  tier: { name: string; level1Pct: number; level2Pct: number; level3Pct: number } | null;
  balance: {
    pendingAmount: number;
    claimableAmount: number;
    claimedAmount: number;
    totalEarned: number;
    lastClaimedAt: string | null;
  };
  settings: {
    cadence: 'weekly' | 'monthly' | 'manual' | 'auto';
    holdDays: number;
    turnoverX: number;
    firstDepositMinBdt: number;
    firstDepositRewardBdt: number;
  };
  claim: { cadenceBlocked: boolean; nextClaimAt: string | null };
  recentCommissions: Array<{ id: string; level: number; amount: number; status: string; ratePct: number | null; createdAt: string }>;
  recentClaims: Array<{ id: string; amount: number; status: string; errorCode: string | null; createdAt: string; paidAt: string | null }>;
}

const EMPTY: MeResponse = {
  user: { username: '', referralCode: '', inviteLink: '' },
  downline: { level1Total: 0, level1Active: 0, level2Total: 0, level3Total: 0 },
  level1Invited: [],
  tier: null,
  balance: { pendingAmount: 0, claimableAmount: 0, claimedAmount: 0, totalEarned: 0, lastClaimedAt: null },
  settings: { cadence: 'weekly', holdDays: 7, turnoverX: 0, firstDepositMinBdt: 0, firstDepositRewardBdt: 0 },
  claim: { cadenceBlocked: false, nextClaimAt: null },
  recentCommissions: [],
  recentClaims: [],
};

export default function ReferralPage() {
  const t = useT();
  const { lang } = useLang();
  const [copied, setCopied] = useState<string | null>(null);
  const [data, setData] = useState<MeResponse>(EMPTY);
  const [authed, setAuthed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);
  const [toast, setToast] = useState<{ kind: 'ok' | 'err'; message: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch('/api/me/referrals', { cache: 'no-store', credentials: 'include' });
      if (r.status === 401) {
        setAuthed(false);
        return;
      }
      const j = await r.json();
      if (!r.ok) {
        setAuthed(false);
        return;
      }
      setAuthed(true);
      setData(j as MeResponse);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const copy = async (value: string, key: string) => {
    if (typeof navigator !== 'undefined') {
      try {
        await navigator.clipboard.writeText(value);
        setCopied(key);
        setTimeout(() => setCopied((c) => (c === key ? null : c)), 1600);
      } catch { /* clipboard blocked */ }
    }
  };

  // Fallback toast helper for the share flow. Surfaces the copied-link
  // confirmation when a popup channel cannot be opened (popup blocker,
  // WebView with no app installed, desktop with no SMS handler, etc).
  const showCopiedToast = useCallback(() => {
    setToast({
      kind: 'ok',
      message: lang === 'bn'
        ? 'রেফারেল লিঙ্ক কপি হয়েছে। বন্ধুদের সাথে শেয়ার করুন।'
        : 'Referral link copied. Share it with your friends.',
    });
    setTimeout(() => setToast((c) => (c && c.kind === 'ok' ? null : c)), 2400);
  }, [lang]);

  // Open a URL in a new tab/window. Some popup blockers refuse
  // window.open from an async handler unless it was triggered by the
  // user gesture this call still sits inside, so we return whether the
  // open succeeded and fall back to clipboard copy + toast when not.
  const openExternal = useCallback(async (url: string, link: string) => {
    let opened = false;
    try {
      const win = window.open(url, '_blank', 'noopener,noreferrer');
      opened = Boolean(win);
    } catch {
      opened = false;
    }
    if (!opened) {
      try {
        if (typeof navigator !== 'undefined' && navigator.clipboard) {
          await navigator.clipboard.writeText(link);
        }
      } catch { /* ignore */ }
      showCopiedToast();
    }
  }, [showCopiedToast]);

  // SMS and mailto must use the same window so the OS handler picks
  // them up reliably across iOS, Android, desktop and WebView.
  const openSameWindow = useCallback(async (url: string, link: string) => {
    try {
      window.location.href = url;
    } catch {
      try {
        if (typeof navigator !== 'undefined' && navigator.clipboard) {
          await navigator.clipboard.writeText(link);
        }
      } catch { /* ignore */ }
      showCopiedToast();
    }
  }, [showCopiedToast]);

  const buildShareMessage = useCallback((link: string) => {
    return lang === 'bn'
      ? `আমার রেফারেল লিঙ্ক ব্যবহার করে পাশা ৯-এ যোগ দিন: ${link}`
      : `Join Pasha 9 using my referral link: ${link}`;
  }, [lang]);

  const onNativeShare = useCallback(async (link: string) => {
    const message = buildShareMessage(link);
    if (typeof navigator !== 'undefined' && typeof (navigator as Navigator & { share?: (data: ShareData) => Promise<void> }).share === 'function') {
      try {
        await (navigator as Navigator & { share: (data: ShareData) => Promise<void> }).share({
          title: 'Pasha 9',
          text: message,
          url: link,
        });
        return;
      } catch {
        // User cancelled or browser refused; fall through to copy.
      }
    }
    try {
      if (navigator.clipboard) await navigator.clipboard.writeText(link);
    } catch { /* ignore */ }
    showCopiedToast();
  }, [buildShareMessage, showCopiedToast]);

  const onShareWhatsApp = (link: string) => {
    const message = buildShareMessage(link);
    openExternal(`https://wa.me/?text=${encodeURIComponent(message)}`, link);
  };
  const onShareTelegram = (link: string) => {
    const message = buildShareMessage(link);
    openExternal(`https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(message)}`, link);
  };
  const onShareFacebook = (link: string) => {
    openExternal(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(link)}`, link);
  };
  const onShareSms = (link: string) => {
    const message = buildShareMessage(link);
    // sms:?body= is the most broadly supported form across iOS and
    // Android. Fall back to copy + toast inside openSameWindow if the
    // OS rejects the scheme.
    openSameWindow(`sms:?&body=${encodeURIComponent(message)}`, link);
  };
  const onShareEmail = (link: string) => {
    const message = buildShareMessage(link);
    const subject = lang === 'bn' ? 'পাশা ৯ যোগ দিন' : 'Join me on Pasha 9';
    openSameWindow(`mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}`, link);
  };

  const claim = async () => {
    setToast(null);
    setClaiming(true);
    try {
      const r = await fetch('/api/me/referrals/claim', { method: 'POST', credentials: 'include' });
      const j = await r.json().catch(() => null);
      if (r.status === 401) { window.location.href = '/?login=1'; return; }
      if (!r.ok) {
        const code = j?.code as string | undefined;
        const message = j?.message as string | undefined;
        setToast({ kind: 'err', message: message ?? code ?? 'Claim failed' });
        return;
      }
      const status = j?.status as string;
      if (status === 'paid') {
        setToast({
          kind: 'ok',
          message: data.settings.turnoverX > 0
            ? (lang === 'bn'
                ? `${formatBDT(Number(j?.amount ?? 0))} মেইন ব্যালেন্সে যোগ হয়েছে। উইথড্রয়ালের আগে টার্নওভার সম্পূর্ণ করুন।`
                : `${formatBDT(Number(j?.amount ?? 0))} moved to your main balance with an active withdrawal turnover lock.`)
            : (lang === 'bn'
                ? `${formatBDT(Number(j?.amount ?? 0))} মেইন ব্যালেন্সে যোগ হয়েছে।`
                : `${formatBDT(Number(j?.amount ?? 0))} moved to your main balance.`),
        });
        triggerWalletRefresh();
      } else {
        setToast({
          kind: 'ok',
          message: lang === 'bn'
            ? 'রিভিউয়ের জন্য পাঠানো হয়েছে। অ্যাডমিন অনুমোদনের পর ব্যালেন্সে যাবে।'
            : 'Sent for admin review. Funds move to your main balance after approval.',
        });
      }
      await load();
    } catch (e) {
      setToast({ kind: 'err', message: e instanceof Error ? e.message : 'Claim failed' });
    } finally {
      setClaiming(false);
    }
  };

  if (!loading && !authed) {
    return (
      <div className="space-y-6 pb-24 md:pb-6">
        <BackBar title={t('referral.title')} />
        <PageHeader title={t('referral.title')} subtitle={t('referral.subtitle')} icon={<Users className="h-5 w-5" />} />
        <Card padding="lg" className="mx-auto max-w-md text-center">
          <p className="text-sm text-ink-mid">{lang === 'bn' ? 'আপনার রেফারেল ড্যাশবোর্ড দেখতে লগইন করুন।' : 'Log in to see your referral dashboard.'}</p>
          <div className="mt-4">
            <Link href="/?login=1" className="btn-yellow inline-flex h-10 items-center rounded-lg px-4 text-sm">
              <LogIn className="mr-1.5 h-4 w-4" /> {lang === 'bn' ? 'লগইন' : 'Log in'}
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  const claimDisabled = claiming || data.balance.claimableAmount <= 0 || data.claim.cadenceBlocked;
  const claimReason = (() => {
    if (data.balance.claimableAmount <= 0) {
      return lang === 'bn' ? 'বর্তমানে দাবিযোগ্য কোনো ব্যালেন্স নেই।' : 'No claimable balance right now.';
    }
    if (data.claim.cadenceBlocked && data.claim.nextClaimAt) {
      const nxt = formatDateTime(data.claim.nextClaimAt, lang);
      return lang === 'bn' ? `পরবর্তী দাবি: ${nxt}` : `Next claim available: ${nxt}`;
    }
    if (data.settings.cadence === 'manual') {
      return lang === 'bn' ? 'ম্যানুয়াল কেডেন্স: অ্যাডমিন রিভিউয়ের পর মেইন ব্যালেন্সে যাবে।' : 'Manual cadence: funds release after admin review.';
    }
    if (data.settings.turnoverX > 0) {
      return lang === 'bn'
        ? `রিওয়ার্ড মেইন ব্যালেন্সে যোগ হবে এবং ${data.settings.turnoverX}x টার্নওভার শেষ না হওয়া পর্যন্ত উইথড্রয়াল লক থাকবে।`
        : `The reward moves to main balance and remains locked from withdrawal until ${data.settings.turnoverX}x turnover is complete.`;
    }
    return null;
  })();

  return (
    <div className="space-y-6 pb-24 md:pb-6">
      <BackBar title={t('referral.title')} />
      <PageHeader
        title={t('referral.title')}
        subtitle={t('referral.subtitle')}
        icon={<Users className="h-5 w-5" />}
        action={<Button variant="ghost" leftIcon={<RefreshCw className="h-4 w-4" />} onClick={load}>{lang === 'bn' ? 'রিফ্রেশ' : 'Refresh'}</Button>}
      />

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="card-glow space-y-5 p-6 lg:col-span-2">
          <div className="grid gap-4 md:grid-cols-2">
            <CopyRow label={t('referral.code')} value={data.user.referralCode || '-'} />
            <CopyRow label={t('referral.link')} value={data.user.inviteLink || '-'} />
          </div>

          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            <Stat label={t('referral.totalInvited')} value={String(data.downline.level1Total + data.downline.level2Total + data.downline.level3Total)} />
            <Stat label={t('referral.totalEarned')} value={formatBDT(data.balance.totalEarned)} accent />
            <Stat label={t('referral.pending')} value={formatBDT(data.balance.pendingAmount)} />
            <Stat label={lang === 'bn' ? 'দাবিযোগ্য' : 'Claimable'} value={formatBDT(data.balance.claimableAmount)} accent />
            <Stat label={lang === 'bn' ? 'পরিশোধিত' : 'Claimed'} value={formatBDT(data.balance.claimedAmount)} />
          </div>

          <Card padding="md" className="border-l-4 border-emerald-400/60">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-signal-ok">{lang === 'bn' ? 'দাবি করুন' : 'Claim referral balance'}</p>
                <p className="mt-1 text-xl font-extrabold text-ink-hi tabular-nums">{formatBDT(data.balance.claimableAmount)}</p>
                <p className="mt-1 text-[11px] text-ink-mid">
                  {lang === 'bn'
                    ? `কেডেন্স ${data.settings.cadence} . হোল্ড ${data.settings.holdDays} দিন`
                    : `Cadence ${data.settings.cadence} . hold ${data.settings.holdDays} day${data.settings.holdDays === 1 ? '' : 's'}`}
                </p>
              </div>
              <Button
                variant="gold"
                leftIcon={<Wallet className="h-4 w-4" />}
                disabled={claimDisabled}
                loading={claiming}
                onClick={claim}
              >
                {lang === 'bn' ? 'মেইন ব্যালেন্সে স্থানান্তর' : 'Transfer to main balance'}
              </Button>
            </div>
            {claimReason ? <p className="mt-2 text-[11px] text-ink-mid"><AlertCircle className="mr-1 inline h-3 w-3" />{claimReason}</p> : null}
            {toast ? (
              <p className={`mt-2 text-[12px] ${toast.kind === 'ok' ? 'text-signal-ok' : 'text-signal-danger'}`}>{toast.message}</p>
            ) : null}
          </Card>

          <div>
            <h3 className="mb-3 text-sm font-semibold text-ink-hi">{t('referral.levels')}</h3>
            <div className="grid grid-cols-3 gap-3 text-center">
              {[
                { key: 'level1', rate: data.tier?.level1Pct ?? 0 },
                { key: 'level2', rate: data.tier?.level2Pct ?? 0 },
                { key: 'level3', rate: data.tier?.level3Pct ?? 0 },
              ].map((lvl) => (
                <div key={lvl.key} className="rounded-xl border border-neon/15 bg-base-deep/40 p-4">
                  <p className="text-xs uppercase tracking-wider text-ink-lo">{t(`referral.${lvl.key}`)}</p>
                  <p className="mt-1 text-xl font-bold text-gradient-gold">{lvl.rate ? `${lvl.rate}%` : '-'}</p>
                </div>
              ))}
            </div>
            {!data.tier ? <p className="mt-2 text-[11px] text-ink-mid">{lang === 'bn' ? 'টিয়ার অ্যাসাইন হলে পার্সেন্ট এখানে দেখা যাবে।' : 'Tier rates appear here once an admin assigns you to a commission tier.'}</p> : null}
          </div>
        </div>

        <div className="card-glow space-y-3 p-6">
          <h3 className="text-sm font-semibold text-ink-hi">{lang === 'bn' ? 'শেয়ার করুন' : 'Share with'}</h3>
          <p className="text-xs text-ink-lo">{lang === 'bn' ? 'এক ট্যাপে আপনার লিংক শেয়ার করুন।' : 'One-tap share your invite link.'}</p>
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => onNativeShare(data.user.inviteLink)}
              className="flex w-full items-center justify-between rounded-xl border border-neon/40 bg-neon/10 px-3 py-2 text-sm text-ink-hi hover:bg-neon/15"
            >
              <span className="inline-flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-neon/15 text-neon">
                  <Share2 className="h-3.5 w-3.5" />
                </span>
                {lang === 'bn' ? 'শেয়ার করুন' : 'Share via...'}
              </span>
              <ArrowRight className="h-4 w-4 text-ink-lo" />
            </button>

            <button
              type="button"
              onClick={() => onShareWhatsApp(data.user.inviteLink)}
              className="flex w-full items-center justify-between rounded-xl border border-neon/15 bg-base-deep/40 px-3 py-2 text-sm text-ink-hi hover:border-neon/40"
              aria-label={`Share on WhatsApp`}
            >
              <span className="inline-flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#25D366]/15 text-[#25D366]">
                  <MessageCircle className="h-3.5 w-3.5" />
                </span>
                WhatsApp
              </span>
              <ArrowRight className="h-4 w-4 text-ink-lo" />
            </button>

            <button
              type="button"
              onClick={() => onShareTelegram(data.user.inviteLink)}
              className="flex w-full items-center justify-between rounded-xl border border-neon/15 bg-base-deep/40 px-3 py-2 text-sm text-ink-hi hover:border-neon/40"
              aria-label={`Share on Telegram`}
            >
              <span className="inline-flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#229ED9]/15 text-[#229ED9]">
                  <Send className="h-3.5 w-3.5" />
                </span>
                Telegram
              </span>
              <ArrowRight className="h-4 w-4 text-ink-lo" />
            </button>

            <button
              type="button"
              onClick={() => onShareFacebook(data.user.inviteLink)}
              className="flex w-full items-center justify-between rounded-xl border border-neon/15 bg-base-deep/40 px-3 py-2 text-sm text-ink-hi hover:border-neon/40"
              aria-label={`Share on Facebook`}
            >
              <span className="inline-flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#1877F2]/15 text-[#1877F2]">
                  <Facebook className="h-3.5 w-3.5" />
                </span>
                Facebook
              </span>
              <ArrowRight className="h-4 w-4 text-ink-lo" />
            </button>

            <button
              type="button"
              onClick={() => onShareSms(data.user.inviteLink)}
              className="flex w-full items-center justify-between rounded-xl border border-neon/15 bg-base-deep/40 px-3 py-2 text-sm text-ink-hi hover:border-neon/40"
              aria-label={`Share via SMS`}
            >
              <span className="inline-flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-300">
                  <MessageSquare className="h-3.5 w-3.5" />
                </span>
                SMS
              </span>
              <ArrowRight className="h-4 w-4 text-ink-lo" />
            </button>

            <button
              type="button"
              onClick={() => onShareEmail(data.user.inviteLink)}
              className="flex w-full items-center justify-between rounded-xl border border-neon/15 bg-base-deep/40 px-3 py-2 text-sm text-ink-hi hover:border-neon/40"
              aria-label={`Share via Email`}
            >
              <span className="inline-flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-500/15 text-amber-300">
                  <Mail className="h-3.5 w-3.5" />
                </span>
                Email
              </span>
              <ArrowRight className="h-4 w-4 text-ink-lo" />
            </button>
          </div>
        </div>
      </div>

      <section className="card-glow overflow-hidden p-0">
        <div className="border-b border-neon/10 px-6 py-4">
          <h3 className="text-sm font-semibold text-ink-hi">{lang === 'bn' ? 'সাম্প্রতিক রেফারেল' : 'Latest referrals'}</h3>
          <p className="text-[11px] text-ink-mid">{lang === 'bn' ? 'লেভেল ১ ইনভাইট তালিকা।' : 'Level 1 invitees (masked).'}</p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-neon/10 bg-base-deep/40 text-xs uppercase tracking-wider text-ink-lo">
                <th className="px-4 py-3 text-left">{lang === 'bn' ? 'ইউজার' : 'User'}</th>
                <th className="px-4 py-3 text-left">{lang === 'bn' ? 'ফোন' : 'Phone'}</th>
                <th className="px-4 py-3 text-left">{lang === 'bn' ? 'যোগ' : 'Joined'}</th>
              </tr>
            </thead>
            <tbody>
              {data.level1Invited.length === 0 ? (
                <tr><td colSpan={3} className="px-4 py-6 text-center text-ink-mid">{lang === 'bn' ? 'এখনো কোনো রেফারেল নেই।' : 'No referrals yet. Share your invite link to start earning.'}</td></tr>
              ) : null}
              {data.level1Invited.map((u, idx) => (
                <tr key={`${u.username}-${idx}`} className="table-row">
                  <td className="px-4 py-3 text-ink-hi">{u.username}</td>
                  <td className="px-4 py-3 font-mono text-xs text-ink-lo">{u.phone || '-'}</td>
                  <td className="px-4 py-3 text-ink-lo">{formatDate(u.joinedAt, lang)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card-glow overflow-hidden p-0">
        <div className="border-b border-neon/10 px-6 py-4">
          <h3 className="text-sm font-semibold text-ink-hi">{lang === 'bn' ? 'সাম্প্রতিক কমিশন' : 'Recent commissions'}</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-neon/10 bg-base-deep/40 text-xs uppercase tracking-wider text-ink-lo">
                <th className="px-4 py-3 text-left">Level</th>
                <th className="px-4 py-3 text-left">Rate</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">When</th>
              </tr>
            </thead>
            <tbody>
              {data.recentCommissions.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-6 text-center text-ink-mid">{lang === 'bn' ? 'এখনো কোনো কমিশন নেই।' : 'No commission rows yet.'}</td></tr>
              ) : null}
              {data.recentCommissions.map((c) => (
                <tr key={c.id} className="table-row">
                  <td className="px-4 py-3 text-ink-hi">L{c.level}</td>
                  <td className="px-4 py-3 text-ink-mid">{c.ratePct ? `${c.ratePct}%` : '-'}</td>
                  <td className="px-4 py-3 text-right text-gradient-gold tabular-nums">{formatBDT(c.amount)}</td>
                  <td className="px-4 py-3">
                    <Chip tone={c.status === 'paid' ? 'ok' : c.status === 'approved' ? 'info' : c.status === 'cancelled' ? 'danger' : 'warn'}>{c.status}</Chip>
                  </td>
                  <td className="px-4 py-3 text-ink-lo">{formatDate(c.createdAt, lang)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card-glow overflow-hidden p-0">
        <div className="border-b border-neon/10 px-6 py-4">
          <h3 className="text-sm font-semibold text-ink-hi">{lang === 'bn' ? 'দাবি ইতিহাস' : 'Claim history'}</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-neon/10 bg-base-deep/40 text-xs uppercase tracking-wider text-ink-lo">
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">When</th>
                <th className="px-4 py-3 text-left">Paid</th>
              </tr>
            </thead>
            <tbody>
              {data.recentClaims.length === 0 ? (
                <tr><td colSpan={4} className="px-4 py-6 text-center text-ink-mid">{lang === 'bn' ? 'কোনো দাবি নেই।' : 'No claims yet.'}</td></tr>
              ) : null}
              {data.recentClaims.map((c) => (
                <tr key={c.id} className="table-row">
                  <td className="px-4 py-3 text-right tabular-nums">{formatBDT(c.amount)}</td>
                  <td className="px-4 py-3"><Chip tone={c.status === 'paid' ? 'ok' : c.status === 'rejected' ? 'danger' : 'warn'}>{c.status}</Chip></td>
                  <td className="px-4 py-3 text-ink-lo">{formatDateTime(c.createdAt, lang)}</td>
                  <td className="px-4 py-3 text-ink-lo">{c.paidAt ? formatDateTime(c.paidAt, lang) : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <Card padding="md">
        <p className="text-[11px] text-ink-mid">
          <Clock className="mr-1 inline h-3 w-3" />
          {lang === 'bn'
            ? `কমিশন ${data.settings.holdDays} দিনের হোল্ডের পর দাবিযোগ্য হয়। ${data.settings.cadence === 'auto' ? 'অটো কেডেন্সে প্রতিদিন দাবি করা যাবে।' : `কেডেন্স: ${data.settings.cadence}.`}`
            : `Commissions become claimable after a ${data.settings.holdDays}-day hold. ${data.settings.cadence === 'auto' ? 'Auto cadence: claim whenever a balance is available.' : `Cadence: ${data.settings.cadence}.`}`}
        </p>
      </Card>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-xl border border-neon/10 bg-base-deep/40 p-4">
      <p className="text-[11px] uppercase tracking-wider text-ink-lo">{label}</p>
      <p className={accent ? 'mt-1 text-lg font-bold text-gradient-gold tabular-nums' : 'mt-1 text-lg font-bold text-ink-hi tabular-nums'}>{value}</p>
    </div>
  );
}
