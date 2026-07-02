// Built by Anointed Coder.
//
// Admin queue for affiliate payout requests. Lists every
// CommissionPayout grouped by status. Pending rows expose Approve
// and Reject actions; approved rows expose Mark Paid (with optional
// provider key + reference). Mark Paid flips every linked
// AffiliateCommission row to status=paid so the affiliate dashboard
// balance recomputes correctly.

'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { PageHeader } from '@/components/site/PageHeader';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { FormField, Input, Textarea } from '@/components/ui/Input';
import { Banknote, RefreshCw, ArrowLeft, CheckCircle2, XCircle, BadgeDollarSign } from 'lucide-react';
import { formatBDT } from '@/lib/utils/format';
import { cn } from '@/lib/utils/cn';

interface PayoutRow {
  id: string;
  affiliateId: string;
  affiliateUsername: string | null;
  affiliatePhone: string | null;
  amount: number;
  method: string;
  accountNumber: string;
  accountName: string;
  status: string;
  adminNote: string | null;
  reviewedAt: string | null;
  paidAt: string | null;
  providerKey: string | null;
  providerRef: string | null;
  commissionCount: number;
  createdAt: string;
}

const STATUS_TABS = ['pending', 'approved', 'paid', 'rejected'] as const;

function statusTone(s: string): 'warn' | 'info' | 'ok' | 'danger' | 'neutral' {
  if (s === 'pending') return 'warn';
  if (s === 'approved') return 'info';
  if (s === 'paid') return 'ok';
  if (s === 'rejected') return 'danger';
  return 'neutral';
}

export default function AffiliatePayoutsPage() {
  const [tab, setTab] = useState<(typeof STATUS_TABS)[number]>('pending');
  const [rows, setRows] = useState<PayoutRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [actioning, setActioning] = useState<{ row: PayoutRow; mode: 'approve' | 'reject' | 'mark_paid' } | null>(null);
  // Action failures render INSIDE the action modal; the page error
  // card sits behind the open modal overlay.
  const [actionError, setActionError] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [providerKey, setProviderKey] = useState('');
  const [providerRef, setProviderRef] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/affiliate/payouts?status=${tab}`, { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message ?? data?.code ?? 'Failed to load');
      setRows(data.payouts as PayoutRow[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => { load(); }, [load]);

  const counts = useMemo(() => ({ [tab]: rows.length }), [rows.length, tab]);

  const openAction = (row: PayoutRow, mode: 'approve' | 'reject' | 'mark_paid') => {
    setActioning({ row, mode });
    setActionError(null);
    setNote('');
    setProviderKey('');
    setProviderRef('');
  };

  const runAction = async () => {
    if (!actioning) return;
    setBusy(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/admin/affiliate/payouts/${actioning.row.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          action: actioning.mode,
          adminNote: note.trim() || undefined,
          providerKey: providerKey.trim() || undefined,
          providerRef: providerRef.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message ?? data?.code ?? 'Action failed');
      setToast(`${actioning.mode.replace('_', ' ')} done for ${actioning.row.affiliateUsername ?? actioning.row.affiliateId}.`);
      setTimeout(() => setToast(null), 4000);
      setActioning(null);
      load();
    } catch (e) {
      // Keep the modal open and show the failure inside it.
      setActionError(e instanceof Error ? e.message : 'Action failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Affiliate Payouts"
        subtitle="Approve, reject, or mark paid every commission payout request"
        icon={<Banknote className="h-5 w-5" />}
        action={
          <div className="flex gap-2">
            <Link href="/admin/affiliate"><Button variant="ghost" leftIcon={<ArrowLeft className="h-3.5 w-3.5" />}>Back</Button></Link>
            <Button variant="ghost" leftIcon={<RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} />} onClick={load}>Reload</Button>
          </div>
        }
      />

      {toast ? <Card padding="md" className="mb-4"><p className="text-sm text-signal-ok">{toast}</p></Card> : null}
      {error ? <Card padding="md" className="mb-4"><p className="text-sm text-signal-danger">{error}</p></Card> : null}

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {STATUS_TABS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setTab(s)}
            className={cn(
              'inline-flex h-9 items-center rounded-pill border px-4 text-sm transition',
              tab === s
                ? 'border-neon/40 bg-neon/10 text-ink-hi'
                : 'border-neon/15 bg-base-deep/40 text-ink-mid hover:text-ink-hi',
            )}
          >
            {s}{tab === s ? ` (${counts[s] ?? 0})` : ''}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-ink-mid">Loading payouts...</p>
      ) : rows.length === 0 ? (
        <Card padding="lg">
          <p className="text-sm text-ink-mid">No {tab} payout requests.</p>
          <p className="mt-2 text-xs text-ink-lo">
            Payout requests appear here only after three steps complete in order:
          </p>
          <ol className="mt-2 list-decimal pl-5 text-xs text-ink-lo">
            <li>An affiliate is approved AND assigned an active commission tier (managed from <Link href="/admin/affiliate" className="underline">Affiliate Management</Link>).</li>
            <li>One of their downline users makes a deposit, and an admin approves it. Commission accrues automatically. Without a tier, commission is zero.</li>
            <li>The affiliate clicks Request Payout on their dashboard with at least 500 BDT withdrawable.</li>
          </ol>
          <p className="mt-3 text-xs text-ink-lo">
            If you expected a request here but do not see one, open <Link href="/admin/affiliate" className="underline">Affiliate Management</Link>, click Diagnose, and verify the upline chain + tier rate for the user who made the deposit. Use <Link href="/admin/deposits" className="underline">Deposits . Backfill commission</Link> on any approved deposit that pre-dated the tier assignment.
          </p>
        </Card>
      ) : (
        <Card padding="md" className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="text-xs uppercase tracking-wider text-ink-lo">
              <tr>
                <th className="px-2 py-2 text-left">Affiliate</th>
                <th className="px-2 py-2 text-right">Amount</th>
                <th className="px-2 py-2 text-left">Method</th>
                <th className="px-2 py-2 text-left">Account</th>
                <th className="px-2 py-2 text-left">Status</th>
                <th className="px-2 py-2 text-left">Commissions</th>
                <th className="px-2 py-2 text-left">Requested</th>
                <th className="px-2 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-neon/10 align-top">
                  <td className="px-2 py-2">
                    <p className="font-semibold text-ink-hi">{r.affiliateUsername ?? r.affiliateId.slice(0, 6)}</p>
                    {r.affiliatePhone ? <p className="text-xs text-ink-lo">{r.affiliatePhone}</p> : null}
                  </td>
                  <td className="px-2 py-2 text-right font-mono">{formatBDT(r.amount)}</td>
                  <td className="px-2 py-2 text-xs uppercase tracking-wider text-ink-mid">{r.method}</td>
                  <td className="px-2 py-2">
                    <p className="font-mono text-xs">{r.accountNumber}</p>
                    <p className="text-xs text-ink-lo">{r.accountName}</p>
                  </td>
                  <td className="px-2 py-2"><Chip tone={statusTone(r.status)}>{r.status}</Chip></td>
                  <td className="px-2 py-2 text-xs text-ink-mid">{r.commissionCount} row{r.commissionCount === 1 ? '' : 's'}</td>
                  <td className="px-2 py-2 text-xs text-ink-lo">{new Date(r.createdAt).toLocaleString()}</td>
                  <td className="px-2 py-2 text-right">
                    {r.status === 'pending' ? (
                      <div className="inline-flex gap-1">
                        <Button size="sm" leftIcon={<CheckCircle2 className="h-3.5 w-3.5" />} onClick={() => openAction(r, 'approve')}>Approve</Button>
                        <Button size="sm" variant="ghost" leftIcon={<XCircle className="h-3.5 w-3.5" />} onClick={() => openAction(r, 'reject')}>Reject</Button>
                      </div>
                    ) : r.status === 'approved' ? (
                      <Button size="sm" variant="gold" leftIcon={<BadgeDollarSign className="h-3.5 w-3.5" />} onClick={() => openAction(r, 'mark_paid')}>Mark Paid</Button>
                    ) : (
                      <span className="text-xs text-ink-lo">{r.paidAt ? `Paid ${new Date(r.paidAt).toLocaleDateString()}` : (r.adminNote ?? '-')}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <Modal open={!!actioning} onOpenChange={(v) => { if (!v && !busy) { setActioning(null); setActionError(null); } }} title={actioning ? `${actioning.mode.replace('_', ' ')} payout` : ''} size="md">
        {actioning ? (
          <form
            className="space-y-4"
            onSubmit={(e) => { e.preventDefault(); runAction(); }}
          >
            <div className="rounded-lg border border-neon/10 bg-base-deep/40 p-3 text-sm">
              <p>Affiliate: <span className="font-semibold text-ink-hi">{actioning.row.affiliateUsername ?? actioning.row.affiliateId}</span></p>
              <p>Amount: <span className="font-mono">{formatBDT(actioning.row.amount)}</span></p>
              <p>Method: <span className="uppercase">{actioning.row.method}</span> {actioning.row.accountNumber}</p>
            </div>
            {actioning.mode === 'mark_paid' ? (
              <div className="grid gap-3 md:grid-cols-2">
                <FormField label="Provider key (optional)" hint="bkash / nagad / rocket / manual">
                  <Input value={providerKey} onChange={(e) => setProviderKey(e.target.value)} placeholder="manual" />
                </FormField>
                <FormField label="Provider reference (optional)" hint="Transaction id from the payout app">
                  <Input value={providerRef} onChange={(e) => setProviderRef(e.target.value)} placeholder="TXN-..." />
                </FormField>
              </div>
            ) : null}
            <FormField label="Admin note (optional)">
              <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder={actioning.mode === 'reject' ? 'Reason shown to the affiliate.' : 'Internal note for the audit log.'} />
            </FormField>
            {actionError ? (
              <p className="text-sm text-signal-danger">Action failed: {actionError} (কাজটি ব্যর্থ হয়েছে: {actionError})</p>
            ) : null}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" type="button" disabled={busy} onClick={() => { setActioning(null); setActionError(null); }}>Cancel</Button>
              <Button type="submit" loading={busy} variant={actioning.mode === 'reject' ? 'ghost' : 'gold'}>
                {actioning.mode === 'approve' ? 'Approve' : actioning.mode === 'reject' ? 'Reject' : 'Mark Paid'}
              </Button>
            </div>
          </form>
        ) : null}
      </Modal>
    </>
  );
}
