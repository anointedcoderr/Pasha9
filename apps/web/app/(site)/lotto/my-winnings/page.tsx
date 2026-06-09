// Built by Anointed Coder.
//
// /lotto/my-winnings - dedicated player page.
//
// Reads /api/lotto/me (already returns winnings + summary). Renders
// tiles for today's / lifetime / claimable / claimed totals plus the
// per-winning list with a Claim button on rows in status=pending_credit
// (manual claim mode at settlement time).

'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { PageHeader } from '@/components/site/PageHeader';
import { BackBar } from '@/components/site/BackBar';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Trophy, LogIn, RefreshCw, Ticket, Wallet } from 'lucide-react';
import { useT, useLang } from '@/lib/i18n/context';
import { formatBDT } from '@/lib/utils/format';
import { triggerWalletRefresh } from '@/components/site/WalletStrip';
import { LottoCertificateCard } from '@/components/site/LottoPremium';

interface WinningRow {
  id: string;
  amount: number;
  prizeTier: string;
  status: 'pending_credit' | 'credited' | 'cancelled';
  ticketNumber: string;
  resultId: string;
  drawId: string | null;
  createdAt: string;
  creditedAt: string | null;
  // /api/lotto/me already returns these; the prior interface omitted
  // them. The certificate card renders the winning number alongside
  // the player's ticket so the win story reads at a glance.
  winningNumber?: string;
  publishedAt?: string;
}

interface MyResp {
  winnings: WinningRow[];
  lottoBalance: number;
  summary: { wonLifetime: number; wonToday: number };
}

export default function LottoMyWinningsPage() {
  const t = useT();
  const { lang } = useLang();
  const [data, setData] = useState<MyResp | null>(null);
  const [needsLogin, setNeedsLogin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ kind: 'ok' | 'err'; message: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch('/api/lotto/me', { cache: 'no-store', credentials: 'include' });
      if (r.status === 401) { setNeedsLogin(true); setData(null); return; }
      const j = await r.json().catch(() => null);
      if (!r.ok || !j) return;
      setNeedsLogin(false);
      setData(j as MyResp);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const claim = async (id: string) => {
    setClaimingId(id); setToast(null);
    try {
      const r = await fetch(`/api/lotto/winnings/${id}/claim`, { method: 'POST', credentials: 'include' });
      const j = await r.json().catch(() => null);
      if (r.status === 401) { window.location.href = '/?login=1'; return; }
      if (!r.ok) {
        setToast({ kind: 'err', message: j?.message ?? j?.code ?? 'Claim failed' });
        return;
      }
      setToast({
        kind: 'ok',
        message: lang === 'bn'
          ? `${formatBDT(Number(j?.amount ?? 0))} লটো ব্যালেন্সে যোগ হয়েছে।`
          : `${formatBDT(Number(j?.amount ?? 0))} added to your lotto balance.`,
      });
      triggerWalletRefresh();
      await load();
    } catch (e) {
      setToast({ kind: 'err', message: e instanceof Error ? e.message : 'Claim failed' });
    } finally {
      setClaimingId(null);
    }
  };

  const claimableTotal = useMemo(() => {
    if (!data) return 0;
    return data.winnings.filter((w) => w.status === 'pending_credit').reduce((acc, w) => acc + Number(w.amount), 0);
  }, [data]);

  if (needsLogin) {
    return (
      <div className="space-y-6 pb-24 md:pb-6">
        <BackBar title={lang === 'bn' ? 'আমার জয়' : 'My winnings'} />
        <Card padding="lg" className="mx-auto max-w-md text-center">
          <p className="text-sm text-ink-mid">{lang === 'bn' ? 'জয়ের ইতিহাস দেখতে লগইন করুন।' : 'Log in to view your winnings.'}</p>
          <div className="mt-4">
            <Link href="/?login=1" className="btn-yellow inline-flex h-10 items-center rounded-lg px-4 text-sm">
              <LogIn className="mr-1.5 h-4 w-4" /> {lang === 'bn' ? 'লগইন' : 'Log in'}
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  const winnings = data?.winnings ?? [];

  return (
    <div className="space-y-6 pb-24 md:pb-6">
      <BackBar title={lang === 'bn' ? 'আমার জয়' : 'My winnings'} />
      <PageHeader
        title={lang === 'bn' ? 'আমার জয়' : 'My winnings'}
        subtitle={lang === 'bn' ? 'লটো ফলাফল ও দাবি' : 'Lotto winnings and claims'}
        icon={<Trophy className="h-5 w-5" />}
        action={
          <div className="flex gap-2">
            <Link href="/lotto/my-tickets" className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-brand-divider bg-brand-paper px-3 text-xs font-bold text-brand-ink hover:border-brand-yellow-500">
              <Ticket className="h-3.5 w-3.5" /> {lang === 'bn' ? 'আমার টিকিট' : 'My tickets'}
            </Link>
            <Button variant="ghost" leftIcon={<RefreshCw className="h-3.5 w-3.5" />} onClick={load}>{lang === 'bn' ? 'রিফ্রেশ' : 'Refresh'}</Button>
          </div>
        }
      />

      <div className="grid gap-3 sm:grid-cols-4">
        <Tile label={lang === 'bn' ? 'আজকের জয়' : "Today's winnings"} value={formatBDT(data?.summary.wonToday ?? 0)} />
        <Tile label={lang === 'bn' ? 'লাইফটাইম জয়' : 'Lifetime winnings'} value={formatBDT(data?.summary.wonLifetime ?? 0)} accent />
        <Tile label={lang === 'bn' ? 'দাবিযোগ্য' : 'Claimable'} value={formatBDT(claimableTotal)} accent />
        <Tile label={lang === 'bn' ? 'লটো ব্যালেন্স' : 'Lotto balance'} value={formatBDT(data?.lottoBalance ?? 0)} />
      </div>

      {toast ? (
        <Card padding="sm" className={toast.kind === 'ok' ? 'border-l-4 border-emerald-400/60' : 'border-l-4 border-rose-400/60'}>
          <p className={`text-sm ${toast.kind === 'ok' ? 'text-emerald-300' : 'text-rose-300'}`}>{toast.message}</p>
        </Card>
      ) : null}

      <Card padding="md">
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-bold uppercase tracking-wider text-ink-lo">{lang === 'bn' ? 'জয়ের তালিকা' : 'Winnings list'}</p>
          <Link href="/dashboard/wallet" className="inline-flex items-center gap-1 text-[11px] text-neon hover:text-ink-hi">
            <Wallet className="h-3 w-3" /> {lang === 'bn' ? 'লটো ব্যালেন্স ট্রান্সফার' : 'Transfer lotto balance'}
          </Link>
        </div>
        {loading ? (
          <p className="mt-3 text-sm text-ink-mid">Loading...</p>
        ) : winnings.length === 0 ? (
          <p className="mt-3 text-sm text-ink-mid">{lang === 'bn' ? 'এখনো কোনো জয় নেই। অনুমোদিত জমার সাথে টিকিট তৈরি হয়।' : 'No winnings yet. Approved deposits generate tickets, and settled tickets land here.'}</p>
        ) : (
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {winnings.map((w, i) => (
              <div key={w.id} className="space-y-2">
                <LottoCertificateCard
                  ticketNumber={w.ticketNumber}
                  prizeTier={w.prizeTier}
                  amount={Number(w.amount)}
                  date={w.publishedAt ?? w.createdAt}
                  winningNumber={w.winningNumber ?? w.ticketNumber}
                  index={i}
                />
                {w.status === 'pending_credit' ? (
                  <Button
                    size="sm"
                    variant="gold"
                    loading={claimingId === w.id}
                    onClick={() => claim(w.id)}
                    className="w-full"
                  >
                    {lang === 'bn' ? `${formatBDT(Number(w.amount))} দাবি করুন` : `Claim ${formatBDT(Number(w.amount))}`}
                  </Button>
                ) : (
                  <p className="text-center text-[11px] text-ink-mid">
                    {w.status === 'credited'
                      ? (lang === 'bn' ? 'লটো ব্যালেন্সে জমা' : 'Credited to lotto balance')
                      : (lang === 'bn' ? 'বাতিল' : 'Cancelled')}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
        <p className="mt-3 text-[11px] text-ink-mid">
          {lang === 'bn'
            ? 'যেসব জয় credited দেখাচ্ছে সেগুলো ইতিমধ্যে লটো ব্যালেন্সে যোগ হয়েছে। মেইন ব্যালেন্সে আনতে /dashboard/wallet থেকে ট্রান্সফার করুন।'
            : 'Credited winnings are already on your lotto balance. Transfer them to your main wallet from /dashboard/wallet whenever you want.'}
        </p>
      </Card>
    </div>
  );
}

function Tile({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-xl border border-neon/10 bg-base-deep/40 p-4">
      <p className="text-[11px] uppercase tracking-wider text-ink-lo">{label}</p>
      <p className={accent ? 'mt-1 text-lg font-bold text-gradient-gold tabular-nums' : 'mt-1 text-lg font-bold text-ink-hi tabular-nums'}>{value}</p>
    </div>
  );
}
