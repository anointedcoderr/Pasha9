// Built by Anointed Coder.
//
// Admin platform-wide transaction log. M4 hotfix: switched off the
// mockTransactions array onto /api/admin/transactions which reads the
// canonical Transaction table joined with the user.

'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { PageHeader } from '@/components/site/PageHeader';
import { DataTable } from '@/components/ui/DataTable';
import { Chip } from '@/components/ui/Chip';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { formatBDT, formatDateTime } from '@/lib/utils/format';
import { useLang } from '@/lib/i18n/context';
import { ReceiptText, RefreshCw } from 'lucide-react';
import type { ColumnDef } from '@tanstack/react-table';

interface AdminTxn {
  id: string;
  userId: string;
  username: string;
  phone: string;
  type: 'deposit' | 'withdraw' | 'bonus' | 'referral' | 'bet' | 'win' | 'adjust';
  amount: number;
  status: 'pending' | 'completed' | 'failed';
  reference: string | null;
  description: string | null;
  createdAt: string;
}

const TYPES = ['all', 'deposit', 'withdraw', 'bonus', 'referral', 'bet', 'win', 'adjust'] as const;

export default function AdminTransactionsPage() {
  const { lang } = useLang();
  const [rows, setRows] = useState<AdminTxn[]>([]);
  const [type, setType] = useState<(typeof TYPES)[number]>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (filter: (typeof TYPES)[number]) => {
    setRefreshing(true);
    setError(null);
    try {
      const url = filter === 'all' ? '/api/admin/transactions?take=300' : `/api/admin/transactions?type=${filter}&take=300`;
      const r = await fetch(url, { cache: 'no-store', credentials: 'include' });
      const j = await r.json().catch(() => null);
      if (!r.ok) throw new Error(j?.message ?? j?.code ?? 'Failed to load');
      setRows(Array.isArray(j?.transactions) ? (j.transactions as AdminTxn[]) : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(type); }, [load, type]);

  const columns = useMemo<ColumnDef<AdminTxn>[]>(() => [
    { header: 'Reference', accessorKey: 'reference', cell: ({ getValue }) => <code className="font-mono text-xs text-ink-mid">{String(getValue() ?? '-')}</code> },
    { header: 'User', accessorKey: 'username', cell: ({ row }) => (
        <div>
          <p className="font-semibold text-ink-hi">{row.original.username}</p>
          <p className="font-mono text-[11px] text-ink-lo">{row.original.phone}</p>
        </div>
      ) },
    { header: 'Type', accessorKey: 'type', cell: ({ getValue }) => <span className="capitalize text-ink-mid">{String(getValue())}</span> },
    { header: 'Amount', accessorKey: 'amount', cell: ({ getValue }) => {
      const v = Number(getValue());
      return <span className={v > 0 ? 'tabular-nums text-emerald-500 font-semibold' : v < 0 ? 'tabular-nums text-rose-500 font-semibold' : 'tabular-nums text-ink-lo'}>{formatBDT(v, { sign: true })}</span>;
    } },
    { header: 'Description', accessorKey: 'description', cell: ({ getValue }) => <span className="text-ink-mid">{String(getValue() ?? '-')}</span> },
    { header: 'Status', accessorKey: 'status', cell: ({ getValue }) => <Chip tone={getValue() === 'completed' ? 'ok' : getValue() === 'pending' ? 'warn' : 'danger'}>{String(getValue())}</Chip> },
    { header: 'Date', accessorKey: 'createdAt', cell: ({ getValue }) => <span className="text-ink-lo">{formatDateTime(String(getValue()), lang)}</span> },
  ], [lang]);

  return (
    <>
      <PageHeader title="Transaction Logs" subtitle={`${rows.length} entries`} icon={<ReceiptText className="h-5 w-5" />} />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="w-44">
          <select
            value={type}
            onChange={(e) => setType(e.target.value as (typeof TYPES)[number])}
            className="h-10 w-full rounded-lg border border-brand-divider bg-brand-paper px-3 text-sm text-brand-ink"
          >
            {TYPES.map((tp) => (
              <option key={tp} value={tp}>{tp}</option>
            ))}
          </select>
        </div>
        <Button size="sm" variant="ghost" leftIcon={<RefreshCw className="h-3.5 w-3.5" />} onClick={() => load(type)} loading={refreshing}>Refresh</Button>
      </div>

      {error ? <Card padding="md" className="mb-4"><p className="text-sm text-signal-danger">{error}</p></Card> : null}

      {loading ? (
        <Card padding="lg"><p className="text-sm text-ink-mid">Loading...</p></Card>
      ) : (
        <DataTable columns={columns} data={rows} searchPlaceholder="Search reference, user, type" pageSize={12} />
      )}
    </>
  );
}
