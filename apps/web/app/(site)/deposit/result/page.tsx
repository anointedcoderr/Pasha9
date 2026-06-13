// Built by Anointed Coder.
//
// Landing page the player lands on after ChaopaoPay's hosted payment
// session completes. The URL carries the trx_id we generated at
// /api/payments/chaopaopay/create-deposit so we can match the
// Deposit row and poll its status while we wait for the webhook +
// auto-credit to land.
//
// Three terminal states:
//   - approved  -> green "Wallet credited" panel + Continue button
//   - rejected  -> rose "Payment failed" panel with a retry link
//   - pending   -> after ~60s we fall back to a "still processing"
//                  message and tell the player they can come back
//                  later. Their deposit is still in /admin/deposits
//                  for the operator to status-check or approve.

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import { CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';
import { useLang } from '@/lib/i18n/context';
import { triggerWalletRefresh } from '@/components/site/WalletStrip';

interface DepositRow {
  id: string;
  transactionId: string;
  amount: number;
  status: 'pending' | 'approved' | 'rejected';
  method: string;
  bonusAmount?: number;
  rejectionReason?: string | null;
  createdAt: string;
  reviewedAt?: string | null;
}

const POLL_MS = 4000;
const MAX_WAIT_MS = 90_000;

function formatBDT(n: number | undefined): string {
  if (n == null || Number.isNaN(n)) return '0';
  return n.toLocaleString();
}

export default function DepositResultPage() {
  const params = useSearchParams();
  const router = useRouter();
  const { lang } = useLang();
  const bn = lang === 'bn';
  const trx = params?.get('trx') ?? null;
  const [row, setRow] = useState<DepositRow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);

  useEffect(() => {
    if (!trx) {
      setError(bn ? 'লেনদেন আইডি পাওয়া যায়নি।' : 'Transaction reference missing from URL.');
      return;
    }
    let alive = true;
    const startedAt = Date.now();
    const tick = async () => {
      if (!alive) return;
      try {
        const r = await fetch(`/api/deposits/by-trx?trx=${encodeURIComponent(trx)}`, {
          cache: 'no-store',
          credentials: 'include',
        });
        if (r.ok) {
          const j = await r.json().catch(() => null) as { deposit?: DepositRow } | null;
          if (alive && j?.deposit) {
            setRow(j.deposit);
            if (j.deposit.status === 'approved') {
              triggerWalletRefresh();
            }
          }
        }
      } catch {
        /* swallow; keep polling */
      }
      const elapsed = Date.now() - startedAt;
      setElapsedMs(elapsed);
      if (!alive) return;
      if (row?.status === 'approved' || row?.status === 'rejected' || elapsed > MAX_WAIT_MS) return;
      window.setTimeout(tick, POLL_MS);
    };
    void tick();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trx]);

  const isApproved = row?.status === 'approved';
  const isRejected = row?.status === 'rejected';
  const isPending = !row || row.status === 'pending';
  const timedOut = elapsedMs > MAX_WAIT_MS && isPending;

  return (
    <div className="mx-auto max-w-xl px-4 py-8">
      {isApproved ? (
        <Card padding="lg" className="text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600">
            <CheckCircle2 className="h-7 w-7" />
          </div>
          <h2 className="text-xl font-extrabold text-brand-ink">
            {bn ? 'ওয়ালেট ক্রেডিট হয়েছে' : 'Wallet credited'}
          </h2>
          <p className="mt-2 text-sm text-brand-inkSoft">
            {bn
              ? `BDT ${formatBDT(row?.amount)} আপনার অ্যাকাউন্টে যুক্ত হয়েছে।`
              : `BDT ${formatBDT(row?.amount)} has been added to your wallet.`}
          </p>
          {row?.bonusAmount && row.bonusAmount > 0 ? (
            <p className="mt-1 text-xs font-semibold text-emerald-700">
              {bn
                ? `+ BDT ${formatBDT(row.bonusAmount)} বোনাস অনুমোদনের পর প্রয়োগ হবে।`
                : `+ BDT ${formatBDT(row.bonusAmount)} bonus will be applied per the promotion rule.`}
            </p>
          ) : null}
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <button
              type="button"
              onClick={() => router.push('/')}
              className="inline-flex h-11 items-center rounded-xl bg-gradient-to-b from-amber-300 to-amber-500 px-5 text-sm font-extrabold text-[#3A1F00] shadow"
            >
              {bn ? 'হোম-এ যান' : 'Go to Home'}
            </button>
            <Link
              href="/dashboard/wallet"
              className="inline-flex h-11 items-center rounded-xl border border-brand-divider bg-brand-paper px-5 text-sm font-bold text-brand-ink"
            >
              {bn ? 'ওয়ালেট দেখুন' : 'View wallet'}
            </Link>
          </div>
        </Card>
      ) : isRejected ? (
        <Card padding="lg" className="text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-rose-500/15 text-rose-600">
            <AlertTriangle className="h-7 w-7" />
          </div>
          <h2 className="text-xl font-extrabold text-brand-ink">
            {bn ? 'পেমেন্ট ব্যর্থ হয়েছে' : 'Payment failed'}
          </h2>
          <p className="mt-2 text-sm text-brand-inkSoft">
            {row?.rejectionReason
              ? row.rejectionReason
              : (bn ? 'গেটওয়ে এই পেমেন্ট গ্রহণ করেনি। আবার চেষ্টা করুন বা ম্যানুয়াল ডিপোজিট ব্যবহার করুন।' : 'The gateway did not accept this payment. Please try again or use the manual deposit form.')}
          </p>
          <Link
            href="/deposit"
            className="mt-6 inline-flex h-11 items-center rounded-xl bg-gradient-to-b from-amber-300 to-amber-500 px-5 text-sm font-extrabold text-[#3A1F00] shadow"
          >
            {bn ? 'আবার চেষ্টা করুন' : 'Try again'}
          </Link>
        </Card>
      ) : (
        <Card padding="lg" className="text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-amber-500/15 text-amber-600">
            <Loader2 className={`h-7 w-7 ${timedOut ? '' : 'animate-spin'}`} />
          </div>
          <h2 className="text-xl font-extrabold text-brand-ink">
            {timedOut
              ? (bn ? 'এখনো প্রক্রিয়াধীন' : 'Still processing')
              : (bn ? 'পেমেন্ট প্রক্রিয়াধীন' : 'Processing your payment')}
          </h2>
          <p className="mt-2 text-sm text-brand-inkSoft">
            {timedOut
              ? (bn
                  ? 'এটি কিছুটা সময় নিতে পারে। আপনি বন্ধ করতে পারেন - ওয়ালেট ক্রেডিট হলে স্বয়ংক্রিয় বিজ্ঞপ্তি যাবে।'
                  : 'This is taking a little longer than usual. You can close this page - the wallet will credit automatically when the gateway confirms.')
              : (bn
                  ? 'গেটওয়ে নিশ্চিত করার অপেক্ষায় - ৩০ সেকেন্ডের মধ্যে অটো-ক্রেডিট হবে।'
                  : 'Waiting for gateway confirmation. Auto-credit usually lands within 30 seconds.')}
          </p>
          {error ? <p className="mt-2 text-xs text-rose-700">{error}</p> : null}
          {trx ? (
            <p className="mt-3 text-[11px] text-brand-inkMute">
              {bn ? 'রেফারেন্স' : 'Reference'}: <span className="font-mono">{trx}</span>
            </p>
          ) : null}
          <Link
            href="/dashboard/wallet"
            className="mt-6 inline-flex h-11 items-center rounded-xl border border-brand-divider bg-brand-paper px-5 text-sm font-bold text-brand-ink"
          >
            {bn ? 'ওয়ালেট দেখুন' : 'View wallet'}
          </Link>
        </Card>
      )}
    </div>
  );
}
