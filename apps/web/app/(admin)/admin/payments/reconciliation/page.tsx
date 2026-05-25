// Built by Anointed Coder.
//
// Read-only reconciliation log of every PaymentGatewayTx row written
// by webhook hits. Lets support trace auto-credits, see signature
// failures, and confirm duplicates were caught. Manual re-credit on
// an unmatched row stays on /admin/deposits where the admin approves
// the Deposit row directly.

'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { PageHeader } from '@/components/site/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { Select } from '@/components/ui/Select';
import { ArrowLeft, RefreshCw, FileCheck, ShieldAlert } from 'lucide-react';
import { formatBDT, formatDateTime } from '@/lib/utils/format';
import { useLang } from '@/lib/i18n/context';
import { cn } from '@/lib/utils/cn';

interface ReconciliationRow {
  id: string;
  provider: string;
  providerTxId: string | null;
  depositId: string | null;
  userId: string | null;
  amount: number | null;
  currency: string;
  status: string;
  signatureValid: boolean;
  note: string | null;
  receivedAt: string;
  processedAt: string | null;
}

const STATUS_OPTIONS = [
  '',
  'credited',
  'pending_provider',
  'duplicate',
  'unmatched',
  'failed',
  'signature_invalid',
] as const;
const PROVIDER_OPTIONS = ['', 'manual', 'test', 'bkash', 'nagad', 'rocket'] as const;

function statusChip(status: string) {
  switch (status) {
    case 'credited': return <Chip tone="ok">credited</Chip>;
    case 'pending_provider': return <Chip tone="warn">pending</Chip>;
    case 'duplicate': return <Chip>duplicate</Chip>;
    case 'unmatched': return <Chip tone="warn">unmatched</Chip>;
    case 'failed': return <Chip tone="danger">failed</Chip>;
    case 'signature_invalid': return <Chip tone="danger">signature invalid</Chip>;
    default: return <Chip>{status}</Chip>;
  }
}

export default function ReconciliationPage() {
  const { lang } = useLang();
  const [rows, setRows] = useState<ReconciliationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [provider, setProvider] = useState<string>('');
  const [status, setStatus] = useState<string>('');

  const load = useCallback(async () => {
    setError(null);
    setRefreshing(true);
    try {
      const qs = new URLSearchParams();
      if (provider) qs.set('provider', provider);
      if (status) qs.set('status', status);
      qs.set('take', '200');
      const res = await fetch(`/api/admin/payments/reconciliation?${qs.toString()}`, { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message ?? data?.code ?? 'Failed');
      setRows(data.rows as ReconciliationRow[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  }, [provider, status]);

  useEffect(() => { load(); }, [load]);

  const counts = rows.reduce<Record<string, number>>((acc, r) => {
    acc[r.status] = (acc[r.status] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <>
      <PageHeader
        title="Reconciliation Log"
        subtitle={loading ? 'Loading...' : `${rows.length} gateway transactions in view`}
        icon={<FileCheck className="h-5 w-5" />}
        action={
          <div className="flex gap-2">
            <Link href="/admin/payments" className="btn-neon inline-flex h-9 items-center gap-2 rounded-xl px-3 text-sm">
              <ArrowLeft className="h-3.5 w-3.5" /> Providers
            </Link>
            <Button variant="neon" leftIcon={<RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} />} onClick={load}>
              Refresh
            </Button>
          </div>
        }
      />

      <Card padding="md" className="mb-4">
        <p className="text-xs text-ink-mid">
          Every webhook hit lands here, even if the signature was invalid or no Deposit row matched. Auto-credit only fires
          when the provider signature verifies AND the amount + reference match a pending Deposit. Unmatched or failed
          rows stay here as an audit trail; manual approval at <span className="font-mono text-ink-hi">/admin/deposits</span> remains
          the authoritative way to credit a Deposit.
        </p>
      </Card>

      <Card padding="md" className="mb-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="w-44">
            <p className="mb-1 text-[11px] uppercase tracking-wider text-ink-lo">Provider</p>
            <Select value={provider} onChange={(e) => setProvider(e.target.value)}>
              {PROVIDER_OPTIONS.map((p) => (
                <option key={p} value={p}>{p === '' ? 'All' : p}</option>
              ))}
            </Select>
          </div>
          <div className="w-52">
            <p className="mb-1 text-[11px] uppercase tracking-wider text-ink-lo">Status</p>
            <Select value={status} onChange={(e) => setStatus(e.target.value)}>
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>{s === '' ? 'All' : s}</option>
              ))}
            </Select>
          </div>
          <div className="ml-auto flex flex-wrap gap-2 text-[11px]">
            {Object.entries(counts).map(([k, v]) => (
              <span key={k} className="inline-flex items-center gap-1 rounded-md border border-neon/10 bg-base-deep/40 px-2 py-1 text-ink-mid">
                {k}: <span className="font-bold text-ink-hi">{v}</span>
              </span>
            ))}
          </div>
        </div>
      </Card>

      {error ? <Card padding="md" className="mb-4"><p className="text-sm text-signal-danger">{error}</p></Card> : null}

      {loading ? (
        <Card padding="lg">Loading...</Card>
      ) : rows.length === 0 ? (
        <Card padding="lg">
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-base-deep/60 text-ink-lo">
              <ShieldAlert className="h-4 w-4" />
            </span>
            <p className="text-sm text-ink-mid">
              No gateway transactions logged yet. Hit <code className="font-mono text-xs">/api/payments/webhook/test</code> with
              the X-Pasha-Test-Secret header to exercise the pipeline end to end.
            </p>
          </div>
        </Card>
      ) : (
        <Card padding="none" className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-neon/10 bg-base-deep/40 text-xs uppercase tracking-wider text-ink-lo">
                  <th className="px-4 py-3 text-left">Received</th>
                  <th className="px-4 py-3 text-left">Provider</th>
                  <th className="px-4 py-3 text-left">Provider TX</th>
                  <th className="px-4 py-3 text-left">Amount</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-left">Sig</th>
                  <th className="px-4 py-3 text-left">Deposit</th>
                  <th className="px-4 py-3 text-left">Note</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="table-row">
                    <td className="px-4 py-3 text-ink-lo">{formatDateTime(r.receivedAt, lang)}</td>
                    <td className="px-4 py-3 text-ink-mid capitalize">{r.provider}</td>
                    <td className="px-4 py-3 font-mono text-xs text-ink-lo">{r.providerTxId ?? '-'}</td>
                    <td className="px-4 py-3 tabular-nums text-ink-hi">{r.amount != null ? formatBDT(r.amount) : '-'}</td>
                    <td className="px-4 py-3">{statusChip(r.status)}</td>
                    <td className="px-4 py-3">{r.signatureValid ? <Chip tone="ok">ok</Chip> : <Chip tone="danger">no</Chip>}</td>
                    <td className="px-4 py-3 font-mono text-xs text-ink-lo">{r.depositId ?? '-'}</td>
                    <td className="px-4 py-3 text-xs text-ink-mid">{r.note ?? ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </>
  );
}
