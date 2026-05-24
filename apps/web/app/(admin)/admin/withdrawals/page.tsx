// Built by Anointed Coder.
'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { PageHeader } from '@/components/site/PageHeader';
import { DataTable } from '@/components/ui/DataTable';
import { ApprovalModal } from '@/components/admin/ApprovalModal';
import { Chip } from '@/components/ui/Chip';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { formatBDT, formatDateTime } from '@/lib/utils/format';
import { useLang } from '@/lib/i18n/context';
import { ArrowUpToLine, CheckCircle2, XCircle } from 'lucide-react';
import type { ColumnDef } from '@tanstack/react-table';

interface WithdrawalRow {
  id: string;
  userId: string;
  username: string;
  phone: string;
  amount: number;
  method: string;
  accountNumber: string;
  accountName: string;
  status: 'pending' | 'approved' | 'rejected';
  adminNote?: string | null;
  reviewedAt?: string | null;
  createdAt: string;
}

interface Toast { kind: 'ok' | 'err'; text: string }

export default function AdminWithdrawalsPage() {
  const { lang } = useLang();
  const [rows, setRows] = useState<WithdrawalRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [item, setItem] = useState<WithdrawalRow | null>(null);
  const [action, setAction] = useState<'approve' | 'reject' | null>(null);
  const [open, setOpen] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch('/api/admin/withdrawals?take=200', { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message ?? data?.code ?? 'Failed');
      setRows(data.withdrawals as WithdrawalRow[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load withdrawals');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const confirm = async (note: string) => {
    if (!item || !action) return;
    try {
      const res = await fetch(`/api/admin/withdrawals/${item.id}/${action}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ adminNote: note || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message ?? data?.code ?? 'Action failed');
      setToast({
        kind: 'ok',
        text:
          action === 'approve'
            ? `Approved ${formatBDT(item.amount)} for ${item.username}. Wallet debited.`
            : `Rejected ${item.username} ${formatBDT(item.amount)}.`,
      });
      setTimeout(() => setToast(null), 4500);
      await refresh();
    } catch (e) {
      setToast({ kind: 'err', text: e instanceof Error ? e.message : 'Action failed' });
      setTimeout(() => setToast(null), 4500);
    }
  };

  const columns = useMemo<ColumnDef<WithdrawalRow>[]>(
    () => [
      { header: 'User', accessorKey: 'username', cell: ({ row }) => (
          <div>
            <p className="font-semibold text-ink-hi">{row.original.username}</p>
            <p className="font-mono text-[11px] text-ink-lo">{row.original.phone}</p>
          </div>
        ) },
      { header: 'Amount', accessorKey: 'amount', cell: ({ getValue }) => <span className="font-semibold text-signal-warn">{formatBDT(Number(getValue()))}</span> },
      { header: 'Method', accessorKey: 'method', cell: ({ getValue }) => <span className="text-ink-mid">{String(getValue())}</span> },
      { header: 'Account', accessorKey: 'accountNumber', cell: ({ row }) => (
          <div>
            <p className="text-ink-mid">{row.original.accountName}</p>
            <code className="font-mono text-xs text-ink-lo">{row.original.accountNumber}</code>
          </div>
        ) },
      { header: 'Status', accessorKey: 'status', cell: ({ getValue }) => {
          const v = String(getValue());
          return <Chip tone={v === 'approved' ? 'ok' : v === 'pending' ? 'warn' : 'danger'}>{v}</Chip>;
        } },
      { header: 'Date', accessorKey: 'createdAt', cell: ({ getValue }) => <span className="text-ink-lo">{formatDateTime(String(getValue()), lang)}</span> },
      {
        header: '',
        id: 'actions',
        cell: ({ row }) =>
          row.original.status === 'pending' ? (
            <div className="flex justify-end gap-2">
              <Button size="sm" leftIcon={<CheckCircle2 className="h-3.5 w-3.5" />} onClick={() => { setItem(row.original); setAction('approve'); setOpen(true); }}>Approve</Button>
              <Button size="sm" variant="danger" leftIcon={<XCircle className="h-3.5 w-3.5" />} onClick={() => { setItem(row.original); setAction('reject'); setOpen(true); }}>Reject</Button>
            </div>
          ) : (
            <span className="text-xs text-ink-lo">Resolved</span>
          ),
      },
    ],
    [lang],
  );

  const pendingCount = rows.filter((r) => r.status === 'pending').length;

  return (
    <>
      <PageHeader title="Withdrawal Approval" subtitle={`${pendingCount} pending`} icon={<ArrowUpToLine className="h-5 w-5" />} />

      {toast ? (
        <Card padding="md" className="mb-4">
          <p className={toast.kind === 'ok' ? 'text-sm text-signal-ok' : 'text-sm text-signal-danger'}>{toast.text}</p>
        </Card>
      ) : null}

      {error ? (
        <Card padding="md" className="mb-4">
          <p className="text-sm text-signal-danger">{error}</p>
        </Card>
      ) : null}

      <Card padding="md" className="mb-4">
        <p className="text-xs text-ink-mid">
          Approving a withdrawal deducts the amount from the user&apos;s main wallet balance and writes a debit
          Transaction. Payout itself is handled out of band per M1 (live payout-gateway automation ships in
          Milestone 2). Rejecting only flips the row, no wallet change.
        </p>
      </Card>

      {loading ? (
        <Card padding="lg">Loading...</Card>
      ) : (
        <DataTable columns={columns} data={rows} searchPlaceholder="Search by user or account" searchKey="username" />
      )}

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
        onConfirm={(note) => { void confirm(note); }}
      />
    </>
  );
}
