// Built by Anointed Coder.
'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { PageHeader } from '@/components/site/PageHeader';
import { DataTable } from '@/components/ui/DataTable';
import { Card, CardHeader } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { Button } from '@/components/ui/Button';
import { Drawer, Modal } from '@/components/ui/Modal';
import { FormField, Textarea } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { formatDate } from '@/lib/utils/format';
import { useLang } from '@/lib/i18n/context';
import { Briefcase, CheckCircle2, XCircle, RefreshCw, Ban, Sparkles } from 'lucide-react';
import type { ColumnDef } from '@tanstack/react-table';

interface AdminAffiliateRow {
  id: string;
  status: 'pending' | 'approved' | 'rejected';
  channel?: string | null;
  audience?: string | null;
  notes?: string | null;
  reviewedAt?: string | null;
  createdAt: string;
  user: {
    id: string;
    username: string;
    phone: string;
    referralCode: string;
    isAffiliate: boolean;
    affiliateTier?: { id: string; name: string } | null;
    _count: { referrals: number };
  };
}

interface TierLite {
  id: string;
  name: string;
}

export default function AdminAffiliatePage() {
  const { lang } = useLang();
  const [rows, setRows] = useState<AdminAffiliateRow[]>([]);
  const [tiers, setTiers] = useState<TierLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [drawerRow, setDrawerRow] = useState<AdminAffiliateRow | null>(null);
  const [pendingAction, setPendingAction] = useState<{ row: AdminAffiliateRow; action: 'approve' | 'reject' | 'suspend' | 'activate' | 'reset' } | null>(null);
  const [actionNotes, setActionNotes] = useState('');
  const [actionTierId, setActionTierId] = useState<string>('');
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const url = statusFilter === 'all' ? '/api/admin/affiliate' : `/api/admin/affiliate?status=${statusFilter}`;
      const res = await fetch(url, { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? data.code);
      setRows((data.applications ?? []) as AdminAffiliateRow[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => {
    fetch('/api/admin/affiliate/tiers')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { if (Array.isArray(data?.tiers)) setTiers(data.tiers.map((t: TierLite) => ({ id: t.id, name: t.name }))); })
      .catch(() => {});
  }, []);

  const columns = useMemo<ColumnDef<AdminAffiliateRow>[]>(() => [
    {
      header: 'User',
      accessorFn: (r) => r.user.username,
      cell: ({ row }) => (
        <div>
          <p className="font-medium text-ink-hi">{row.original.user.username}</p>
          <p className="text-xs text-ink-lo">{row.original.user.phone}</p>
        </div>
      ),
    },
    {
      header: 'Referral code',
      accessorFn: (r) => r.user.referralCode,
      cell: ({ row }) => <code className="font-mono text-xs text-ink-mid">{row.original.user.referralCode}</code>,
    },
    {
      header: 'Channel',
      accessorFn: (r) => r.channel ?? '-',
      cell: ({ row }) => <span className="text-ink-mid">{row.original.channel ?? '-'}</span>,
    },
    {
      header: 'Tier',
      accessorFn: (r) => r.user.affiliateTier?.name ?? '-',
      cell: ({ row }) => <Chip>{row.original.user.affiliateTier?.name ?? '-'}</Chip>,
    },
    {
      header: 'Referrals',
      accessorFn: (r) => r.user._count.referrals,
      cell: ({ row }) => <span className="tabular-nums text-ink-mid">{row.original.user._count.referrals}</span>,
    },
    {
      header: 'Status',
      accessorKey: 'status',
      cell: ({ row }) => {
        const s = row.original.status;
        const tone = s === 'approved' ? 'ok' : s === 'rejected' ? 'danger' : 'warn';
        return <Chip tone={tone}>{s}</Chip>;
      },
    },
    {
      header: 'Applied',
      accessorKey: 'createdAt',
      cell: ({ row }) => <span className="text-ink-lo">{formatDate(row.original.createdAt, lang)}</span>,
    },
    {
      header: '',
      id: 'actions',
      cell: ({ row }) => (
        <div className="flex justify-end">
          <Button size="sm" variant="ghost" onClick={() => setDrawerRow(row.original)}>View</Button>
        </div>
      ),
    },
  ], [lang]);

  const filters = [
    { key: 'all', label: 'All' },
    { key: 'pending', label: 'Pending' },
    { key: 'approved', label: 'Approved' },
    { key: 'rejected', label: 'Rejected' },
  ] as const;

  const runAction = async () => {
    if (!pendingAction) return;
    setBusy(true);
    try {
      const payload: Record<string, unknown> = { action: pendingAction.action };
      if (pendingAction.action === 'approve' || pendingAction.action === 'activate') {
        if (actionTierId) payload.tierId = actionTierId;
      }
      if (pendingAction.action === 'reject' && actionNotes.trim()) {
        payload.notes = actionNotes.trim();
      }
      const res = await fetch(`/api/admin/affiliate/${pendingAction.row.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? data.code);
      setPendingAction(null);
      setActionNotes('');
      setActionTierId('');
      setDrawerRow(null);
      await refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Action failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Affiliate Management"
        subtitle="Applications, approvals, status and tier assignment"
        icon={<Briefcase className="h-5 w-5" />}
        action={
          <div className="flex gap-2">
            <Link href="/admin/affiliate/payouts"><Button variant="ghost">Payout requests</Button></Link>
            <Link href="/admin/affiliate/tiers"><Button variant="ghost">Manage tiers</Button></Link>
          </div>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {filters.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setStatusFilter(f.key)}
            className={
              'inline-flex h-9 items-center rounded-pill border px-4 text-sm transition ' +
              (statusFilter === f.key
                ? 'border-neon/40 bg-neon/10 text-ink-hi'
                : 'border-neon/15 bg-base-deep/40 text-ink-mid hover:text-ink-hi')
            }
          >
            {f.label}
          </button>
        ))}
      </div>

      {error ? <Card padding="md" className="mb-4"><p className="text-sm text-signal-danger">{error}</p></Card> : null}

      {loading ? (
        <Card padding="lg">Loading...</Card>
      ) : (
        <DataTable
          columns={columns}
          data={rows}
          searchPlaceholder="Search username, phone, code"
          searchKey={'user' as never}
        />
      )}

      <Drawer open={!!drawerRow} onOpenChange={(v) => { if (!v) setDrawerRow(null); }} title={drawerRow ? drawerRow.user.username : ''} description="Affiliate application detail" width="460px">
        {drawerRow ? (
          <div className="space-y-4">
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <Field label="Status" value={<Chip tone={drawerRow.status === 'approved' ? 'ok' : drawerRow.status === 'rejected' ? 'danger' : 'warn'}>{drawerRow.status}</Chip>} />
              <Field label="Channel" value={drawerRow.channel ?? '-'} />
              <Field label="Audience" value={drawerRow.audience ?? '-'} />
              <Field label="Phone" value={drawerRow.user.phone} />
              <Field label="Referral code" value={<code className="font-mono">{drawerRow.user.referralCode}</code>} />
              <Field label="Tier" value={drawerRow.user.affiliateTier?.name ?? '-'} />
              <Field label="Direct referrals" value={drawerRow.user._count.referrals.toString()} />
              <Field label="Applied" value={formatDate(drawerRow.createdAt, lang)} />
            </dl>

            {drawerRow.notes ? (
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-lo">Applicant notes</p>
                <p className="mt-1 rounded-lg border border-neon/10 bg-base-deep/40 p-3 text-sm text-ink-mid">{drawerRow.notes}</p>
              </div>
            ) : null}

            <div className="grid grid-cols-2 gap-2 pt-2">
              {drawerRow.status === 'pending' || drawerRow.status === 'rejected' ? (
                <Button variant="gold" leftIcon={<CheckCircle2 className="h-4 w-4" />} onClick={() => { setPendingAction({ row: drawerRow, action: 'approve' }); setActionTierId(drawerRow.user.affiliateTier?.id ?? ''); }}>
                  Approve
                </Button>
              ) : null}
              {drawerRow.status === 'pending' || drawerRow.status === 'approved' ? (
                <Button variant="danger" leftIcon={<XCircle className="h-4 w-4" />} onClick={() => { setPendingAction({ row: drawerRow, action: 'reject' }); }}>
                  Reject
                </Button>
              ) : null}
              {drawerRow.user.isAffiliate ? (
                <Button variant="ghost" leftIcon={<Ban className="h-4 w-4" />} onClick={() => setPendingAction({ row: drawerRow, action: 'suspend' })}>
                  Suspend
                </Button>
              ) : drawerRow.status === 'approved' ? (
                <Button variant="neon" leftIcon={<Sparkles className="h-4 w-4" />} onClick={() => { setPendingAction({ row: drawerRow, action: 'activate' }); setActionTierId(drawerRow.user.affiliateTier?.id ?? ''); }}>
                  Reactivate
                </Button>
              ) : null}
              <Button variant="ghost" leftIcon={<RefreshCw className="h-4 w-4" />} onClick={() => setPendingAction({ row: drawerRow, action: 'reset' })}>
                Reset to pending
              </Button>
            </div>
          </div>
        ) : null}
      </Drawer>

      <Modal
        open={!!pendingAction}
        onOpenChange={(v) => { if (!v) { setPendingAction(null); setActionNotes(''); setActionTierId(''); } }}
        title={pendingAction ? actionTitle(pendingAction.action) : ''}
        description={pendingAction ? `User: ${pendingAction.row.user.username}` : ''}
      >
        {pendingAction ? (
          <div className="space-y-3">
            {(pendingAction.action === 'approve' || pendingAction.action === 'activate') ? (
              <FormField label="Assign commission tier (optional)">
                <Select value={actionTierId} onChange={(e) => setActionTierId(e.target.value)}>
                  <option value="">- Keep current -</option>
                  {tiers.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </Select>
              </FormField>
            ) : null}

            {pendingAction.action === 'reject' ? (
              <FormField label="Reason (optional, saved on the application)">
                <Textarea rows={3} value={actionNotes} onChange={(e) => setActionNotes(e.target.value)} placeholder="Reason visible to the applicant if you reach out later" />
              </FormField>
            ) : null}

            <CardHeader title="Audit" subtitle="This action writes an ActivityLog entry with your admin id and IP." />

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={() => { setPendingAction(null); setActionNotes(''); setActionTierId(''); }}>Cancel</Button>
              <Button variant={pendingAction.action === 'reject' || pendingAction.action === 'suspend' ? 'danger' : 'gold'} loading={busy} onClick={runAction}>
                Confirm
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>
    </>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-neon/10 bg-base-deep/40 p-3">
      <dt className="text-[11px] uppercase tracking-wider text-ink-lo">{label}</dt>
      <dd className="mt-1 text-ink-hi">{value}</dd>
    </div>
  );
}

function actionTitle(a: string) {
  if (a === 'approve') return 'Approve application';
  if (a === 'reject') return 'Reject application';
  if (a === 'suspend') return 'Suspend affiliate';
  if (a === 'activate') return 'Activate affiliate';
  return 'Reset application';
}
