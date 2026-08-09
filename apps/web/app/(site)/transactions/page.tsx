// Built by Anointed Coder.
//
// /transactions and /dashboard/transactions both render this page.
//
// M2A shipped a mock-driven view as a placeholder. This now reads the
// canonical Transaction table for the signed-in user via
// /api/me/transactions. Pending withdrawal requests + rejected
// deposit / withdrawal records are merged on top by the endpoint so
// the in-flight state is visible without writing extra rows.

'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { PageHeader } from '@/components/site/PageHeader';
import { WalletAuditPanel } from '@/components/site/WalletAuditPanel';
import { formatBDT, formatDateTime } from '@/lib/utils/format';
import { useT, useLang } from '@/lib/i18n/context';
import { Chip } from '@/components/ui/Chip';
import { ReceiptText, RefreshCw, LogIn } from 'lucide-react';
import { Select } from '@/components/ui/Select';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import Link from 'next/link';

interface LedgerRow {
  id: string;
  type: 'deposit' | 'withdraw' | 'bonus' | 'referral' | 'bet' | 'win' | 'adjust';
  amount: number;
  status: 'pending' | 'completed' | 'failed';
  reference: string | null;
  description: string | null;
  createdAt: string;
}

const TYPES = ['all', 'deposit', 'withdraw', 'bonus', 'referral', 'bet', 'win', 'adjust'] as const;

function typeLabel(t: LedgerRow['type'], lang: 'en' | 'bn'): string {
  if (lang === 'bn') {
    const map: Record<LedgerRow['type'], string> = {
      deposit: 'ডিপোজিট', withdraw: 'উইথড্র', bonus: 'বোনাস',
      referral: 'রেফারেল', bet: 'বেট', win: 'উইন', adjust: 'অ্যাডজাস্ট',
    };
    return map[t];
  }
  return t;
}

function statusTone(s: LedgerRow['status']): 'ok' | 'warn' | 'danger' {
  if (s === 'completed') return 'ok';
  if (s === 'pending') return 'warn';
  return 'danger';
}

export default function TransactionsPage() {
  const t = useT();
  const { lang } = useLang();
  // 'history' is the existing Transaction view; 'audit' is the ledger view
  // with the balance either side of each movement.
  const [view, setView] = useState<'history' | 'audit'>('history');
  const [type, setType] = useState<(typeof TYPES)[number]>('all');
  const [rows, setRows] = useState<LedgerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [needsLogin, setNeedsLogin] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (filter: (typeof TYPES)[number]) => {
    setRefreshing(true);
    setError(null);
    try {
      const url = filter === 'all' ? '/api/me/transactions' : `/api/me/transactions?type=${filter}`;
      const r = await fetch(url, { cache: 'no-store', credentials: 'include' });
      if (r.status === 401) { setNeedsLogin(true); setRows([]); return; }
      const j = await r.json().catch(() => null);
      if (!r.ok) throw new Error(j?.message ?? j?.code ?? 'Failed to load');
      setNeedsLogin(false);
      setRows(Array.isArray(j?.transactions) ? (j.transactions as LedgerRow[]) : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(type); }, [load, type]);

  const totalIn = useMemo(() => rows.filter((r) => r.amount > 0 && r.status === 'completed').reduce((acc, r) => acc + r.amount, 0), [rows]);
  const totalOut = useMemo(() => rows.filter((r) => r.amount < 0 && r.status === 'completed').reduce((acc, r) => acc + r.amount, 0), [rows]);

  if (needsLogin) {
    return (
      <>
        <PageHeader title={t('wallet.history')} subtitle="Sign in to view your wallet activity" icon={<ReceiptText className="h-5 w-5" />} />
        <Card padding="lg" className="mx-auto max-w-md text-center">
          <p className="text-sm text-ink-mid">{lang === 'bn' ? 'আপনার ট্রানজ্যাকশন দেখতে লগইন করুন।' : 'Log in to see your transaction history.'}</p>
          <div className="mt-4">
            <Link href="/?login=1" className="btn-yellow inline-flex h-10 items-center rounded-lg px-4 text-sm">
              <LogIn className="mr-1.5 h-4 w-4" /> {lang === 'bn' ? 'লগইন' : 'Log in'}
            </Link>
          </div>
        </Card>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title={t('wallet.history')}
        subtitle={view === 'history'
          ? `${rows.length} ${lang === 'bn' ? 'এন্ট্রি' : 'entries'}`
          : (lang === 'bn' ? 'ব্যালেন্স আগে ও পরে সহ সম্পূর্ণ রেকর্ড' : 'Full record with balance before and after')}
        icon={<ReceiptText className="h-5 w-5" />}
      />

      {/*
        Two views over the same money. History keeps the in-flight items such
        as pending withdrawals; Wallet audit shows settled movements with the
        balance either side, read from the permanent ledger.
      */}
      <div role="tablist" aria-label={lang === 'bn' ? 'ভিউ' : 'View'} className="mb-4 flex gap-2">
        {(['history', 'audit'] as const).map((v) => (
          <button
            key={v}
            type="button"
            role="tab"
            aria-selected={view === v}
            onClick={() => setView(v)}
            className={`inline-flex h-10 items-center rounded-lg border px-4 text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue-500/40 ${
              view === v
                ? 'border-brand-yellow-600 bg-brand-yellow-500 font-semibold text-brand-ink'
                : 'border-brand-divider bg-brand-surface text-brand-inkMute hover:text-brand-ink'
            }`}
          >
            {v === 'history'
              ? (lang === 'bn' ? 'হিস্টরি' : 'History')
              : (lang === 'bn' ? 'ওয়ালেট অডিট' : 'Wallet audit')}
          </button>
        ))}
      </div>

      {view === 'audit' ? <WalletAuditPanel /> : (
      <>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="w-44">
          <Select value={type} onChange={(e) => setType(e.target.value as (typeof TYPES)[number])}>
            {TYPES.map((tp) => (
              <option key={tp} value={tp}>{tp === 'all' ? (lang === 'bn' ? 'সব' : 'All') : typeLabel(tp as LedgerRow['type'], lang)}</option>
            ))}
          </Select>
        </div>
        <Button size="sm" variant="ghost" leftIcon={<RefreshCw className="h-3.5 w-3.5" />} onClick={() => load(type)} loading={refreshing}>
          {lang === 'bn' ? 'রিফ্রেশ' : 'Refresh'}
        </Button>
        <div className="ml-auto flex flex-wrap items-center gap-3 text-xs text-ink-mid">
          <span><span className="text-ink-lo">{lang === 'bn' ? 'মোট ইন' : 'Total in'}:</span> <span className="font-semibold text-signal-ok">+{formatBDT(totalIn)}</span></span>
          <span><span className="text-ink-lo">{lang === 'bn' ? 'মোট আউট' : 'Total out'}:</span> <span className="font-semibold text-signal-danger">{formatBDT(totalOut)}</span></span>
        </div>
      </div>

      {error ? (
        <Card padding="md" className="mb-4">
          <p className="text-sm text-signal-danger">{error}</p>
        </Card>
      ) : null}

      {loading ? (
        <Card padding="lg"><p className="text-sm text-ink-mid">Loading...</p></Card>
      ) : rows.length === 0 ? (
        <Card padding="lg" className="text-center">
          <p className="text-sm text-ink-mid">
            {lang === 'bn' ? 'এখনো কোনো ট্রানজ্যাকশন নেই।' : 'No transactions yet.'}
          </p>
          <p className="mt-1 text-xs text-ink-lo">
            {lang === 'bn' ? 'একটি ডিপোজিট অনুমোদিত হওয়ার সাথে সাথে এখানে দেখা যাবে।' : 'Approved deposits, bonuses, bets, wins and withdrawals will appear here.'}
          </p>
        </Card>
      ) : (
        <section className="card-glow overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-neon/10 bg-base-deep/40 text-xs uppercase tracking-wider text-ink-lo">
                  <th className="px-6 py-3 text-left">{lang === 'bn' ? 'ধরন' : 'Type'}</th>
                  <th className="px-6 py-3 text-left">{lang === 'bn' ? 'বিবরণ' : 'Description'}</th>
                  <th className="px-6 py-3 text-left">{t('common.amount')}</th>
                  <th className="px-6 py-3 text-left">{lang === 'bn' ? 'রেফারেন্স' : 'Reference'}</th>
                  <th className="px-6 py-3 text-left">{t('common.date')}</th>
                  <th className="px-6 py-3 text-left">{t('common.status')}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((tx) => (
                  <tr key={tx.id} className="table-row">
                    <td className="px-6 py-3 capitalize text-ink-hi">{typeLabel(tx.type, lang)}</td>
                    <td className="px-6 py-3 text-ink-mid">{tx.description ?? '-'}</td>
                    <td className={`px-6 py-3 tabular-nums ${tx.amount > 0 ? 'text-signal-ok' : tx.amount < 0 ? 'text-signal-danger' : 'text-ink-lo'}`}>
                      {tx.amount === 0 ? '-' : formatBDT(tx.amount, { sign: true })}
                    </td>
                    <td className="px-6 py-3 font-mono text-xs text-ink-lo">{tx.reference ?? '-'}</td>
                    <td className="px-6 py-3 text-ink-lo">{formatDateTime(tx.createdAt, lang)}</td>
                    <td className="px-6 py-3"><Chip tone={statusTone(tx.status)}>{tx.status}</Chip></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
      </>
      )}
    </>
  );
}
