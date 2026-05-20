'use client';

import { useMemo } from 'react';
import { PageHeader } from '@/components/site/PageHeader';
import { DataTable } from '@/components/ui/DataTable';
import { Chip } from '@/components/ui/Chip';
import { mockTransactions } from '@/lib/mock/transactions';
import { formatBDT, formatDateTime } from '@/lib/utils/format';
import { useLang } from '@/lib/i18n/context';
import { ReceiptText } from 'lucide-react';
import type { Transaction } from '@/types';
import type { ColumnDef } from '@tanstack/react-table';

export default function AdminTransactionsPage() {
  const { lang } = useLang();

  const columns = useMemo<ColumnDef<Transaction>[]>(() => [
    { header: 'Reference', accessorKey: 'reference', cell: ({ getValue }) => <code className="font-mono text-xs text-ink-mid">{String(getValue())}</code> },
    { header: 'User', accessorKey: 'username', cell: ({ getValue }) => <span className="text-ink-hi">{String(getValue())}</span> },
    { header: 'Type', accessorKey: 'type', cell: ({ getValue }) => <span className="capitalize text-ink-mid">{String(getValue())}</span> },
    { header: 'Amount', accessorKey: 'amount', cell: ({ getValue }) => {
      const v = Number(getValue());
      return <span className={v > 0 ? 'tabular-nums text-neon' : 'tabular-nums text-signal-danger'}>{formatBDT(v, { sign: true })}</span>;
    } },
    { header: 'Status', accessorKey: 'status', cell: ({ getValue }) => <Chip tone={getValue() === 'completed' ? 'ok' : getValue() === 'pending' ? 'warn' : 'danger'}>{String(getValue())}</Chip> },
    { header: 'Date', accessorKey: 'createdAt', cell: ({ getValue }) => <span className="text-ink-lo">{formatDateTime(String(getValue()), lang)}</span> },
  ], [lang]);

  return (
    <>
      <PageHeader title="Transaction Logs" subtitle={`${mockTransactions.length} entries on file`} icon={<ReceiptText className="h-5 w-5" />} />
      <DataTable columns={columns} data={mockTransactions} searchPlaceholder="Search reference, user, type" pageSize={12} />
    </>
  );
}
