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
import { ArrowDownToLine, CheckCircle2, XCircle, Ticket, BadgeDollarSign } from 'lucide-react';
import type { ColumnDef } from '@tanstack/react-table';

interface DepositRow {
  id: string;
  userId: string;
  username: string;
  phone: string;
  amount: number;
  method: string;
  transactionId: string;
  proofUrl?: string | null;
  status: 'pending' | 'approved' | 'rejected';
  adminNote?: string | null;
  reviewerId?: string | null;
  reviewedAt?: string | null;
  createdAt: string;
}

interface ToastState {
  kind: 'ok' | 'err';
  text: string;
}

export default function AdminDepositsPage() {
  const { lang } = useLang();
  const [rows, setRows] = useState<DepositRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [item, setItem] = useState<DepositRow | null>(null);
  const [action, setAction] = useState<'approve' | 'reject' | null>(null);
  const [open, setOpen] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch('/api/admin/deposits?take=200', { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message ?? data?.code ?? 'Failed');
      setRows(data.deposits as DepositRow[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load deposits');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const confirm = async (note: string) => {
    if (!item || !action) return;
    const url = `/api/admin/deposits/${item.id}/${action}`;
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ adminNote: note || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message ?? data?.code ?? 'Action failed');
      if (action === 'approve') {
        const generated = data?.accrual?.generated ?? 0;
        const bonus = data?.bonuses ?? null;
        const parts: string[] = [`Approved ${formatBDT(item.amount)} for ${item.username}.`];
        if (generated > 0) parts.push(`${generated} lottery ticket${generated === 1 ? '' : 's'}.`);
        if (bonus?.bonusApplied) {
          parts.push(`Bonus +${formatBDT(Number(bonus.bonusAmount ?? 0))} (${bonus.bonusRuleName ?? bonus.bonusRuleCode ?? 'rule'}).`);
        } else if (bonus && bonus.candidateCount > 0) {
          parts.push(`No bonus: ${bonus.bonusSkippedReason ?? 'no_eligible_rule'}.`);
        } else if (bonus) {
          parts.push('No bonus rules configured.');
        }
        const comm = data?.commissions ?? null;
        if (comm?.count > 0) {
          parts.push(`Commissions ${formatBDT(Number(comm.total ?? 0))} across ${comm.count} affiliate${comm.count === 1 ? '' : 's'}.`);
        } else if (comm?.chainDepth > 0) {
          parts.push('No commission: upline not an active affiliate.');
        }
        setToast({ kind: 'ok', text: parts.join(' ') });
      } else {
        setToast({ kind: 'ok', text: `Rejected ${item.username} ${formatBDT(item.amount)}.` });
      }
      setTimeout(() => setToast(null), 4500);
      await refresh();
    } catch (e) {
      setToast({ kind: 'err', text: e instanceof Error ? e.message : 'Action failed' });
      setTimeout(() => setToast(null), 4500);
    }
  };

  const backfillCommission = async (row: DepositRow) => {
    if (!confirm(`Backfill affiliate commission for this deposit (${formatBDT(row.amount)} from ${row.username})? This walks the referral chain and writes commission rows at the current tier rates. Refuses if commissions already exist.`)) return;
    try {
      const res = await fetch(`/api/admin/affiliate/backfill/${row.id}`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        if (data?.code === 'ALREADY_ACCRUED') {
          throw new Error(data.message ?? 'Commissions already exist for this deposit.');
        }
        if (data?.code === 'DEPOSIT_NOT_APPROVED') {
          throw new Error(data.message ?? 'Deposit is not approved.');
        }
        throw new Error(data?.message ?? data?.code ?? 'Backfill failed');
      }
      const c = data?.commissions ?? { count: 0, total: 0, chainDepth: 0 };
      const msg = c.count > 0
        ? `Backfilled ${c.count} commission row${c.count === 1 ? '' : 's'} totalling ${formatBDT(Number(c.total ?? 0))}.`
        : `No commission accrued. Upline depth=${c.chainDepth}. ${c.error ?? 'See activity log for skip reasons.'}`;
      setToast({ kind: 'ok', text: msg });
      setTimeout(() => setToast(null), 6000);
    } catch (e) {
      setToast({ kind: 'err', text: e instanceof Error ? e.message : 'Backfill failed' });
      setTimeout(() => setToast(null), 5000);
    }
  };

  const columns = useMemo<ColumnDef<DepositRow>[]>(
    () => [
      { header: 'User', accessorKey: 'username', cell: ({ row }) => (
          <div>
            <p className="font-semibold text-ink-hi">{row.original.username}</p>
            <p className="font-mono text-[11px] text-ink-lo">{row.original.phone}</p>
          </div>
        ) },
      { header: 'Amount', accessorKey: 'amount', cell: ({ getValue }) => <span className="font-semibold text-gradient-gold">{formatBDT(Number(getValue()))}</span> },
      { header: 'Method', accessorKey: 'method', cell: ({ getValue }) => <span className="text-ink-mid">{String(getValue())}</span> },
      { header: 'TX ID', accessorKey: 'transactionId', cell: ({ getValue }) => <code className="font-mono text-xs text-ink-mid">{String(getValue())}</code> },
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
          ) : row.original.status === 'approved' ? (
            <div className="flex justify-end">
              <Button
                size="sm"
                variant="ghost"
                leftIcon={<BadgeDollarSign className="h-3.5 w-3.5" />}
                title="Retro-accrue affiliate commission for this deposit. Use after fixing the upline tier."
                onClick={() => backfillCommission(row.original)}
              >
                Backfill commission
              </Button>
            </div>
          ) : (
            <span className="text-xs text-ink-lo">Rejected</span>
          ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lang],
  );

  const pendingCount = rows.filter((r) => r.status === 'pending').length;

  return (
    <>
      <PageHeader
        title="Deposit Management"
        subtitle={`${pendingCount} pending`}
        icon={<ArrowDownToLine className="h-5 w-5" />}
      />

      {toast ? (
        <Card padding="md" className="mb-4">
          <p className={toast.kind === 'ok' ? 'flex items-center gap-2 text-sm text-signal-ok' : 'text-sm text-signal-danger'}>
            {toast.kind === 'ok' ? <Ticket className="h-4 w-4" /> : null}
            {toast.text}
          </p>
        </Card>
      ) : null}

      {error ? (
        <Card padding="md" className="mb-4">
          <p className="text-sm text-signal-danger">{error}</p>
        </Card>
      ) : null}

      <Card padding="md" className="mb-4">
        <p className="text-xs text-ink-mid">
          Approving a deposit credits the user&apos;s main wallet and generates lottery tickets at the rate of
          <span className="font-semibold text-ink-hi"> {' '}2 tickets per BDT 1,200{' '}</span>
          of accumulated approved deposits. Settle today&apos;s draw from the Lotto page once the 7:30 PM number is drawn.
        </p>
      </Card>

      {loading ? (
        <Card padding="lg">Loading...</Card>
      ) : (
        <DataTable columns={columns} data={rows} searchPlaceholder="Search by user or TX ID" searchKey="username" />
      )}

      <ApprovalModal
        open={open}
        onOpenChange={setOpen}
        action={action}
        title={`${action === 'approve' ? 'Approve' : 'Reject'} Deposit`}
        amount={item?.amount ?? 0}
        summary={item ? [
          { label: 'User', value: item.username },
          { label: 'Phone', value: item.phone },
          { label: 'Method', value: item.method },
          { label: 'TX ID', value: item.transactionId },
          { label: 'Submitted', value: formatDateTime(item.createdAt, lang) },
        ] : []}
        onConfirm={(note) => { void confirm(note); }}
      />
    </>
  );
}
