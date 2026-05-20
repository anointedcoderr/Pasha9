'use client';

import Link from 'next/link';
import { PageHeader } from '@/components/site/PageHeader';
import { currentUser } from '@/lib/mock/users';
import { userTransactions } from '@/lib/mock/transactions';
import { useT, useLang } from '@/lib/i18n/context';
import { formatBDT, formatDateTime } from '@/lib/utils/format';
import { Wallet, ArrowDownToLine, ArrowUpToLine, Lock, Sparkles } from 'lucide-react';
import { ROUTES } from '@/lib/constants/routes';
import { Chip } from '@/components/ui/Chip';

export default function WalletPage() {
  const t = useT();
  const { lang } = useLang();
  const txs = userTransactions(currentUser.id).slice(0, 8);

  return (
    <>
      <PageHeader title={t('wallet.title')} subtitle="Balance, bonus, locked funds, recent activity" icon={<Wallet className="h-5 w-5" />} />

      <div className="grid gap-4 md:grid-cols-3">
        <BalanceTile icon={<Wallet className="h-5 w-5" />} label={t('wallet.available')} value={formatBDT(currentUser.balance)} accent="gold" />
        <BalanceTile icon={<Sparkles className="h-5 w-5" />} label={t('wallet.bonus')} value={formatBDT(currentUser.bonusBalance)} accent="neon" />
        <BalanceTile icon={<Lock className="h-5 w-5" />} label={t('wallet.locked')} value={formatBDT(currentUser.lockedBalance)} accent="cool" />
      </div>

      <div className="mt-6 grid gap-3 md:grid-cols-2">
        <Link href={ROUTES.deposit} className="card-glow flex items-center justify-between p-5 transition hover:-translate-y-0.5">
          <div>
            <p className="text-xs uppercase tracking-wider text-gold-300">{t('wallet.deposit')}</p>
            <p className="mt-1 text-lg font-semibold text-ink-hi">Top up wallet</p>
          </div>
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-grad-gold text-base-deep">
            <ArrowDownToLine className="h-5 w-5" />
          </span>
        </Link>
        <Link href={ROUTES.withdraw} className="card-glow flex items-center justify-between p-5 transition hover:-translate-y-0.5">
          <div>
            <p className="text-xs uppercase tracking-wider text-gold-300">{t('wallet.withdraw')}</p>
            <p className="mt-1 text-lg font-semibold text-ink-hi">Request payout</p>
          </div>
          <span className="flex h-12 w-12 items-center justify-center rounded-xl border border-neon/30 bg-neon/10 text-neon">
            <ArrowUpToLine className="h-5 w-5" />
          </span>
        </Link>
      </div>

      <section className="card-glow mt-8 overflow-hidden p-0">
        <div className="flex items-center justify-between border-b border-neon/10 px-6 py-4">
          <h3 className="text-sm font-semibold text-ink-hi">{t('wallet.history')}</h3>
          <Link href={ROUTES.transactions} className="text-xs text-neon hover:text-ink-hi">View all</Link>
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
      </section>
    </>
  );
}

function BalanceTile({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: string; accent: 'gold' | 'neon' | 'cool' }) {
  const accentMap = {
    gold: 'from-gold-500/15 via-gold-700/8',
    neon: 'from-neon/15 via-neon/5',
    cool: 'from-signal-info/10 via-signal-info/5',
  } as const;
  return (
    <div className={`card-glow relative overflow-hidden bg-gradient-to-br ${accentMap[accent]} p-5`}>
      <div className="flex items-center justify-between">
        <p className="text-xs uppercase tracking-wider text-ink-lo">{label}</p>
        <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-neon/15 bg-base-panel/60 text-neon">{icon}</span>
      </div>
      <p className="mt-3 text-2xl font-extrabold text-gradient-gold tabular-nums">{value}</p>
    </div>
  );
}
