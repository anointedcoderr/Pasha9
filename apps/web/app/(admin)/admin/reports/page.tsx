// Built by Anointed Coder.
//
// M2J reports console. Four tabs:
//   Overview     KPIs + 30-day deposit/withdrawal/net chart
//   Time-series  switch any metric x granularity, with date range
//   Cohorts      signup cohorts with conversion + LTV + 7/30d retention
//   Breakdowns   pie/bar across method/type/tier dimensions
// Every tab can export the underlying data as CSV.

'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { PageHeader } from '@/components/site/PageHeader';
import { Card, CardHeader } from '@/components/ui/Card';
import { StatTile } from '@/components/ui/StatTile';
import { Chip } from '@/components/ui/Chip';
import { Button } from '@/components/ui/Button';
import { FormField, Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs';
import {
  ResponsiveContainer, LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, Legend,
  BarChart, Bar, PieChart, Pie, Cell,
} from 'recharts';
import { formatBDT } from '@/lib/utils/format';
import { BarChart3, TrendingUp, Users, Wallet, RefreshCw, Download, Activity, PieChart as PieIcon, Calendar } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

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

interface BusinessSnapshot {
  range: { from: string; to: string };
  totalRegistrations: number;
  firstTimeDepositors: number;
  firstTimeDepositSum: number;
  activeLoggedInUsers: number;
  activePlayers: number;
  depositingUsers: number;
  approvedDepositCount: number;
  approvedDepositSum: number;
  pendingDepositCount: number;
  pendingDepositSum: number;
  approvedWithdrawalCount: number;
  approvedWithdrawalSum: number;
  pendingWithdrawalCount: number;
  pendingWithdrawalSum: number;
  totalWagered: number;
  totalWon: number;
  grossGamingRevenue: number;
  betCount: number;
  bonusGranted: number;
  cashbackPaid: number;
  affiliateCommissionPaid: number;
  netCash: number;
  operatingResult: number;
  avgDeposit: number;
  avgWithdrawal: number;
  avgRevenuePerActivePlayer: number;
  walletBalanceLive: number;
  walletLockedLive: number;
  bonusBalanceLive: number;
}

interface TsBucket { bucket: string; value: number; count: number }
interface TsResponse { metric: string; granularity: string; from: string; to: string; label: string; buckets: TsBucket[]; totals: { value: number; count: number } }

interface CohortRow {
  cohort: string;
  size: number;
  depositors: number;
  conversionPct: number;
  totalDeposits: number;
  arpu: number;
  retained7d: number;
  retained30d: number;
}
interface CohortsResponse { granularity: string; from: string; to: string; rows: CohortRow[] }

interface BreakdownRow { key: string; count: number; value: number }
interface BreakdownResponse { kind: string; rows: BreakdownRow[]; total: { count: number; value: number } }

const METRICS = [
  { key: 'deposits', label: 'Approved deposits (BDT)' },
  { key: 'deposits_count', label: 'Deposit count' },
  { key: 'first_time_deposits', label: 'First-time depositors (count)' },
  { key: 'first_time_deposits_sum', label: 'First-time deposits (BDT)' },
  { key: 'withdrawals', label: 'Approved withdrawals (BDT)' },
  { key: 'withdrawals_count', label: 'Withdrawal count' },
  { key: 'signups', label: 'New signups' },
  { key: 'active_users', label: 'Active users (logins)' },
  { key: 'total_wagers', label: 'Total wagers (BDT)' },
  { key: 'ggr', label: 'GGR (wagers - wins)' },
  { key: 'bonus_payout', label: 'Bonus released' },
  { key: 'cashback_paid', label: 'Cashback paid' },
  { key: 'commission_paid', label: 'Commission paid' },
  { key: 'lotto_payout', label: 'Lotto winnings credited' },
  { key: 'net_cash', label: 'Net cash (dep - wd)' },
  { key: 'operating_result', label: 'Operating result' },
];

const BREAKDOWNS = [
  { key: 'deposit_by_method', label: 'Deposits by method' },
  { key: 'withdrawal_by_method', label: 'Withdrawals by method' },
  { key: 'bonus_by_type', label: 'Bonuses by rule type' },
  { key: 'commission_by_level', label: 'Affiliate commissions by level' },
  { key: 'lotto_by_tier', label: 'Lotto winnings by tier' },
];

const PIE_COLORS = ['#FFCC00', '#10B981', '#3B82F6', '#EF4444', '#A855F7', '#F97316', '#06B6D4', '#EC4899'];

function localISO(d: Date): string {
  // Format for <input type="datetime-local" /> (no seconds, no Z).
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function defaultFrom(days = 30): string {
  return localISO(new Date(Date.now() - days * 86_400_000));
}
function defaultTo(): string {
  return localISO(new Date());
}

function fmtBucket(b: string, g: string): string {
  const d = new Date(b);
  if (g === 'month') return d.toLocaleString(undefined, { month: 'short', year: '2-digit' });
  if (g === 'week') return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export default function AdminReportsPage() {
  const [tab, setTab] = useState<'overview' | 'timeseries' | 'cohorts' | 'breakdowns'>('overview');

  // Overview
  const [overview, setOverview] = useState<Overview | null>(null);
  const [overviewBusy, setOverviewBusy] = useState(false);
  const [overviewError, setOverviewError] = useState<string | null>(null);

  // 30-day chart on overview tab (deposits + withdrawals + net)
  const [overviewSeries, setOverviewSeries] = useState<{ bucket: string; deposits: number; withdrawals: number; net: number }[]>([]);

  // Business snapshot - the comprehensive KPI bundle for the picked range
  const [snapFrom, setSnapFrom] = useState<string>(defaultFrom(30));
  const [snapTo, setSnapTo] = useState<string>(defaultTo());
  const [snap, setSnap] = useState<BusinessSnapshot | null>(null);
  const [snapBusy, setSnapBusy] = useState(false);

  // Time-series tab
  const [tsMetric, setTsMetric] = useState<string>('deposits');
  const [tsGranularity, setTsGranularity] = useState<'day' | 'week' | 'month'>('day');
  const [tsFrom, setTsFrom] = useState<string>(defaultFrom(30));
  const [tsTo, setTsTo] = useState<string>(defaultTo());
  const [tsData, setTsData] = useState<TsResponse | null>(null);
  const [tsBusy, setTsBusy] = useState(false);

  // Cohorts tab
  const [cohortGranularity, setCohortGranularity] = useState<'day' | 'week' | 'month'>('week');
  const [cohortFrom, setCohortFrom] = useState<string>(defaultFrom(90));
  const [cohortTo, setCohortTo] = useState<string>(defaultTo());
  const [cohortData, setCohortData] = useState<CohortsResponse | null>(null);
  const [cohortBusy, setCohortBusy] = useState(false);

  // Breakdown tab
  const [bdKind, setBdKind] = useState<string>('deposit_by_method');
  const [bdFrom, setBdFrom] = useState<string>(defaultFrom(30));
  const [bdTo, setBdTo] = useState<string>(defaultTo());
  const [bdData, setBdData] = useState<BreakdownResponse | null>(null);
  const [bdBusy, setBdBusy] = useState(false);

  // Overview loaders
  const loadOverview = useCallback(async () => {
    setOverviewBusy(true);
    setOverviewError(null);
    try {
      const res = await fetch('/api/admin/overview', { cache: 'no-store' });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.message ?? body?.code ?? 'Failed');
      setOverview(body as Overview);

      const from = new Date(Date.now() - 30 * 86_400_000).toISOString();
      const to = new Date().toISOString();
      const [dRes, wRes] = await Promise.all([
        fetch(`/api/admin/reports/timeseries?metric=deposits&granularity=day&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`, { cache: 'no-store' }),
        fetch(`/api/admin/reports/timeseries?metric=withdrawals&granularity=day&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`, { cache: 'no-store' }),
      ]);
      if (dRes.ok && wRes.ok) {
        const dData = await dRes.json() as TsResponse;
        const wData = await wRes.json() as TsResponse;
        const map = new Map<string, { deposits: number; withdrawals: number }>();
        for (const b of dData.buckets) map.set(b.bucket, { deposits: b.value, withdrawals: 0 });
        for (const b of wData.buckets) {
          const cur = map.get(b.bucket) ?? { deposits: 0, withdrawals: 0 };
          cur.withdrawals = b.value;
          map.set(b.bucket, cur);
        }
        const out = Array.from(map.entries())
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([bucket, v]) => ({ bucket, deposits: v.deposits, withdrawals: v.withdrawals, net: v.deposits - v.withdrawals }));
        setOverviewSeries(out);
      }
    } catch (e) {
      setOverviewError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setOverviewBusy(false);
    }
  }, []);

  const loadTs = useCallback(async () => {
    setTsBusy(true);
    try {
      const params = new URLSearchParams({
        metric: tsMetric,
        granularity: tsGranularity,
        from: new Date(tsFrom).toISOString(),
        to: new Date(tsTo).toISOString(),
      });
      const res = await fetch(`/api/admin/reports/timeseries?${params.toString()}`, { cache: 'no-store' });
      const body = await res.json();
      if (res.ok) setTsData(body as TsResponse);
    } finally { setTsBusy(false); }
  }, [tsMetric, tsGranularity, tsFrom, tsTo]);

  const loadCohorts = useCallback(async () => {
    setCohortBusy(true);
    try {
      const params = new URLSearchParams({
        granularity: cohortGranularity,
        from: new Date(cohortFrom).toISOString(),
        to: new Date(cohortTo).toISOString(),
      });
      const res = await fetch(`/api/admin/reports/cohorts?${params.toString()}`, { cache: 'no-store' });
      const body = await res.json();
      if (res.ok) setCohortData(body as CohortsResponse);
    } finally { setCohortBusy(false); }
  }, [cohortGranularity, cohortFrom, cohortTo]);

  const loadBreakdown = useCallback(async () => {
    setBdBusy(true);
    try {
      const params = new URLSearchParams({
        kind: bdKind,
        from: new Date(bdFrom).toISOString(),
        to: new Date(bdTo).toISOString(),
      });
      const res = await fetch(`/api/admin/reports/breakdown?${params.toString()}`, { cache: 'no-store' });
      const body = await res.json();
      if (res.ok) setBdData(body as BreakdownResponse);
    } finally { setBdBusy(false); }
  }, [bdKind, bdFrom, bdTo]);

  const loadSnap = useCallback(async () => {
    setSnapBusy(true);
    try {
      const params = new URLSearchParams({
        from: new Date(snapFrom).toISOString(),
        to: new Date(snapTo).toISOString(),
      });
      const res = await fetch(`/api/admin/reports/business-snapshot?${params.toString()}`, { cache: 'no-store' });
      if (res.ok) setSnap(await res.json() as BusinessSnapshot);
    } finally { setSnapBusy(false); }
  }, [snapFrom, snapTo]);

  useEffect(() => { loadOverview(); }, [loadOverview]);
  useEffect(() => { if (tab === 'overview') loadSnap(); }, [tab, loadSnap]);
  useEffect(() => { if (tab === 'timeseries') loadTs(); }, [tab, loadTs]);
  useEffect(() => { if (tab === 'cohorts') loadCohorts(); }, [tab, loadCohorts]);
  useEffect(() => { if (tab === 'breakdowns') loadBreakdown(); }, [tab, loadBreakdown]);

  const k = overview?.kpis;
  const netLifetime = k ? k.approvedDepositsTotal - k.approvedWithdrawalsTotal : 0;

  const tsChartData = useMemo(() => {
    if (!tsData) return [];
    return tsData.buckets.map((b) => ({ ...b, label: fmtBucket(b.bucket, tsData.granularity) }));
  }, [tsData]);

  const overviewChartData = useMemo(() => overviewSeries.map((b) => ({ ...b, label: fmtBucket(b.bucket, 'day') })), [overviewSeries]);

  const bdChartData = useMemo(() => {
    if (!bdData) return [];
    return bdData.rows.map((r) => ({ name: r.key, value: r.value, count: r.count }));
  }, [bdData]);

  const downloadCsv = (params: URLSearchParams) => {
    const url = `/api/admin/reports/export?${params.toString()}`;
    window.location.href = url;
  };

  return (
    <>
      <PageHeader
        title="Reports & Analytics"
        subtitle="Live DB data: time-series, signup cohorts, breakdowns, CSV exports"
        icon={<BarChart3 className="h-5 w-5" />}
        action={
          <Button variant="ghost" leftIcon={<RefreshCw className={cn('h-3.5 w-3.5', (overviewBusy || tsBusy || cohortBusy || bdBusy) && 'animate-spin')} />}
            onClick={() => {
              loadOverview();
              if (tab === 'timeseries') loadTs();
              if (tab === 'cohorts') loadCohorts();
              if (tab === 'breakdowns') loadBreakdown();
            }}>
            Refresh
          </Button>
        }
      />

      {overviewError ? <Card padding="md" className="mb-4"><p className="text-sm text-signal-danger">{overviewError}</p></Card> : null}

      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
        <TabsList>
          <TabsTrigger value="overview"><Activity className="mr-1.5 h-3.5 w-3.5" /> Overview</TabsTrigger>
          <TabsTrigger value="timeseries"><TrendingUp className="mr-1.5 h-3.5 w-3.5" /> Time-series</TabsTrigger>
          <TabsTrigger value="cohorts"><Users className="mr-1.5 h-3.5 w-3.5" /> Cohorts</TabsTrigger>
          <TabsTrigger value="breakdowns"><PieIcon className="mr-1.5 h-3.5 w-3.5" /> Breakdowns</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          {/* Business snapshot - range-aware KPI grid. The lifetime
              cards below stay all-time. */}
          <Card padding="md" className="mb-4">
            <div className="flex flex-wrap items-end gap-3">
              <FormField label="From">
                <Input type="datetime-local" value={snapFrom} onChange={(e) => setSnapFrom(e.target.value)} />
              </FormField>
              <FormField label="To">
                <Input type="datetime-local" value={snapTo} onChange={(e) => setSnapTo(e.target.value)} />
              </FormField>
              <Button onClick={() => loadSnap()} loading={snapBusy} leftIcon={<Calendar className="h-3.5 w-3.5" />}>Apply</Button>
              <Button variant="ghost" onClick={() => { setSnapFrom(defaultFrom(1)); setSnapTo(defaultTo()); setTimeout(loadSnap, 0); }}>Today</Button>
              <Button variant="ghost" onClick={() => { setSnapFrom(defaultFrom(7)); setSnapTo(defaultTo()); setTimeout(loadSnap, 0); }}>7 days</Button>
              <Button variant="ghost" onClick={() => { setSnapFrom(defaultFrom(30)); setSnapTo(defaultTo()); setTimeout(loadSnap, 0); }}>30 days</Button>
              <Button variant="ghost" onClick={() => { setSnapFrom(defaultFrom(90)); setSnapTo(defaultTo()); setTimeout(loadSnap, 0); }}>90 days</Button>
            </div>
          </Card>

          {snap ? (
            <>
              <h2 className="mb-2 text-xs font-bold uppercase tracking-wider text-ink-mid">Acquisition</h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <StatTile label="Total Registrations" value={snap.totalRegistrations.toLocaleString()} icon={<Users className="h-5 w-5 text-neon" />} />
                <StatTile label="First-time Depositors" value={snap.firstTimeDepositors.toLocaleString()} icon={<Users className="h-5 w-5 text-neon" />} hint={formatBDT(snap.firstTimeDepositSum, { compact: true })} />
                <StatTile label="Depositing Users" value={snap.depositingUsers.toLocaleString()} icon={<Users className="h-5 w-5 text-neon" />} hint="distinct in range" />
                <StatTile label="Active Players" value={snap.activePlayers.toLocaleString()} icon={<Activity className="h-5 w-5 text-neon" />} hint="placed a bet" />
              </div>

              <h2 className="mb-2 mt-5 text-xs font-bold uppercase tracking-wider text-ink-mid">Money in / out</h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <StatTile label="Approved Deposits" value={formatBDT(snap.approvedDepositSum, { compact: true })} icon={<TrendingUp className="h-5 w-5 text-gold-300" />} hint={`${snap.approvedDepositCount} txns . avg ${formatBDT(snap.avgDeposit, { compact: true })}`} />
                <StatTile label="Approved Withdrawals" value={formatBDT(snap.approvedWithdrawalSum, { compact: true })} icon={<TrendingUp className="h-5 w-5 text-signal-danger" />} hint={`${snap.approvedWithdrawalCount} txns . avg ${formatBDT(snap.avgWithdrawal, { compact: true })}`} />
                <StatTile label="Net Cash (dep - wd)" value={formatBDT(snap.netCash, { compact: true })} icon={<Wallet className="h-5 w-5 text-neon" />} accent="mixed" />
                <StatTile label="Pending Queue" value={`${snap.pendingDepositCount}d / ${snap.pendingWithdrawalCount}w`} icon={<RefreshCw className="h-5 w-5 text-neon" />} hint={`${formatBDT(snap.pendingDepositSum, { compact: true })} / ${formatBDT(snap.pendingWithdrawalSum, { compact: true })}`} />
              </div>

              <h2 className="mb-2 mt-5 text-xs font-bold uppercase tracking-wider text-ink-mid">Gaming</h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <StatTile label="Total Wagered" value={formatBDT(snap.totalWagered, { compact: true })} icon={<Activity className="h-5 w-5 text-neon" />} hint={`${snap.betCount.toLocaleString()} bets`} />
                <StatTile label="Total Won (players)" value={formatBDT(snap.totalWon, { compact: true })} icon={<Activity className="h-5 w-5 text-signal-danger" />} />
                <StatTile label="Gross Gaming Revenue" value={formatBDT(snap.grossGamingRevenue, { compact: true })} icon={<TrendingUp className="h-5 w-5 text-gold-300" />} hint="wagers - wins" accent="mixed" />
                <StatTile label="Revenue / Active Player" value={formatBDT(snap.avgRevenuePerActivePlayer, { compact: true })} icon={<Wallet className="h-5 w-5 text-neon" />} />
              </div>

              <h2 className="mb-2 mt-5 text-xs font-bold uppercase tracking-wider text-ink-mid">Costs &amp; net result</h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <StatTile label="Bonus Granted" value={formatBDT(snap.bonusGranted, { compact: true })} icon={<Wallet className="h-5 w-5 text-signal-danger" />} />
                <StatTile label="Cashback Paid" value={formatBDT(snap.cashbackPaid, { compact: true })} icon={<Wallet className="h-5 w-5 text-signal-danger" />} />
                <StatTile label="Affiliate Commission" value={formatBDT(snap.affiliateCommissionPaid, { compact: true })} icon={<Wallet className="h-5 w-5 text-signal-danger" />} />
                <StatTile label="Operating Result" value={formatBDT(snap.operatingResult, { compact: true })} icon={<TrendingUp className="h-5 w-5 text-gold-300" />} hint="net - bonus - cashback - commission" accent="mixed" />
              </div>
            </>
          ) : <p className="text-sm text-ink-mid">Loading business snapshot...</p>}

          <h2 className="mb-2 mt-6 text-xs font-bold uppercase tracking-wider text-ink-mid">Lifetime totals</h2>
          {!k ? <p className="text-sm text-ink-mid">Loading...</p> : (
            <>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <StatTile label="Total Users" value={k.totalUsers.toLocaleString()} icon={<Users className="h-5 w-5 text-neon" />} hint={`+${k.newUsersToday} today`} />
                <StatTile label="Active Users (7d)" value={k.activeUsersLast7.toLocaleString()} icon={<Users className="h-5 w-5 text-neon" />} />
                <StatTile label="Deposits Today" value={formatBDT(k.approvedDepositsToday, { compact: true })} icon={<TrendingUp className="h-5 w-5 text-gold-300" />} hint="approved" />
                <StatTile label="Net Flow (lifetime)" value={formatBDT(netLifetime, { compact: true })} icon={<Wallet className="h-5 w-5 text-neon" />} hint="deposits - withdrawals" accent="mixed" />
              </div>

              <Card padding="lg" className="mt-6">
                <CardHeader title="Last 30 days . cash flow" subtitle="Daily approved deposits vs withdrawals, with net." />
                <div className="h-72 w-full">
                  <ResponsiveContainer>
                    <LineChart data={overviewChartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                      <XAxis dataKey="label" stroke="#777" fontSize={11} />
                      <YAxis stroke="#777" fontSize={11} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                      <Tooltip formatter={(v: number) => formatBDT(Number(v))} contentStyle={{ background: '#0e1c14', border: '1px solid rgba(255,204,0,0.2)', borderRadius: 8 }} />
                      <Legend />
                      <Line type="monotone" dataKey="deposits" name="Deposits" stroke="#10B981" strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="withdrawals" name="Withdrawals" stroke="#EF4444" strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="net" name="Net" stroke="#FFCC00" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </Card>

              <div className="mt-6 grid gap-6 lg:grid-cols-2">
                <Card padding="lg">
                  <CardHeader title="Cash flow (lifetime, approved)" />
                  <dl className="space-y-2">
                    <Row label="Approved deposits" value={formatBDT(k.approvedDepositsTotal)} />
                    <Row label="Approved withdrawals" value={formatBDT(k.approvedWithdrawalsTotal)} />
                    <Row label="Pending deposits queued" value={`${k.pendingDepositsCount} . ${formatBDT(k.pendingDepositsAmount)}`} />
                    <Row label="Pending withdrawals queued" value={`${k.pendingWithdrawalsCount} . ${formatBDT(k.pendingWithdrawalsAmount)}`} />
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
                </Card>
              </div>
            </>
          )}
        </TabsContent>

        <TabsContent value="timeseries">
          <Card padding="md" className="mb-3">
            <div className="flex flex-wrap items-end gap-3">
              <FormField label="Metric">
                <Select value={tsMetric} onChange={(e) => setTsMetric(e.target.value)}>
                  {METRICS.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
                </Select>
              </FormField>
              <FormField label="Granularity">
                <Select value={tsGranularity} onChange={(e) => setTsGranularity(e.target.value as 'day' | 'week' | 'month')}>
                  <option value="day">Day</option>
                  <option value="week">Week</option>
                  <option value="month">Month</option>
                </Select>
              </FormField>
              <FormField label="From">
                <Input type="datetime-local" value={tsFrom} onChange={(e) => setTsFrom(e.target.value)} />
              </FormField>
              <FormField label="To">
                <Input type="datetime-local" value={tsTo} onChange={(e) => setTsTo(e.target.value)} />
              </FormField>
              <Button leftIcon={<RefreshCw className="h-3.5 w-3.5" />} loading={tsBusy} onClick={loadTs}>Apply</Button>
              <Button variant="ghost" leftIcon={<Download className="h-3.5 w-3.5" />} onClick={() => downloadCsv(new URLSearchParams({ type: 'timeseries', metric: tsMetric, granularity: tsGranularity, from: new Date(tsFrom).toISOString(), to: new Date(tsTo).toISOString() }))}>
                Export CSV
              </Button>
            </div>
          </Card>

          {!tsData ? <p className="text-sm text-ink-mid">Loading...</p> : (
            <Card padding="lg">
              <CardHeader title={tsData.label} subtitle={`${tsChartData.length} bucket(s) . total ${formatBDT(tsData.totals.value)} . count ${tsData.totals.count.toLocaleString()}`} />
              <div className="h-80 w-full">
                <ResponsiveContainer>
                  <LineChart data={tsChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                    <XAxis dataKey="label" stroke="#777" fontSize={11} />
                    <YAxis stroke="#777" fontSize={11} tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v)} />
                    <Tooltip formatter={(v: number) => formatBDT(Number(v))} contentStyle={{ background: '#0e1c14', border: '1px solid rgba(255,204,0,0.2)', borderRadius: 8 }} />
                    <Line type="monotone" dataKey="value" name={tsData.label} stroke="#FFCC00" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="cohorts">
          <Card padding="md" className="mb-3">
            <div className="flex flex-wrap items-end gap-3">
              <FormField label="Granularity">
                <Select value={cohortGranularity} onChange={(e) => setCohortGranularity(e.target.value as 'day' | 'week' | 'month')}>
                  <option value="day">Day</option>
                  <option value="week">Week</option>
                  <option value="month">Month</option>
                </Select>
              </FormField>
              <FormField label="From">
                <Input type="datetime-local" value={cohortFrom} onChange={(e) => setCohortFrom(e.target.value)} />
              </FormField>
              <FormField label="To">
                <Input type="datetime-local" value={cohortTo} onChange={(e) => setCohortTo(e.target.value)} />
              </FormField>
              <Button leftIcon={<RefreshCw className="h-3.5 w-3.5" />} loading={cohortBusy} onClick={loadCohorts}>Apply</Button>
              <Button variant="ghost" leftIcon={<Download className="h-3.5 w-3.5" />} onClick={() => downloadCsv(new URLSearchParams({ type: 'users', from: new Date(cohortFrom).toISOString(), to: new Date(cohortTo).toISOString() }))}>
                Export user CSV
              </Button>
            </div>
          </Card>

          {!cohortData ? <p className="text-sm text-ink-mid">Loading...</p> : cohortData.rows.length === 0 ? (
            <Card padding="lg"><p className="text-sm text-ink-mid">No signups in the selected range.</p></Card>
          ) : (
            <Card padding="md" className="overflow-x-auto">
              <CardHeader title="Signup cohorts" subtitle="Conversion = % of cohort with at least one approved deposit ever. ARPU = lifetime deposits / cohort size." />
              <table className="w-full min-w-[800px] text-sm">
                <thead className="text-xs uppercase tracking-wider text-ink-lo">
                  <tr>
                    <th className="px-2 py-2 text-left"><Calendar className="mr-1 inline h-3 w-3" /> Cohort</th>
                    <th className="px-2 py-2 text-right">Size</th>
                    <th className="px-2 py-2 text-right">Depositors</th>
                    <th className="px-2 py-2 text-right">Conversion %</th>
                    <th className="px-2 py-2 text-right">Total deposits</th>
                    <th className="px-2 py-2 text-right">ARPU</th>
                    <th className="px-2 py-2 text-right">Retained 7d</th>
                    <th className="px-2 py-2 text-right">Retained 30d</th>
                  </tr>
                </thead>
                <tbody>
                  {cohortData.rows.map((r) => (
                    <tr key={r.cohort} className="border-t border-neon/10">
                      <td className="px-2 py-2 font-semibold text-ink-hi">{fmtBucket(r.cohort, cohortData.granularity)}</td>
                      <td className="px-2 py-2 text-right">{r.size}</td>
                      <td className="px-2 py-2 text-right">{r.depositors}</td>
                      <td className="px-2 py-2 text-right font-mono">{r.conversionPct}%</td>
                      <td className="px-2 py-2 text-right font-mono">{formatBDT(r.totalDeposits)}</td>
                      <td className="px-2 py-2 text-right font-mono">{formatBDT(r.arpu)}</td>
                      <td className="px-2 py-2 text-right">{r.retained7d}</td>
                      <td className="px-2 py-2 text-right">{r.retained30d}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="breakdowns">
          <Card padding="md" className="mb-3">
            <div className="flex flex-wrap items-end gap-3">
              <FormField label="Dimension">
                <Select value={bdKind} onChange={(e) => setBdKind(e.target.value)}>
                  {BREAKDOWNS.map((b) => <option key={b.key} value={b.key}>{b.label}</option>)}
                </Select>
              </FormField>
              <FormField label="From">
                <Input type="datetime-local" value={bdFrom} onChange={(e) => setBdFrom(e.target.value)} />
              </FormField>
              <FormField label="To">
                <Input type="datetime-local" value={bdTo} onChange={(e) => setBdTo(e.target.value)} />
              </FormField>
              <Button leftIcon={<RefreshCw className="h-3.5 w-3.5" />} loading={bdBusy} onClick={loadBreakdown}>Apply</Button>
            </div>
          </Card>

          {!bdData ? <p className="text-sm text-ink-mid">Loading...</p> : bdData.rows.length === 0 ? (
            <Card padding="lg"><p className="text-sm text-ink-mid">No data in the selected range.</p></Card>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              <Card padding="lg">
                <CardHeader title="Distribution" subtitle={`Total ${formatBDT(bdData.total.value)} across ${bdData.total.count.toLocaleString()} rows`} />
                <div className="h-72 w-full">
                  <ResponsiveContainer>
                    <PieChart>
                      <Pie data={bdChartData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label={(entry) => entry.name}>
                        {bdChartData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                      </Pie>
                      <Tooltip formatter={(v: number) => formatBDT(Number(v))} contentStyle={{ background: '#0e1c14', border: '1px solid rgba(255,204,0,0.2)', borderRadius: 8 }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </Card>
              <Card padding="lg">
                <CardHeader title="Rankings" />
                <div className="h-72 w-full">
                  <ResponsiveContainer>
                    <BarChart data={bdChartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                      <XAxis dataKey="name" stroke="#777" fontSize={11} />
                      <YAxis stroke="#777" fontSize={11} tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v)} />
                      <Tooltip formatter={(v: number) => formatBDT(Number(v))} contentStyle={{ background: '#0e1c14', border: '1px solid rgba(255,204,0,0.2)', borderRadius: 8 }} />
                      <Bar dataKey="value" name="Value" fill="#FFCC00" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            </div>
          )}

          <Card padding="md" className="mt-4">
            <CardHeader title="CSV exports" subtitle="Each export uses the From/To picked above where applicable." />
            <div className="flex flex-wrap gap-2">
              <Button variant="ghost" leftIcon={<Download className="h-3.5 w-3.5" />} onClick={() => downloadCsv(new URLSearchParams({ type: 'deposits', from: new Date(bdFrom).toISOString(), to: new Date(bdTo).toISOString() }))}>
                Deposits
              </Button>
              <Button variant="ghost" leftIcon={<Download className="h-3.5 w-3.5" />} onClick={() => downloadCsv(new URLSearchParams({ type: 'withdrawals', from: new Date(bdFrom).toISOString(), to: new Date(bdTo).toISOString() }))}>
                Withdrawals
              </Button>
              <Button variant="ghost" leftIcon={<Download className="h-3.5 w-3.5" />} onClick={() => downloadCsv(new URLSearchParams({ type: 'users', from: new Date(bdFrom).toISOString(), to: new Date(bdTo).toISOString() }))}>
                Users
              </Button>
              <Button variant="ghost" leftIcon={<Download className="h-3.5 w-3.5" />} onClick={() => downloadCsv(new URLSearchParams({ type: 'commissions', from: new Date(bdFrom).toISOString(), to: new Date(bdTo).toISOString() }))}>
                Commissions
              </Button>
              <Button variant="ghost" leftIcon={<Download className="h-3.5 w-3.5" />} onClick={() => downloadCsv(new URLSearchParams({ type: 'bonus_grants', from: new Date(bdFrom).toISOString(), to: new Date(bdTo).toISOString() }))}>
                Bonus grants
              </Button>
              <Button variant="ghost" leftIcon={<Download className="h-3.5 w-3.5" />} onClick={() => downloadCsv(new URLSearchParams({ type: 'recovery_attempts', from: new Date(bdFrom).toISOString(), to: new Date(bdTo).toISOString() }))}>
                Recovery attempts
              </Button>
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      <Card padding="md" className="mt-6">
        <p className="text-xs text-ink-mid">
          <Chip tone="info" className="mr-2">heads-up</Chip>
          All series read straight from live tables (Deposit, Withdrawal, User, UserBonus, AffiliateCommission, LotteryWinning) with no
          materialised aggregates - if your date range is huge and the dataset grows past a few hundred thousand rows, expect query
          latency to climb. Add a materialised view + cron refresh in a future pass if needed.
        </p>
      </Card>
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
