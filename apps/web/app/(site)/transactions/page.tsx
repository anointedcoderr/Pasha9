'use client';

import { useState } from 'react';
import { PageHeader } from '@/components/site/PageHeader';
import { userTransactions } from '@/lib/mock/transactions';
import { currentUser } from '@/lib/mock/users';
import { formatBDT, formatDateTime } from '@/lib/utils/format';
import { useT, useLang } from '@/lib/i18n/context';
import { Chip } from '@/components/ui/Chip';
import { ReceiptText } from 'lucide-react';
import { Select } from '@/components/ui/Select';

const TYPES = ['all', 'deposit', 'withdraw', 'bonus', 'referral', 'bet', 'win', 'adjust'] as const;

export default function TransactionsPage() {
  const t = useT();
  const { lang } = useLang();
  const [type, setType] = useState<(typeof TYPES)[number]>('all');
  const all = userTransactions(currentUser.id);
  const filtered = type === 'all' ? all : all.filter((tx) => tx.type === type);

  return (
    <>
      <PageHeader title={t('wallet.history')} subtitle={`${all.length} entries`} icon={<ReceiptText className="h-5 w-5" />} />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="w-44">
          <Select value={type} onChange={(e) => setType(e.target.value as (typeof TYPES)[number])}>
            {TYPES.map((tp) => (
              <option key={tp} value={tp}>{tp}</option>
            ))}
          </Select>
        </div>
        <p className="text-xs text-ink-lo">{filtered.length} matching</p>
      </div>

      <section className="card-glow overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-neon/10 bg-base-deep/40 text-xs uppercase tracking-wider text-ink-lo">
                <th className="px-6 py-3 text-left">Type</th>
                <th className="px-6 py-3 text-left">{t('common.amount')}</th>
                <th className="px-6 py-3 text-left">Reference</th>
                <th className="px-6 py-3 text-left">{t('common.date')}</th>
                <th className="px-6 py-3 text-left">{t('common.status')}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((tx) => (
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
