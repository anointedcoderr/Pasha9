// Built by Anointed Coder.
'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { PageHeader } from '@/components/site/PageHeader';
import { StatTile } from '@/components/ui/StatTile';
import { Card, CardHeader } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { Button } from '@/components/ui/Button';
import { formatBDT, formatDateTime, relativeTime } from '@/lib/utils/format';
import { useLang } from '@/lib/i18n/context';
import {
  LayoutDashboard,
  Users,
  UsersRound,
  ArrowDownToLine,
  Clock,
  ArrowUpToLine,
  Ticket,
  Wallet,
  RefreshCw,
  Sparkles,
  Megaphone,
  ShieldCheck,
  Settings,
} from 'lucide-react';
import { ROUTES } from '@/lib/constants/routes';
import { cn } from '@/lib/utils/cn';

interface Overview {
  timestamp: string;
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
  pending: {
    deposits: { id: string; username: string; amount: number; method: string; createdAt: string }[];
    withdrawals: { id: string; username: string; amount: number; method: string; createdAt: string }[];
  };
  activity: { id: string; action: string; actorRole?: string | null; target?: string | null; detail?: string | null; createdAt: string }[];
}

export default function AdminOverview() {
  const { lang } = useLang();
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <>
      <PageHeader
        title="Control Center"
        subtitle="Live snapshot of the Pasha 9 platform"
        icon={<LayoutDashboard className="h-5 w-5" />}
        action={
          <Button variant="neon" leftIcon={<RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} />} onClick={load}>
            Refresh
          </Button>
        }
      />

      {error ? (
        <Card padding="md" className="mb-4"><p className="text-sm text-signal-danger">{error}</p></Card>
      ) : null}

      {loading || !data ? (
        <Card padding="lg">Loading...</Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatTile label="Total Users" value={data.kpis.totalUsers.toLocaleString()} icon={<Users className="h-5 w-5 text-neon" />} hint={`${data.kpis.newUsersToday} new today`} />
            <StatTile label="Active Last 7d" value={data.kpis.activeUsersLast7.toLocaleString()} icon={<UsersRound className="h-5 w-5 text-neon" />} />
            <StatTile label="Deposits (approved)" value={formatBDT(data.kpis.approvedDepositsTotal, { compact: true })} icon={<ArrowDownToLine className="h-5 w-5 text-gold-300" />} hint={`${formatBDT(data.kpis.approvedDepositsToday, { compact: true })} today`} accent="gold" />
            <StatTile label="Withdrawals (approved)" value={formatBDT(data.kpis.approvedWithdrawalsTotal, { compact: true })} icon={<ArrowUpToLine className="h-5 w-5 text-gold-300" />} />
            <StatTile label="Pending Deposits" value={`${data.kpis.pendingDepositsCount}`} icon={<Clock className="h-5 w-5 text-signal-warn" />} hint={formatBDT(data.kpis.pendingDepositsAmount, { compact: true })} />
            <StatTile label="Pending Withdrawals" value={`${data.kpis.pendingWithdrawalsCount}`} icon={<Clock className="h-5 w-5 text-signal-warn" />} hint={formatBDT(data.kpis.pendingWithdrawalsAmount, { compact: true })} />
            <StatTile label="Platform Balance" value={formatBDT(data.kpis.platformBalance, { compact: true })} icon={<Wallet className="h-5 w-5 text-neon" />} accent="mixed" />
            <StatTile label="Lotto Balance Outstanding" value={formatBDT(data.kpis.lottoBalanceOutstanding, { compact: true })} icon={<Ticket className="h-5 w-5 text-gold-300" />} hint={`${data.kpis.lotteryTickets} tickets / ${data.kpis.lotteryWinnings} wins`} accent="gold" />
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-3">
            <Card padding="lg" className="lg:col-span-2">
              <CardHeader title="Pending queue" subtitle="Items waiting for admin review" action={<Link href={ROUTES.admin.deposits} className="text-xs text-neon hover:text-ink-hi">All deposits →</Link>} />
              {data.pending.deposits.length === 0 && data.pending.withdrawals.length === 0 ? (
                <p className="rounded-xl border border-neon/10 bg-base-deep/40 p-4 text-sm text-ink-mid">Nothing waiting. The queue is clear.</p>
              ) : (
                <ul className="space-y-2">
                  {data.pending.deposits.map((d) => (
                    <li key={`d-${d.id}`} className="flex items-center justify-between gap-3 rounded-xl border border-neon/10 bg-base-deep/40 p-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-ink-hi">{d.username}</p>
                        <p className="text-xs text-ink-lo">Deposit · {d.method} · {relativeTime(d.createdAt, lang)}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-semibold text-gold-300">{formatBDT(d.amount)}</span>
                        <Link href={ROUTES.admin.deposits} className="rounded-md bg-gold-500/15 px-2 py-1 text-xs font-semibold text-gold-300 hover:bg-gold-500/25">Review</Link>
                      </div>
                    </li>
                  ))}
                  {data.pending.withdrawals.map((w) => (
                    <li key={`w-${w.id}`} className="flex items-center justify-between gap-3 rounded-xl border border-neon/10 bg-base-deep/40 p-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-ink-hi">{w.username}</p>
                        <p className="text-xs text-ink-lo">Withdrawal · {w.method} · {relativeTime(w.createdAt, lang)}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-semibold text-signal-warn">{formatBDT(w.amount)}</span>
                        <Link href={ROUTES.admin.withdrawals} className="rounded-md bg-signal-warn/15 px-2 py-1 text-xs font-semibold text-signal-warn hover:bg-signal-warn/25">Review</Link>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card padding="lg">
              <CardHeader title="Shortcuts" subtitle="Jump to the common control surfaces" />
              <div className="grid grid-cols-2 gap-2">
                <Shortcut href="/admin/users" label="Users" icon={Users} />
                <Shortcut href="/admin/lotto" label="Lotto" icon={Ticket} />
                <Shortcut href="/admin/website" label="Website" icon={Megaphone} />
                <Shortcut href="/admin/reports" label="Reports" icon={Sparkles} />
                <Shortcut href="/admin/security" label="Security" icon={ShieldCheck} />
                <Shortcut href="/admin/settings" label="Settings" icon={Settings} />
              </div>
            </Card>
          </div>

          <Card padding="lg" className="mt-6">
            <CardHeader title="Recent activity" subtitle="Audit trail of recent admin and system actions" action={<Link href={ROUTES.admin.activity} className="text-xs text-neon hover:text-ink-hi">View full log →</Link>} />
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-neon/10 bg-base-deep/40 text-xs uppercase tracking-wider text-ink-lo">
                    <th className="px-4 py-3 text-left">When</th>
                    <th className="px-4 py-3 text-left">Role</th>
                    <th className="px-4 py-3 text-left">Action</th>
                    <th className="px-4 py-3 text-left">Target</th>
                    <th className="px-4 py-3 text-left">Detail</th>
                  </tr>
                </thead>
                <tbody>
                  {data.activity.length === 0 ? (
                    <tr><td colSpan={5} className="px-4 py-6 text-center text-sm text-ink-lo">No recorded activity yet.</td></tr>
                  ) : (
                    data.activity.map((a) => (
                      <tr key={a.id} className="table-row">
                        <td className="px-4 py-3 text-ink-lo">{formatDateTime(a.createdAt, lang)}</td>
                        <td className="px-4 py-3 text-ink-mid capitalize">{a.actorRole ?? 'system'}</td>
                        <td className="px-4 py-3"><Chip tone={a.action.includes('REJECT') || a.action.includes('BLOCK') ? 'danger' : a.action.includes('APPROVE') || a.action.includes('SETTLE') ? 'ok' : 'info'}>{a.action}</Chip></td>
                        <td className="px-4 py-3 font-mono text-xs text-ink-lo">{a.target ?? '-'}</td>
                        <td className="px-4 py-3 text-ink-mid">{a.detail ?? ''}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          <p className="mt-6 text-center text-[11px] text-ink-lo">Snapshot generated at {formatDateTime(data.timestamp, lang)}</p>
        </>
      )}
    </>
  );
}

function Shortcut({ href, label, icon: Icon }: { href: string; label: string; icon: React.ComponentType<{ className?: string }> }) {
  return (
    <Link href={href} className="flex items-center gap-2 rounded-xl border border-neon/10 bg-base-deep/40 px-3 py-2.5 text-sm font-semibold text-ink-hi transition hover:border-neon/30 hover:bg-base-panel">
      <Icon className="h-4 w-4 text-neon" />
      <span>{label}</span>
    </Link>
  );
}
