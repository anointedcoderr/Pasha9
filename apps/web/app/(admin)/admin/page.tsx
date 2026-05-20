'use client';

import { PageHeader } from '@/components/site/PageHeader';
import { StatTile } from '@/components/ui/StatTile';
import { Card, CardHeader } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { mockAdminStats } from '@/lib/mock/adminStats';
import { mockDeposits, mockWithdrawals } from '@/lib/mock/deposits';
import { mockActivity } from '@/lib/mock/activity';
import { formatBDT, formatDateTime, relativeTime } from '@/lib/utils/format';
import { useT, useLang } from '@/lib/i18n/context';
import { LayoutDashboard, Users, UsersRound, ArrowDownToLine, Clock, ArrowUpToLine, Gift, Network, Wallet } from 'lucide-react';
import { RevenueChart } from '@/components/admin/RevenueChart';
import Link from 'next/link';
import { ROUTES } from '@/lib/constants/routes';

export default function AdminOverview() {
  const t = useT();
  const { lang } = useLang();
  const s = mockAdminStats;
  const pendingDeposits = mockDeposits.filter((d) => d.status === 'pending');
  const pendingWithdrawals = mockWithdrawals.filter((w) => w.status === 'pending');

  return (
    <>
      <PageHeader title={t('admin.overview')} subtitle="Operational health, daily flow, pending queue" icon={<LayoutDashboard className="h-5 w-5" />} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label={t('admin.totalUsers')} value={s.totalUsers.toLocaleString()} icon={<Users className="h-5 w-5 text-neon" />} />
        <StatTile label={t('admin.activeUsers')} value={s.activeUsers.toLocaleString()} icon={<UsersRound className="h-5 w-5 text-neon" />} hint="Last 7 days" />
        <StatTile label={t('admin.totalDeposits')} value={formatBDT(s.totalDeposits, { compact: true })} icon={<ArrowDownToLine className="h-5 w-5 text-gold-300" />} accent="gold" />
        <StatTile label={t('admin.pendingWithdrawals')} value={formatBDT(s.pendingWithdrawals, { compact: true })} icon={<Clock className="h-5 w-5 text-gold-300" />} hint={`${pendingWithdrawals.length} queued`} />
        <StatTile label={t('admin.totalWithdrawals')} value={formatBDT(s.totalWithdrawals, { compact: true })} icon={<ArrowUpToLine className="h-5 w-5 text-gold-300" />} />
        <StatTile label={t('admin.bonusIssued')} value={formatBDT(s.bonusIssued, { compact: true })} icon={<Gift className="h-5 w-5 text-gold-300" />} />
        <StatTile label={t('admin.referralSignups')} value={s.referralSignups.toLocaleString()} icon={<Network className="h-5 w-5 text-neon" />} />
        <StatTile label={t('admin.netBalance')} value={formatBDT(s.netBalance, { compact: true })} icon={<Wallet className="h-5 w-5 text-neon" />} accent="mixed" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card padding="lg" className="lg:col-span-2">
          <CardHeader
            title="Deposit vs Withdrawal flow"
            subtitle="Last 30 days, totals in BDT"
            action={
              <div className="flex items-center gap-3 text-xs text-ink-lo">
                <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-gold-300" />Deposit</span>
                <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-neon" />Withdraw</span>
              </div>
            }
          />
          <RevenueChart />
        </Card>

        <Card padding="lg">
          <CardHeader title="Pending queue" subtitle="Items waiting for approval" action={<Link href={ROUTES.admin.deposits} className="text-xs text-neon hover:text-ink-hi">View all</Link>} />
          <ul className="space-y-3">
            {[...pendingDeposits.slice(0, 3).map((d) => ({ ...d, _type: 'deposit' as const })), ...pendingWithdrawals.slice(0, 3).map((w) => ({ ...w, _type: 'withdraw' as const }))].map((item) => (
              <li key={item._type + item.id} className="flex items-center justify-between gap-3 rounded-xl border border-neon/10 bg-base-deep/40 p-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-ink-hi">{item.username}</p>
                  <p className="text-xs text-ink-lo">{item._type === 'deposit' ? 'Deposit' : 'Withdraw'} · {relativeTime(item.createdAt, lang)}</p>
                </div>
                <span className={item._type === 'deposit' ? 'text-sm font-semibold text-neon' : 'text-sm font-semibold text-gold-300'}>{formatBDT(item.amount)}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card padding="lg" className="mt-6">
        <CardHeader title="Recent admin activity" subtitle="Audit trail of admin actions" action={<Link href={ROUTES.admin.activity} className="text-xs text-neon hover:text-ink-hi">View log</Link>} />
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-neon/10 bg-base-deep/40 text-xs uppercase tracking-wider text-ink-lo">
                <th className="px-4 py-3 text-left">Actor</th>
                <th className="px-4 py-3 text-left">Action</th>
                <th className="px-4 py-3 text-left">Target</th>
                <th className="px-4 py-3 text-left">Detail</th>
                <th className="px-4 py-3 text-left">When</th>
              </tr>
            </thead>
            <tbody>
              {mockActivity.slice(0, 6).map((a) => (
                <tr key={a.id} className="table-row">
                  <td className="px-4 py-3 text-ink-hi">{a.actor}</td>
                  <td className="px-4 py-3"><Chip tone={a.actorRole === 'system' ? 'info' : a.action.includes('REJECT') || a.action.includes('BLOCK') ? 'danger' : 'ok'}>{a.action}</Chip></td>
                  <td className="px-4 py-3 font-mono text-xs text-ink-lo">{a.target}</td>
                  <td className="px-4 py-3 text-ink-mid">{a.detail}</td>
                  <td className="px-4 py-3 text-ink-lo">{formatDateTime(a.createdAt, lang)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
