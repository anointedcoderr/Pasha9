// Built by Anointed Coder.
'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { PageHeader } from '@/components/site/PageHeader';
import { DataTable } from '@/components/ui/DataTable';
import { ApprovalModal } from '@/components/admin/ApprovalModal';
import { Chip } from '@/components/ui/Chip';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { Modal, Drawer } from '@/components/ui/Modal';
import { FormField, Input, Textarea } from '@/components/ui/Input';
import { formatBDT, formatDateTime } from '@/lib/utils/format';
import { useLang } from '@/lib/i18n/context';
import { ArrowUpToLine, CheckCircle2, XCircle, BanknoteIcon, PauseCircle, PlayCircle, History, Eye } from 'lucide-react';
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
  processingState: 'on_hold' | 'payout_initiated' | 'paid' | null;
  providerKey: string | null;
  providerRef: string | null;
  paidAt: string | null;
  adminNote?: string | null;
  reviewedAt?: string | null;
  createdAt: string;
}

interface TimelineEvent {
  id: string;
  kind: string;
  actorId: string | null;
  actorRole: string | null;
  note: string | null;
  createdAt: string;
}

interface DetailPayload {
  events: TimelineEvent[];
  withdrawal: WithdrawalRow & { events?: TimelineEvent[] };
}

interface Toast { kind: 'ok' | 'err'; text: string }

function processingChip(state: WithdrawalRow['processingState']) {
  if (!state) return null;
  if (state === 'paid') return <Chip tone="ok">paid</Chip>;
  if (state === 'on_hold') return <Chip tone="warn">on hold</Chip>;
  if (state === 'payout_initiated') return <Chip tone="info">payout initiated</Chip>;
  return null;
}

export default function AdminWithdrawalsPage() {
  const { lang } = useLang();
  const [rows, setRows] = useState<WithdrawalRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [item, setItem] = useState<WithdrawalRow | null>(null);
  const [action, setAction] = useState<'approve' | 'reject' | null>(null);
  const [approvalOpen, setApprovalOpen] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);

  const [paidTarget, setPaidTarget] = useState<WithdrawalRow | null>(null);
  const [paidBusy, setPaidBusy] = useState(false);
  const [paidProviderRef, setPaidProviderRef] = useState('');
  const [paidNote, setPaidNote] = useState('');
  const [paidProviderKey, setPaidProviderKey] = useState('manual');

  const [drawerId, setDrawerId] = useState<string | null>(null);
  const [drawerData, setDrawerData] = useState<DetailPayload['withdrawal'] | null>(null);
  const [drawerLoading, setDrawerLoading] = useState(false);

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

  // Load the detail drawer when a row is selected.
  useEffect(() => {
    if (!drawerId) { setDrawerData(null); return; }
    let alive = true;
    setDrawerLoading(true);
    fetch(`/api/admin/withdrawals/${drawerId}`, { cache: 'no-store' })
      .then((r) => r.json().then((b) => ({ ok: r.ok, body: b })))
      .then(({ ok, body }) => {
        if (!alive) return;
        if (!ok) {
          setToast({ kind: 'err', text: body?.message ?? body?.code ?? 'Failed' });
          return;
        }
        setDrawerData(body.withdrawal as DetailPayload['withdrawal']);
      })
      .finally(() => { if (alive) setDrawerLoading(false); });
    return () => { alive = false; };
  }, [drawerId]);

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
            ? `Approved ${formatBDT(item.amount)} for ${item.username}. Wallet debited. Mark Paid when payout settles.`
            : `Rejected ${item.username} ${formatBDT(item.amount)}.`,
      });
      setTimeout(() => setToast(null), 4500);
      await refresh();
    } catch (e) {
      setToast({ kind: 'err', text: e instanceof Error ? e.message : 'Action failed' });
      setTimeout(() => setToast(null), 4500);
    }
  };

  const toggleHold = async (row: WithdrawalRow, hold: boolean) => {
    try {
      const res = await fetch(`/api/admin/withdrawals/${row.id}/hold`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ hold }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message ?? data?.code ?? 'Action failed');
      setToast({ kind: 'ok', text: hold ? `Held ${row.username}.` : `Released ${row.username}.` });
      setTimeout(() => setToast(null), 4500);
      await refresh();
    } catch (e) {
      setToast({ kind: 'err', text: e instanceof Error ? e.message : 'Action failed' });
      setTimeout(() => setToast(null), 4500);
    }
  };

  const submitMarkPaid = async () => {
    if (!paidTarget) return;
    setPaidBusy(true);
    try {
      const res = await fetch(`/api/admin/withdrawals/${paidTarget.id}/mark-paid`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          providerKey: paidProviderKey || 'manual',
          providerRef: paidProviderRef.trim() || undefined,
          note: paidNote.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message ?? data?.code ?? 'Mark-paid failed');
      setToast({ kind: 'ok', text: `Marked paid: ${paidTarget.username} ${formatBDT(paidTarget.amount)}.` });
      setTimeout(() => setToast(null), 4500);
      setPaidTarget(null);
      setPaidProviderRef('');
      setPaidNote('');
      setPaidProviderKey('manual');
      await refresh();
    } catch (e) {
      setToast({ kind: 'err', text: e instanceof Error ? e.message : 'Mark-paid failed' });
      setTimeout(() => setToast(null), 4500);
    } finally {
      setPaidBusy(false);
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
      { header: 'Status', accessorKey: 'status', cell: ({ row }) => {
          const v = row.original.status;
          return (
            <div className="flex flex-col gap-1">
              <Chip tone={v === 'approved' ? 'ok' : v === 'pending' ? 'warn' : 'danger'}>{v}</Chip>
              {processingChip(row.original.processingState)}
            </div>
          );
        } },
      { header: 'Date', accessorKey: 'createdAt', cell: ({ getValue }) => <span className="text-ink-lo">{formatDateTime(String(getValue()), lang)}</span> },
      {
        header: '',
        id: 'actions',
        cell: ({ row }) => {
          const r = row.original;
          return (
            <div className="flex flex-wrap justify-end gap-1.5">
              <Button size="sm" variant="ghost" leftIcon={<Eye className="h-3 w-3" />} onClick={() => setDrawerId(r.id)}>Detail</Button>
              {r.status === 'pending' ? (
                <>
                  {r.processingState === 'on_hold' ? (
                    <Button size="sm" variant="neon" leftIcon={<PlayCircle className="h-3 w-3" />} onClick={() => toggleHold(r, false)}>Release</Button>
                  ) : (
                    <Button size="sm" variant="neon" leftIcon={<PauseCircle className="h-3 w-3" />} onClick={() => toggleHold(r, true)}>Hold</Button>
                  )}
                  <Button size="sm" leftIcon={<CheckCircle2 className="h-3 w-3" />} onClick={() => { setItem(r); setAction('approve'); setApprovalOpen(true); }}>Approve</Button>
                  <Button size="sm" variant="danger" leftIcon={<XCircle className="h-3 w-3" />} onClick={() => { setItem(r); setAction('reject'); setApprovalOpen(true); }}>Reject</Button>
                </>
              ) : r.status === 'approved' && r.processingState !== 'paid' ? (
                <Button size="sm" variant="gold" leftIcon={<BanknoteIcon className="h-3 w-3" />} onClick={() => setPaidTarget(r)}>Mark Paid</Button>
              ) : (
                <span className="text-xs text-ink-lo">Resolved</span>
              )}
            </div>
          );
        },
      },
    ],
    [lang],
  );

  const pendingCount = rows.filter((r) => r.status === 'pending').length;
  const awaitingPayout = rows.filter((r) => r.status === 'approved' && r.processingState !== 'paid').length;

  return (
    <>
      <PageHeader
        title="Withdrawal Approval"
        subtitle={`${pendingCount} pending · ${awaitingPayout} awaiting payout`}
        icon={<ArrowUpToLine className="h-5 w-5" />}
      />

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
          Approving a withdrawal deducts the amount from the user&apos;s main wallet balance and writes a debit Transaction.
          The row moves to <code className="font-mono text-xs">processingState=payout_initiated</code>. After paying the
          user out of band (or once a payout webhook fires from M2C/M2D), click <strong>Mark Paid</strong> to close the loop.
          <strong> Hold</strong> keeps the row in the queue but flagged for investigation; <strong>Release</strong> clears it.
          Live payout-gateway automation arrives once provider credentials are configured at /admin/payouts.
        </p>
      </Card>

      {loading ? (
        <Card padding="lg">Loading...</Card>
      ) : (
        <DataTable columns={columns} data={rows} searchPlaceholder="Search by user or account" searchKey="username" />
      )}

      <ApprovalModal
        open={approvalOpen}
        onOpenChange={setApprovalOpen}
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

      <Modal open={!!paidTarget} onOpenChange={(v) => !v && setPaidTarget(null)} title="Mark Withdrawal Paid" size="md">
        {paidTarget ? (
          <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); void submitMarkPaid(); }}>
            <div className="rounded-xl border border-neon/10 bg-base-deep/40 p-3 text-sm">
              <p className="text-ink-mid">{paidTarget.username} · {paidTarget.method}</p>
              <p className="font-extrabold text-ink-hi">{formatBDT(paidTarget.amount)}</p>
              <p className="text-xs text-ink-lo">{paidTarget.accountName} · {paidTarget.accountNumber}</p>
            </div>
            <FormField label="Provider key" hint="Defaults to 'manual'. Use 'bkash', 'nagad', 'rocket' when paid via that gateway.">
              <Input value={paidProviderKey} onChange={(e) => setPaidProviderKey(e.target.value)} placeholder="manual" />
            </FormField>
            <FormField label="Provider reference (optional)" hint="The TX ID returned by the gateway / out-of-band confirmation number.">
              <Input value={paidProviderRef} onChange={(e) => setPaidProviderRef(e.target.value)} placeholder="TRX-..." />
            </FormField>
            <FormField label="Note (optional)" hint="Free text, visible in the timeline.">
              <Textarea rows={2} value={paidNote} onChange={(e) => setPaidNote(e.target.value)} />
            </FormField>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" type="button" onClick={() => setPaidTarget(null)}>Cancel</Button>
              <Button type="submit" variant="gold" loading={paidBusy}>Mark Paid</Button>
            </div>
          </form>
        ) : null}
      </Modal>

      <Drawer
        open={!!drawerId}
        onOpenChange={(v) => !v && setDrawerId(null)}
        title={drawerData ? `${drawerData.username}` : 'Loading'}
        description={drawerData ? formatBDT(drawerData.amount) : ''}
        width="480px"
      >
        {drawerLoading ? (
          <p className="text-sm text-ink-mid">Loading...</p>
        ) : !drawerData ? (
          <p className="text-sm text-ink-mid">No data.</p>
        ) : (
          <div className="space-y-4">
            <Card padding="md">
              <CardHeader title="Status" />
              <div className="flex flex-wrap items-center gap-2">
                <Chip tone={drawerData.status === 'approved' ? 'ok' : drawerData.status === 'pending' ? 'warn' : 'danger'}>{drawerData.status}</Chip>
                {processingChip(drawerData.processingState)}
                {drawerData.providerKey ? <Chip tone="info">{drawerData.providerKey}</Chip> : null}
              </div>
              {drawerData.providerRef ? (
                <p className="mt-2 text-xs text-ink-lo">Provider ref: <code className="font-mono text-ink-mid">{drawerData.providerRef}</code></p>
              ) : null}
              {drawerData.paidAt ? (
                <p className="mt-1 text-xs text-ink-lo">Paid at: {formatDateTime(drawerData.paidAt, lang)}</p>
              ) : null}
              {drawerData.adminNote ? (
                <p className="mt-2 rounded-md border border-neon/10 bg-base-deep/40 p-2 text-xs text-ink-mid">Admin note: {drawerData.adminNote}</p>
              ) : null}
            </Card>

            <Card padding="md">
              <CardHeader title="Account" />
              <p className="text-sm text-ink-hi">{drawerData.accountName}</p>
              <code className="font-mono text-xs text-ink-lo">{drawerData.accountNumber}</code>
              <p className="mt-1 text-xs text-ink-mid">via {drawerData.method}</p>
            </Card>

            <Card padding="md">
              <CardHeader title="Timeline" subtitle="Every state change ever applied to this withdrawal." />
              {drawerData.events && drawerData.events.length > 0 ? (
                <ol className="relative ml-2 space-y-3 border-l border-neon/15 pl-4">
                  {drawerData.events.map((ev) => (
                    <li key={ev.id} className="relative">
                      <span className="absolute -left-[19px] top-1.5 flex h-3 w-3 items-center justify-center rounded-full border-2 border-base-deep bg-gold-500/80">
                        <History className="h-2 w-2" />
                      </span>
                      <p className="text-xs font-bold uppercase tracking-wider text-gold-300">{ev.kind}</p>
                      <p className="text-xs text-ink-lo">{formatDateTime(ev.createdAt, lang)} · {ev.actorRole ?? 'system'}</p>
                      {ev.note ? <p className="mt-0.5 text-sm text-ink-mid">{ev.note}</p> : null}
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="text-sm text-ink-mid">No events recorded yet.</p>
              )}
            </Card>
          </div>
        )}
      </Drawer>
    </>
  );
}
