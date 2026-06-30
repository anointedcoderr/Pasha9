'use client';

import { useEffect, useState } from 'react';
import { PageHeader } from '@/components/site/PageHeader';
import { StatTile } from '@/components/ui/StatTile';
import { Card, CardHeader } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { formatBDT, formatDateTime, relativeTime } from '@/lib/utils/format';
import { useT, useLang } from '@/lib/i18n/context';
import { useMe, walletBalance } from '@/lib/hooks/useMe';
import { Wallet, Sparkles, TrendingUp, ArrowDownToLine, ArrowUpToLine, Gift, Users } from 'lucide-react';
import Link from 'next/link';
import { ROUTES } from '@/lib/constants/routes';

interface LedgerRow {
  id: string;
  type: 'deposit' | 'withdraw' | 'bonus' | 'referral' | 'bet' | 'win' | 'adjust';
  amount: number;
  status: 'pending' | 'completed' | 'failed';
  createdAt: string;
}

export default function DashboardOverview() {
  const t = useT();
  const { lang } = useLang();
  const { me } = useMe();
  const [txs, setTxs] = useState<LedgerRow[]>([]);

  // Recent activity from the canonical Transaction ledger.
  useEffect(() => {
    let alive = true;
    const load = () => {
      fetch('/api/me/transactions?take=6', { cache: 'no-store', credentials: 'include' })
        .then((r) => (r.ok ? r.json() : null))
        .then((j) => {
          if (!alive) return;
          if (Array.isArray(j?.transactions)) setTxs(j.transactions as LedgerRow[]);
        })
        .catch(() => { /* keep empty */ });
    };
    load();
    const handler = () => load();
    window.addEventListener('pasha9:wallet-refresh', handler);
    return () => { alive = false; window.removeEventListener('pasha9:wallet-refresh', handler); };
  }, []);

  const username = me?.username ?? '...';

  return (
    <>
      <PageHeader
        title={`${t('dashboard.welcome')}, ${username}`}
        subtitle="Your account at a glance"
        icon={<Wallet className="h-5 w-5" />}
        action={
          <div className="flex gap-2">
            <Link href={ROUTES.dashboard.deposit}>
              <button className="btn-gold inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold">
                <ArrowDownToLine className="h-4 w-4" /> Deposit
              </button>
            </Link>
            <Link href={ROUTES.dashboard.withdraw}>
              <button className="btn-neon inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold">
                <ArrowUpToLine className="h-4 w-4" /> Withdraw
              </button>
            </Link>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label={t('dashboard.balance')} value={formatBDT(walletBalance(me))} icon={<Wallet className="h-5 w-5 text-neon" />} accent="gold" />
        <StatTile label={t('dashboard.todayProfit')} value={formatBDT(0, { sign: true })} icon={<TrendingUp className="h-5 w-5 text-neon" />} hint="Live P&L ships in M2" />
        <StatTile label={t('dashboard.totalDeposit')} value={formatBDT(0)} icon={<ArrowDownToLine className="h-5 w-5 text-gold-300" />} hint="Aggregates ship in M2" />
        <StatTile label={t('dashboard.totalWithdraw')} value={formatBDT(0)} icon={<ArrowUpToLine className="h-5 w-5 text-gold-300" />} hint="Aggregates ship in M2" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card padding="lg" className="lg:col-span-2">
          <CardHeader title={t('dashboard.recentActivity')} subtitle="Last few transactions on your account" action={<Link href={ROUTES.dashboard.transactions} className="text-xs text-neon hover:text-ink-hi">View all</Link>} />
          <ul className="divide-y divide-neon/10">
            {txs.length === 0 ? (
              <li className="py-6 text-center text-sm text-ink-mid">
                {lang === 'bn' ? 'এখনো কোনো ট্রানজ্যাকশন নেই।' : 'No transactions yet.'}
              </li>
            ) : null}
            {txs.map((tx) => (
              <li key={tx.id} className="flex items-center justify-between gap-3 py-3">
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-neon/15 bg-base-deep/40 text-neon">
                    {tx.type === 'deposit' || tx.type === 'win' || tx.type === 'bonus' || tx.type === 'referral' ? <ArrowDownToLine className="h-4 w-4" /> : <ArrowUpToLine className="h-4 w-4" />}
                  </span>
                  <div>
                    <p className="text-sm font-medium capitalize text-ink-hi">{tx.type}</p>
                    <p className="text-xs text-ink-lo">{relativeTime(tx.createdAt, lang)}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`text-sm font-semibold tabular-nums ${tx.amount > 0 ? 'text-signal-ok' : tx.amount < 0 ? 'text-signal-danger' : 'text-ink-lo'}`}>{tx.amount === 0 ? '-' : formatBDT(tx.amount, { sign: true })}</p>
                  <Chip tone={tx.status === 'completed' ? 'ok' : tx.status === 'pending' ? 'warn' : 'danger'} className="mt-1">{tx.status}</Chip>
                </div>
              </li>
            ))}
          </ul>
        </Card>

        <div className="space-y-4">
          <Card tone="gold" padding="lg">
            <p className="text-xs uppercase tracking-wider text-gold-300">Bonus</p>
            <h3 className="mt-1 text-lg font-semibold text-ink-hi">First Deposit 100%</h3>
            <p className="mt-1 text-sm text-ink-mid">Match your first deposit up to 10,000 BDT.</p>
            <Link href={ROUTES.promotions} className="mt-3 inline-flex items-center gap-2 rounded-xl border border-gold-500/30 bg-gold-500/10 px-3 py-2 text-sm text-gold-300 hover:bg-gold-500/15">
              <Gift className="h-4 w-4" /> Claim
            </Link>
          </Card>
          <Card padding="lg">
            <p className="text-xs uppercase tracking-wider text-ink-lo">Referral</p>
            <h3 className="mt-1 text-lg font-semibold text-ink-hi">Earn 8 / 4 / 2 %</h3>
            <p className="mt-1 text-sm text-ink-mid">Three-level referral payouts with daily settlement.</p>
            <Link href={ROUTES.dashboard.referral} className="mt-3 inline-flex items-center gap-2 rounded-xl border border-neon/30 bg-neon/10 px-3 py-2 text-sm text-neon hover:bg-neon/15">
              <Users className="h-4 w-4" /> Open referral
            </Link>
          </Card>
        </div>
      </div>

      <Card padding="md" className="mt-6">
        <div className="flex items-start gap-3 text-xs text-ink-mid">
          <Sparkles className="h-4 w-4 text-gold-300" />
          <p>Last login on {formatDateTime(Date.now() - 7200_000, lang)}. If this was not you, change your password in Security settings.</p>
        </div>
      </Card>
    </>
  );
}
