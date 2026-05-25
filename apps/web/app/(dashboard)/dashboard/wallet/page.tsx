'use client';

import { useState } from 'react';
import { PageHeader } from '@/components/site/PageHeader';
import { StatTile } from '@/components/ui/StatTile';
import { Card, CardHeader } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { FormField, Input } from '@/components/ui/Input';
import { useT, useLang } from '@/lib/i18n/context';
import { Wallet, Sparkles, Lock, Ticket, ArrowRightLeft } from 'lucide-react';
import { useMe, walletBalance, walletBonus, walletLocked, walletLotto, triggerWalletRefresh } from '@/lib/hooks/useMe';
import { userTransactions } from '@/lib/mock/transactions';
import { formatBDT, formatDateTime } from '@/lib/utils/format';

const MIN_TRANSFER = 100;

export default function DashboardWalletPage() {
  const t = useT();
  const { lang } = useLang();
  const { me, refresh } = useMe();
  // Transaction history list is M2A-stub. The /Transaction/ ledger
  // already exists in the DB; the public read endpoint ships in M2B.
  const txs = userTransactions(me?.id ?? 'u_demo').slice(0, 10);

  const lotto = walletLotto(me);
  const [transferOpen, setTransferOpen] = useState(false);
  const [amount, setAmount] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const submitTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch('/api/lotto/transfer', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ amount: Number(amount) }),
      });
      const data = await res.json();
      if (!res.ok) {
        const code = typeof data?.code === 'string' ? data.code : null;
        const message = typeof data?.message === 'string' ? data.message : null;
        if (code === 'BELOW_MIN') throw new Error(message ?? `Minimum transfer is ${MIN_TRANSFER} BDT.`);
        if (code === 'INSUFFICIENT_LOTTO_BALANCE') throw new Error(message ?? 'Lotto balance is lower than the requested amount.');
        if (code === 'WALLET_NOT_FOUND') throw new Error('Wallet not found. Make a deposit first.');
        throw new Error(message ?? code ?? 'Transfer failed');
      }
      setToast(lang === 'bn'
        ? `${formatBDT(Number(data.amount))} মেইন ব্যালেন্সে এসেছে।`
        : `${formatBDT(Number(data.amount))} moved to your main balance.`);
      setTimeout(() => setToast(null), 5000);
      setTransferOpen(false);
      setAmount(0);
      triggerWalletRefresh();
      refresh();
    } catch (e2) {
      setError(e2 instanceof Error ? e2.message : 'Transfer failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader title={t('wallet.title')} subtitle="Wallet balances and recent activity" icon={<Wallet className="h-5 w-5" />} />

      {toast ? <Card padding="md" className="mb-4"><p className="text-sm text-signal-ok">{toast}</p></Card> : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label={t('wallet.available')} value={formatBDT(walletBalance(me))} icon={<Wallet className="h-5 w-5 text-neon" />} accent="gold" />
        <StatTile label={t('wallet.bonus')} value={formatBDT(walletBonus(me))} icon={<Sparkles className="h-5 w-5 text-gold-300" />} />
        <StatTile label={t('wallet.locked')} value={formatBDT(walletLocked(me))} icon={<Lock className="h-5 w-5 text-gold-300" />} />
        <StatTile label={lang === 'bn' ? 'লটো ব্যালেন্স' : 'Lotto balance'} value={formatBDT(lotto)} icon={<Ticket className="h-5 w-5 text-gold-300" />} />
      </div>

      <Card padding="lg" className="mt-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-semibold text-ink-hi">
              {lang === 'bn' ? 'লটো জিতেছেন? মেইন ব্যালেন্সে নিয়ে আসুন।' : 'Won on the lotto? Move it to your main balance.'}
            </p>
            <p className="mt-1 text-xs text-ink-mid">
              {lang === 'bn'
                ? `সর্বনিম্ন ${MIN_TRANSFER} টাকা। স্থানান্তরিত টাকা সাধারণ উইথড্রয় ফ্লোতে ক্যাশআউট করা যাবে।`
                : `Minimum ${MIN_TRANSFER} BDT. Transferred funds can be cashed out through the normal Withdraw flow.`}
            </p>
          </div>
          <Button
            variant="gold"
            leftIcon={<ArrowRightLeft className="h-4 w-4" />}
            disabled={lotto < MIN_TRANSFER}
            title={lotto < MIN_TRANSFER ? (lang === 'bn' ? `সর্বনিম্ন ${MIN_TRANSFER} টাকা লাগবে` : `Need at least ${MIN_TRANSFER} BDT`) : undefined}
            onClick={() => { setError(null); setAmount(Math.floor(lotto)); setTransferOpen(true); }}
          >
            {lang === 'bn' ? 'মেইন ব্যালেন্সে স্থানান্তর' : 'Transfer to main'}
          </Button>
        </div>
      </Card>

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

      <Modal open={transferOpen} onOpenChange={setTransferOpen} title={lang === 'bn' ? 'লটো ব্যালেন্স স্থানান্তর' : 'Transfer lotto balance'} size="md">
        <form className="space-y-4" onSubmit={submitTransfer}>
          <div className="rounded-lg border border-neon/10 bg-base-deep/40 p-3 text-sm">
            <p className="text-ink-mid">
              {lang === 'bn' ? 'লটো ব্যালেন্স' : 'Lotto balance'}: <span className="font-semibold text-ink-hi">{formatBDT(lotto)}</span>
            </p>
            <p className="mt-1 text-xs text-ink-lo">
              {lang === 'bn'
                ? `সর্বনিম্ন ${MIN_TRANSFER} টাকা। সম্পূর্ণ ব্যালেন্স একসাথে স্থানান্তর করতে পারেন।`
                : `Minimum ${MIN_TRANSFER} BDT. You can move the whole balance in one go.`}
            </p>
          </div>
          <FormField label={lang === 'bn' ? 'পরিমাণ' : 'Amount'} required>
            <Input type="number" min={MIN_TRANSFER} max={lotto} step={50} value={amount} onChange={(e) => setAmount(Number(e.target.value))} />
          </FormField>
          {error ? <p className="text-sm text-signal-danger">{error}</p> : null}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" type="button" onClick={() => setTransferOpen(false)}>{lang === 'bn' ? 'বাতিল' : 'Cancel'}</Button>
            <Button type="submit" variant="gold" loading={busy} disabled={amount < MIN_TRANSFER || amount > lotto}>
              {lang === 'bn' ? 'স্থানান্তর করুন' : 'Transfer now'}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
