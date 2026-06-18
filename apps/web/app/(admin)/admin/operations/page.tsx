// Built by Anointed Coder.
//
// /admin/operations - the operations dashboard. Surfaces three queues
// that the operator should clear in priority order:
//
// 1. Pending deposits older than the threshold (player paid but the
//    wallet is not credited). Jump straight to the deposit row to
//    investigate.
// 2. Approved withdrawals stuck in payout_initiated for too long.
//    Operator can re-fire ChaopaoPay manually or mark paid.
// 3. Verified gateway transactions with no matching deposit row.
//    Operator decides whether to credit, refund, or ignore.
//
// Designed for at-a-glance triage: red banner if any queue is non
// zero, table rows show age + amount + player + action shortcut.

'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { PageHeader } from '@/components/site/PageHeader';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { AlertTriangle, RefreshCw, Clock, ArrowRight, CheckCircle2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

interface StuckDeposit {
  id: string;
  userId: string;
  username: string | null;
  phone: string | null;
  amount: number;
  method: string;
  transactionId: string;
  createdAt: string;
  ageMinutes: number;
}

interface StuckPayout {
  id: string;
  userId: string;
  username: string | null;
  phone: string | null;
  amount: number;
  method: string;
  accountNumber: string;
  providerKey: string | null;
  providerRef: string | null;
  reviewedAt: string | null;
  ageMinutes: number | null;
}

interface Unmatched {
  id: string;
  provider: string;
  providerTxId: string;
  amount: number;
  currency: string;
  createdAt: string;
  note: string | null;
  userId: string | null;
  depositId: string | null;
  ageMinutes: number;
}

interface Snapshot {
  stuckDeposits: StuckDeposit[];
  stuckPayouts: StuckPayout[];
  unmatchedGatewayTx: Unmatched[];
  thresholds: { depositPendingMinutes: number; payoutPendingMinutes: number };
  counts: { stuckDeposits: number; stuckPayouts: number; unmatched: number };
}

function ageBadgeTone(min: number): 'ok' | 'warn' | 'danger' {
  if (min < 15) return 'ok';
  if (min < 60) return 'warn';
  return 'danger';
}

export default function AdminOperationsPage() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    setError(null);
    try {
      const r = await fetch('/api/admin/operations/stuck-transactions', { cache: 'no-store' });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.message ?? j?.code ?? 'Failed');
      setSnapshot(j as Snapshot);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    // Light auto-refresh every 30s so the operator sees new stuck
    // rows show up without leaving the page.
    const t = setInterval(refresh, 30_000);
    return () => clearInterval(t);
  }, [refresh]);

  const total = snapshot
    ? snapshot.counts.stuckDeposits + snapshot.counts.stuckPayouts + snapshot.counts.unmatched
    : 0;

  return (
    <>
      <PageHeader
        title="Operations"
        subtitle="Stuck transactions across deposits, withdrawals and verified gateway events. Auto-refreshes every 30s."
        icon={<AlertTriangle className="h-5 w-5" />}
        action={
          <Button variant="neon" leftIcon={<RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} />} onClick={refresh}>
            Refresh
          </Button>
        }
      />

      {error ? (
        <Card padding="md" className="mb-4 border-l-4 border-rose-500">
          <p className="text-sm text-rose-300">
            <AlertCircle className="mr-1 inline h-3.5 w-3.5" />{error}
          </p>
        </Card>
      ) : null}

      {snapshot ? (
        total === 0 ? (
          <Card padding="lg" className="border border-emerald-400/40 bg-emerald-500/10">
            <p className="inline-flex items-center gap-2 text-sm font-bold text-emerald-200">
              <CheckCircle2 className="h-4 w-4" />
              No stuck transactions. Deposit pipeline + payout pipeline + gateway reconciliation are all clear.
            </p>
            <p className="mt-2 text-xs text-emerald-300/70">
              Thresholds: pending deposits older than {snapshot.thresholds.depositPendingMinutes} minutes,
              payouts stuck in payout_initiated longer than {snapshot.thresholds.payoutPendingMinutes} minutes,
              unmatched gateway tx older than {snapshot.thresholds.depositPendingMinutes} minutes.
            </p>
          </Card>
        ) : (
          <div className="space-y-4">
            {snapshot.stuckDeposits.length > 0 ? (
              <Card padding="lg">
                <CardHeader
                  title={
                    <span className="inline-flex items-center gap-2">
                      <span className="text-base font-extrabold text-brand-ink">Stuck deposits</span>
                      <Chip tone="warn">{snapshot.counts.stuckDeposits}</Chip>
                    </span>
                  }
                  subtitle={`Pending for more than ${snapshot.thresholds.depositPendingMinutes} minutes. Player paid but wallet is not yet credited.`}
                />
                <div className="space-y-2">
                  {snapshot.stuckDeposits.map((d) => (
                    <div key={d.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-brand-divider bg-brand-paper p-3 text-sm">
                      <div className="flex min-w-0 flex-1 flex-col">
                        <span className="font-bold text-brand-ink">{d.username ?? d.userId.slice(-8)}</span>
                        <span className="text-xs text-brand-inkMute truncate">
                          {d.amount.toLocaleString()} BDT . {d.method} . TX {d.transactionId.slice(0, 24)}
                        </span>
                      </div>
                      <Chip tone={ageBadgeTone(d.ageMinutes)}>
                        <Clock className="mr-1 inline h-3 w-3" />
                        {d.ageMinutes}m
                      </Chip>
                      <Link href={`/admin/deposits?focus=${d.id}`} className="inline-flex h-8 items-center gap-1 rounded-lg border border-brand-divider px-3 text-xs font-bold uppercase tracking-wider text-brand-ink hover:bg-brand-paper">
                        Review <ArrowRight className="h-3 w-3" />
                      </Link>
                    </div>
                  ))}
                </div>
              </Card>
            ) : null}

            {snapshot.stuckPayouts.length > 0 ? (
              <Card padding="lg">
                <CardHeader
                  title={
                    <span className="inline-flex items-center gap-2">
                      <span className="text-base font-extrabold text-brand-ink">Stuck payouts</span>
                      <Chip tone="warn">{snapshot.counts.stuckPayouts}</Chip>
                    </span>
                  }
                  subtitle={`Withdrawals approved + sent to gateway but no paid webhook received for more than ${snapshot.thresholds.payoutPendingMinutes} minutes.`}
                />
                <div className="space-y-2">
                  {snapshot.stuckPayouts.map((w) => (
                    <div key={w.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-brand-divider bg-brand-paper p-3 text-sm">
                      <div className="flex min-w-0 flex-1 flex-col">
                        <span className="font-bold text-brand-ink">{w.username ?? w.userId.slice(-8)}</span>
                        <span className="text-xs text-brand-inkMute truncate">
                          {w.amount.toLocaleString()} BDT . {w.method} . {w.accountNumber} . provider {w.providerKey ?? 'manual'} . ref {w.providerRef?.slice(0, 16) ?? '-'}
                        </span>
                      </div>
                      <Chip tone={w.ageMinutes != null ? ageBadgeTone(w.ageMinutes) : 'neutral'}>
                        <Clock className="mr-1 inline h-3 w-3" />
                        {w.ageMinutes != null ? `${w.ageMinutes}m` : 'unknown'}
                      </Chip>
                      <Link href={`/admin/withdrawals?focus=${w.id}`} className="inline-flex h-8 items-center gap-1 rounded-lg border border-brand-divider px-3 text-xs font-bold uppercase tracking-wider text-brand-ink hover:bg-brand-paper">
                        Review <ArrowRight className="h-3 w-3" />
                      </Link>
                    </div>
                  ))}
                </div>
              </Card>
            ) : null}

            {snapshot.unmatchedGatewayTx.length > 0 ? (
              <Card padding="lg">
                <CardHeader
                  title={
                    <span className="inline-flex items-center gap-2">
                      <span className="text-base font-extrabold text-brand-ink">Unmatched gateway events</span>
                      <Chip tone="warn">{snapshot.counts.unmatched}</Chip>
                    </span>
                  }
                  subtitle="Verified webhook arrived from the gateway but no pending deposit could be matched. Likely cause: player typed the wrong TX ID, or money landed without a deposit request being created."
                />
                <div className="space-y-2">
                  {snapshot.unmatchedGatewayTx.map((tx) => (
                    <div key={tx.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-brand-divider bg-brand-paper p-3 text-sm">
                      <div className="flex min-w-0 flex-1 flex-col">
                        <span className="font-bold text-brand-ink">{tx.provider} . {tx.amount.toLocaleString()} {tx.currency}</span>
                        <span className="text-xs text-brand-inkMute truncate">
                          providerTxId {tx.providerTxId} . {tx.note ?? 'no note'}
                        </span>
                      </div>
                      <Chip tone={ageBadgeTone(tx.ageMinutes)}>
                        <Clock className="mr-1 inline h-3 w-3" />
                        {tx.ageMinutes}m
                      </Chip>
                      <Link href="/admin/payments/reconciliation" className="inline-flex h-8 items-center gap-1 rounded-lg border border-brand-divider px-3 text-xs font-bold uppercase tracking-wider text-brand-ink hover:bg-brand-paper">
                        Reconcile <ArrowRight className="h-3 w-3" />
                      </Link>
                    </div>
                  ))}
                </div>
              </Card>
            ) : null}
          </div>
        )
      ) : (
        <Card padding="lg">Loading...</Card>
      )}
    </>
  );
}
