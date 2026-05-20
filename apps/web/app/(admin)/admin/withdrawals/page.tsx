'use client';

import { useMemo, useState } from 'react';
import { PageHeader } from '@/components/site/PageHeader';
import { DataTable } from '@/components/ui/DataTable';
import { ApprovalModal } from '@/components/admin/ApprovalModal';
import { Chip } from '@/components/ui/Chip';
import { Button } from '@/components/ui/Button';
import { mockWithdrawals } from '@/lib/mock/deposits';
import { formatBDT, formatDateTime } from '@/lib/utils/format';
import { useLang } from '@/lib/i18n/context';
import { ArrowUpToLine, CheckCircle2, XCircle } from 'lucide-react';
import type { Withdrawal } from '@/types';
import type { ColumnDef } from '@tanstack/react-table';

export default function AdminWithdrawalsPage() {
  const { lang } = useLang();
  const [item, setItem] = useState<Withdrawal | null>(null);
  const [action, setAction] = useState<'approve' | 'reject' | null>(null);
  const [open, setOpen] = useState(false);

  const columns = useMemo<ColumnDef<Withdrawal>[]>(() => [
    { header: 'User', accessorKey: 'username', cell: ({ getValue }) => <span className="text-ink-hi">{String(getValue())}</span> },
    { header: 'Amount', accessorKey: 'amount', cell: ({ getValue }) => <span className="font-semibold text-signal-warn">{formatBDT(Number(getValue()))}</span> },
    { header: 'Method', accessorKey: 'method', cell: ({ getValue }) => <span className="text-ink-mid">{String(getValue())}</span> },
    { header: 'Account', accessorKey: 'accountNumber', cell: ({ row }) => <div><p className="text-ink-mid">{row.original.accountName}</p><code className="font-mono text-xs text-ink-lo">{row.original.accountNumber}</code></div> },
    { header: 'Status', accessorKey: 'status', cell: ({ getValue }) => <Chip tone={getValue() === 'approved' ? 'ok' : getValue() === 'pending' ? 'warn' : 'danger'}>{String(getValue())}</Chip> },
    { header: 'Date', accessorKey: 'createdAt', cell: ({ getValue }) => <span className="text-ink-lo">{formatDateTime(String(getValue()), lang)}</span> },
    {
      header: '',
      id: 'actions',
      cell: ({ row }) => row.original.status === 'pending' ? (
        <div className="flex justify-end gap-2">
          <Button size="sm" leftIcon={<CheckCircle2 className="h-3.5 w-3.5" />} onClick={() => { setItem(row.original); setAction('approve'); setOpen(true); }}>Approve</Button>
          <Button size="sm" variant="danger" leftIcon={<XCircle className="h-3.5 w-3.5" />} onClick={() => { setItem(row.original); setAction('reject'); setOpen(true); }}>Reject</Button>
        </div>
      ) : <span className="text-xs text-ink-lo">Resolved</span>,
    },
  ], [lang]);

  return (
    <>
      <PageHeader title="Withdrawal Approval" subtitle={`${mockWithdrawals.filter((w) => w.status === 'pending').length} pending`} icon={<ArrowUpToLine className="h-5 w-5" />} />
      <DataTable columns={columns} data={mockWithdrawals} searchPlaceholder="Search by user or account" searchKey="username" />
      <ApprovalModal
        open={open}
        onOpenChange={setOpen}
        action={action}
        title={`${action === 'approve' ? 'Approve' : 'Reject'} Withdrawal`}
        amount={item?.amount ?? 0}
        summary={item ? [
          { label: 'User', value: item.username },
          { label: 'Method', value: item.method },
          { label: 'Account', value: `${item.accountName} · ${item.accountNumber}` },
          { label: 'Submitted', value: formatDateTime(item.createdAt, lang) },
        ] : []}
        onConfirm={(note) => console.info(`${action} withdrawal`, item?.id, note)}
      />
    </>
  );
}
