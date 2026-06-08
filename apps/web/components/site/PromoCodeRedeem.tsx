// Built by Anointed Coder.
//
// Promo code redeem widget. Mounted inside /promotions so a player
// can type a code and immediately see the server-validated result.
// Wallet refresh fires on success so the header balance reflects the
// credit. The widget is hidden for guests; they see a Log in prompt.

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Tag, CheckCircle2, AlertCircle, LogIn } from 'lucide-react';
import { useLang } from '@/lib/i18n/context';
import { formatBDT } from '@/lib/utils/format';
import { triggerWalletRefresh } from '@/components/site/WalletStrip';

interface SuccessState {
  amount: number;
  rewardType: string;
  turnoverX: number;
}

const rewardLabel = (kind: string, lang: 'en' | 'bn'): string => {
  switch (kind) {
    case 'main_balance': return lang === 'bn' ? 'মেইন ব্যালেন্স' : 'main balance';
    case 'bonus_balance': return lang === 'bn' ? 'বোনাস ব্যালেন্স' : 'bonus balance';
    case 'locked_balance': return lang === 'bn' ? 'লকড ব্যালেন্স' : 'locked balance';
    case 'bonus_grant': return lang === 'bn' ? 'বোনাস গ্রান্ট' : 'bonus grant';
    default: return kind.replace('_', ' ');
  }
};

export function PromoCodeRedeem({ authed, authChecked }: { authed: boolean; authChecked: boolean }) {
  const { lang } = useLang();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState<SuccessState | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;
    setBusy(true);
    setSuccess(null);
    setError(null);
    try {
      const res = await fetch('/api/promo-codes/redeem', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ code: code.trim() }),
      });
      if (res.status === 401) {
        window.location.assign('/?login=1');
        return;
      }
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.message ?? data?.code ?? (lang === 'bn' ? 'কোড রিডিম করা যায়নি।' : 'Could not redeem this code.'));
        return;
      }
      setSuccess({
        amount: Number(data.amount ?? 0),
        rewardType: String(data.rewardType ?? ''),
        turnoverX: Number(data.turnoverX ?? 0),
      });
      setCode('');
      triggerWalletRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="card-light p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-2">
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-yellow-500/15 text-brand-yellow-700">
            <Tag className="h-4 w-4" />
          </span>
          <div>
            <p className="text-sm font-extrabold text-brand-ink">
              {lang === 'bn' ? 'প্রোমো কোড রিডিম করুন' : 'Redeem a promo code'}
            </p>
            <p className="text-xs text-brand-inkMute">
              {lang === 'bn'
                ? 'কোড লিখে রিডিম বাটনে চাপুন। কোড সঠিক হলে রিওয়ার্ড সরাসরি ক্রেডিট হবে।'
                : 'Type the code and tap Redeem. Valid codes credit the reward to your wallet immediately.'}
            </p>
          </div>
        </div>
        {!authChecked || authed ? (
          <form onSubmit={submit} className="flex w-full gap-2 md:w-auto">
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder={lang === 'bn' ? 'কোড লিখুন' : 'Enter code'}
              maxLength={40}
              className="h-10 flex-1 rounded-lg border border-brand-divider bg-brand-paper px-3 font-mono text-sm uppercase tracking-wider text-brand-ink focus:outline-none focus:ring-2 focus:ring-brand-blue-500 md:w-56"
            />
            <button
              type="submit"
              disabled={busy || !code.trim()}
              className="btn-yellow inline-flex h-10 items-center rounded-lg px-4 text-xs font-bold disabled:opacity-60"
            >
              {busy ? (lang === 'bn' ? 'লোড...' : 'Redeeming...') : (lang === 'bn' ? 'রিডিম' : 'Redeem')}
            </button>
          </form>
        ) : (
          <Link href="/?login=1" className="btn-yellow inline-flex h-10 items-center rounded-lg px-4 text-xs font-bold">
            <LogIn className="mr-1 h-3.5 w-3.5" />
            {lang === 'bn' ? 'লগইন করুন' : 'Log in to redeem'}
          </Link>
        )}
      </div>
      {success ? (
        <p className="mt-3 inline-flex items-start gap-1 text-[12px] text-emerald-700">
          <CheckCircle2 className="mt-0.5 h-3.5 w-3.5" />
          <span>
            {lang === 'bn'
              ? `${formatBDT(success.amount)} ${rewardLabel(success.rewardType, 'bn')} যোগ হয়েছে।`
              : `${formatBDT(success.amount)} credited to your ${rewardLabel(success.rewardType, 'en')}.`}
            {success.turnoverX > 0
              ? ` ${lang === 'bn' ? `উইথড্রয়ালের আগে ${success.turnoverX}x টার্নওভার সম্পূর্ণ করুন।` : `Complete ${success.turnoverX}x turnover before withdrawal.`}`
              : ''}
          </span>
        </p>
      ) : null}
      {error ? (
        <p className="mt-3 inline-flex items-start gap-1 text-[12px] text-rose-600">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5" />
          <span>{error}</span>
        </p>
      ) : null}
    </section>
  );
}
