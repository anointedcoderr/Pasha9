'use client';

import { PageHeader } from '@/components/site/PageHeader';
import { StatTile } from '@/components/ui/StatTile';
import { Card, CardHeader } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { useT, useLang } from '@/lib/i18n/context';
import { Wallet, Sparkles, Lock } from 'lucide-react';
import { useMe, walletBalance, walletBonus, walletLocked } from '@/lib/hooks/useMe';
import { userTransactions } from '@/lib/mock/transactions';
import { formatBDT, formatDateTime } from '@/lib/utils/format';

export default function DashboardWalletPage() {
  const t = useT();
  const { lang } = useLang();
  const { me } = useMe();
  // Transaction history list is M2A-stub. The /Transaction/ ledger
  // already exists in the DB; the public read endpoint ships in M2B.
  const txs = userTransactions(me?.id ?? 'u_demo').slice(0, 10);

  return (
    <>
      <PageHeader title={t('wallet.title')} subtitle="Wallet balances and recent activity" icon={<Wallet className="h-5 w-5" />} />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatTile label={t('wallet.available')} value={formatBDT(walletBalance(me))} icon={<Wallet className="h-5 w-5 text-neon" />} accent="gold" />
        <StatTile label={t('wallet.bonus')} value={formatBDT(walletBonus(me))} icon={<Sparkles className="h-5 w-5 text-gold-300" />} />
        <StatTile label={t('wallet.locked')} value={formatBDT(walletLocked(me))} icon={<Lock className="h-5 w-5 text-gold-300" />} />
      </div>

      <Card className="mt-6 p-0" padding="none">
        <div className="border-b border-neon/10 px-6 py-4">
          <CardHeader title={t('wallet.history')} />
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-neon/10 bg-base-deep/40 text-xs uppercase tracking-wider text-ink-lo">
                <th className="px-6 py-3 text-left">Type</th>
                <th className="px-6 py-3 text-left">Amount</th>
                <th className="px-6 py-3 text-left">Reference</th>
                <th className="px-6 py-3 text-left">Date</th>
                <th className="px-6 py-3 text-left">Status</th>
              </tr>
            </thead>
            <tbody>
              {txs.map((tx) => (
                <tr key={tx.id} className="table-row">
                  <td className="px-6 py-3 capitalize text-ink-hi">{tx.type}</td>
                  <td className={`px-6 py-3 tabular-nums ${tx.amount > 0 ? 'text-neon' : 'text-signal-danger'}`}>{formatBDT(tx.amount, { sign: true })}</td>
                  <td className="px-6 py-3 font-mono text-xs text-ink-lo">{tx.reference}</td>
                  <td className="px-6 py-3 text-ink-lo">{formatDateTime(tx.createdAt, lang)}</td>
                  <td className="px-6 py-3"><Chip tone={tx.status === 'completed' ? 'ok' : tx.status === 'pending' ? 'warn' : 'danger'}>{tx.status}</Chip></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
