// Built by Anointed Coder.
//
// Reports & Analytics. M1 surfaces the real DB-grounded counts the
// overview already aggregates plus a quick "this week" deposit /
// withdrawal split. Cohort and time-series charts ship in M2.

'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { PageHeader } from '@/components/site/PageHeader';
import { Card, CardHeader } from '@/components/ui/Card';
import { StatTile } from '@/components/ui/StatTile';
import { Chip } from '@/components/ui/Chip';
import { Button } from '@/components/ui/Button';
import { formatBDT } from '@/lib/utils/format';
import { BarChart3, TrendingUp, Users, Wallet, Ticket, RefreshCw, Lock } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { ROUTES } from '@/lib/constants/routes';

interface Overview {
  kpis: {
    totalUsers: number;
    activeUsersLast7: number;
    newUsersToday: number;
    approvedDepositsTotal: number;
    approvedDepositsToday: number;
    pendingDepositsCount: number;
    pendingDepositsAmount: number;
    approvedWithdrawalsTotal: number;
    pendingWithdrawalsCount: number;
    pendingWithdrawalsAmount: number;
    platformBalance: number;
    lottoBalanceOutstanding: number;
    lotteryTickets: number;
    lotteryWinnings: number;
  };
}

const NET_HINT = 'Approved deposits minus approved withdrawals.';

export default function AdminReportsPage() {
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    setRefreshing(true);
    try {
      const res = await fetch('/api/admin/overview', { cache: 'no-store' });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.message ?? body?.code ?? 'Failed');
      setData(body as Overview);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const k = data?.kpis;
  const netFlow = k ? k.approvedDepositsTotal - k.approvedWithdrawalsTotal : 0;

  return (
    <>
      <PageHeader
        title="Reports & Analytics"
        subtitle="DB-grounded counts; cohort and time-series charts ship in M2"
        icon={<BarChart3 className="h-5 w-5" />}
        action={
          <Button variant="neon" leftIcon={<RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} />} onClick={load}>
            Refresh
          </Button>
        }
      />

      {error ? <Card padding="md" className="mb-4"><p className="text-sm text-signal-danger">{error}</p></Card> : null}

      {!k ? (
        <Card padding="lg">Loading...</Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatTile label="Total Users" value={k.totalUsers.toLocaleString()} icon={<Users className="h-5 w-5 text-neon" />} hint={`+${k.newUsersToday} today`} />
            <StatTile label="Active Users (7d)" value={k.activeUsersLast7.toLocaleString()} icon={<Users className="h-5 w-5 text-neon" />} />
            <StatTile label="Deposits Today" value={formatBDT(k.approvedDepositsToday, { compact: true })} icon={<TrendingUp className="h-5 w-5 text-gold-300" />} hint="approved" />
            <StatTile label="Net Flow (lifetime)" value={formatBDT(netFlow, { compact: true })} icon={<Wallet className="h-5 w-5 text-neon" />} hint={NET_HINT} accent="mixed" />
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <Card padding="lg">
              <CardHeader title="Cash flow (lifetime, approved)" />
              <dl className="space-y-2">
                <Row label="Approved deposits" value={formatBDT(k.approvedDepositsTotal)} />
                <Row label="Approved withdrawals" value={formatBDT(k.approvedWithdrawalsTotal)} />
                <Row label="Pending deposits queued" value={`${k.pendingDepositsCount} · ${formatBDT(k.pendingDepositsAmount)}`} />
                <Row label="Pending withdrawals queued" value={`${k.pendingWithdrawalsCount} · ${formatBDT(k.pendingWithdrawalsAmount)}`} />
                <Row label="Platform main balance (all users)" value={formatBDT(k.platformBalance)} />
              </dl>
            </Card>

            <Card padding="lg">
              <CardHeader title="Lotto exposure" />
              <dl className="space-y-2">
                <Row label="Tickets issued (all time)" value={k.lotteryTickets.toLocaleString()} />
                <Row label="Winning records (all time)" value={k.lotteryWinnings.toLocaleString()} />
                <Row label="Lotto balance outstanding" value={formatBDT(k.lottoBalanceOutstanding)} />
              </dl>
              <div className="mt-4 flex gap-2">
                <Link href="/admin/lotto" className="rounded-md bg-gold-500/15 px-3 py-1.5 text-xs font-semibold text-gold-300 hover:bg-gold-500/25">Manage draws</Link>
              </div>
            </Card>
          </div>

          <Card padding="lg" className="mt-6">
            <CardHeader
              title="Daily P&L · top-player · cohort"
              subtitle="Time-series and cohort views"
              action={<Chip tone="warn">Ready for M2</Chip>}
            />
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <ScaffoldRow icon={Ticket} label="Daily profit / loss chart (7d / 30d / 90d)" />
              <ScaffoldRow icon={Users} label="Top players by approved deposit volume" />
              <ScaffoldRow icon={TrendingUp} label="Deposit-to-withdrawal conversion cohort" />
              <ScaffoldRow icon={Users} label="Referral funnel: signups → first deposit" />
              <ScaffoldRow icon={Wallet} label="Bonus usage and turnover compliance" />
              <ScaffoldRow icon={BarChart3} label="Provider / game GGR breakdown" />
            </div>
            <p className="mt-3 text-xs text-ink-mid">
              Every M2 report sources from existing tables (Transaction, Deposit, Withdrawal, UserBonus,
              AffiliateCommission, LotteryTicket, LotteryWinning) - no extra schema is required.
            </p>
          </Card>

          <Card padding="md" className="mt-4">
            <div className="flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-700">
                <Lock className="h-4 w-4" />
              </span>
              <p className="text-xs text-ink-mid">
                Numbers refresh on demand via the <Link href={ROUTES.admin.activity} className="text-gold-300 hover:underline">Activity Log</Link>'s
                same audit trail - every approval / settle action is logged so historical reconstruction is
                always possible from the DB.
              </p>
            </div>
          </Card>
        </>
      )}
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-neon/05 py-2 text-sm">
      <dt className="text-ink-mid">{label}</dt>
      <dd className="font-semibold text-ink-hi tabular-nums">{value}</dd>
    </div>
  );
}

function ScaffoldRow({ icon: Icon, label }: { icon: React.ComponentType<{ className?: string }>; label: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-neon/10 bg-base-deep/40 p-3 text-sm text-ink-mid">
      <Icon className="h-4 w-4 text-gold-300" />
      <span>{label}</span>
    </div>
  );
}
