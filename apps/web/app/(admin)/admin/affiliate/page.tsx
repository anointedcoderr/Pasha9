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
import { FormField, Input, Textarea } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { formatDate } from '@/lib/utils/format';
import { useLang } from '@/lib/i18n/context';
import { Briefcase, CheckCircle2, XCircle, RefreshCw, Ban, Sparkles, Stethoscope, Layers } from 'lucide-react';
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
  const [pendingAction, setPendingAction] = useState<{ row: AdminAffiliateRow; action: 'approve' | 'reject' | 'suspend' | 'activate' | 'reset' | 'assign_tier' } | null>(null);
  const [actionNotes, setActionNotes] = useState('');
  const [actionTierId, setActionTierId] = useState<string>('');
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [diagnoseOpen, setDiagnoseOpen] = useState(false);

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
      if (pendingAction.action === 'approve' || pendingAction.action === 'activate' || pendingAction.action === 'assign_tier') {
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
      if (!res.ok) {
        if (data?.code === 'NO_TIER_AVAILABLE') {
          throw new Error('No active commission tier exists. Open Manage tiers and create at least one tier before approving.');
        }
        throw new Error(data.message ?? data.code ?? 'Action failed');
      }
      const tierMsg = data?.assignedTier?.name
        ? ` Tier assigned: ${data.assignedTier.name}${data.assignedTier.defaulted ? ' (defaulted, lowest active)' : ''}.`
        : '';
      setToast(`${pendingAction.action.replace('_', ' ')} done.${tierMsg}`);
      setTimeout(() => setToast(null), 5000);
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
            <Button variant="ghost" leftIcon={<Stethoscope className="h-3.5 w-3.5" />} onClick={() => setDiagnoseOpen(true)}>Diagnose</Button>
            <Link href="/admin/affiliate/payouts"><Button variant="ghost">Payout requests</Button></Link>
            <Link href="/admin/affiliate/tiers"><Button variant="ghost">Manage tiers</Button></Link>
          </div>
        }
      />

      {toast ? <Card padding="md" className="mb-4"><p className="text-sm text-signal-ok">{toast}</p></Card> : null}

      {tiers.length === 0 ? (
        <Card padding="md" className="mb-4 border border-signal-warn/40 bg-signal-warn/5">
          <p className="text-sm text-signal-warn">
            No active commission tier exists yet. Affiliate approval will fail until you create at least one tier in <Link href="/admin/affiliate/tiers" className="underline">Manage tiers</Link>.
          </p>
        </Card>
      ) : null}

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
              <Field
                label="Tier"
                value={drawerRow.user.affiliateTier?.name ? (
                  <Chip tone="ok">{drawerRow.user.affiliateTier.name}</Chip>
                ) : (
                  <Chip tone="warn">No tier - commissions will be 0</Chip>
                )}
              />
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
              {drawerRow.user.isAffiliate ? (
                <Button variant="neon" leftIcon={<Layers className="h-4 w-4" />} onClick={() => { setPendingAction({ row: drawerRow, action: 'assign_tier' }); setActionTierId(drawerRow.user.affiliateTier?.id ?? ''); }}>
                  {drawerRow.user.affiliateTier ? 'Change tier' : 'Assign tier'}
                </Button>
              ) : null}
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
              <FormField
                label="Commission tier"
                hint={
                  actionTierId
                    ? 'Selected tier will be assigned.'
                    : pendingAction.row.user.affiliateTier
                      ? `Keeping current tier: ${pendingAction.row.user.affiliateTier.name}.`
                      : tiers.length > 0
                        ? `Will default to the lowest active tier (${tiers[0]?.name}). Pick explicitly to override.`
                        : 'No active tier exists. Create one in Manage tiers first.'
                }
              >
                <Select value={actionTierId} onChange={(e) => setActionTierId(e.target.value)}>
                  <option value="">
                    {pendingAction.row.user.affiliateTier
                      ? `- Keep current (${pendingAction.row.user.affiliateTier.name}) -`
                      : tiers.length > 0
                        ? `- Default to lowest active (${tiers[0]?.name}) -`
                        : '- No tier available -'}
                  </option>
                  {tiers.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </Select>
              </FormField>
            ) : null}

            {pendingAction.action === 'assign_tier' ? (
              <FormField label="Commission tier" required hint="Affects every future deposit. Past deposits stay with their original commissions.">
                <Select value={actionTierId} onChange={(e) => setActionTierId(e.target.value)}>
                  <option value="">- Pick a tier -</option>
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
              <Button
                variant={pendingAction.action === 'reject' || pendingAction.action === 'suspend' ? 'danger' : 'gold'}
                loading={busy}
                onClick={runAction}
                disabled={pendingAction.action === 'assign_tier' && !actionTierId}
              >
                Confirm
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal open={diagnoseOpen} onOpenChange={setDiagnoseOpen} title="Affiliate Commission Diagnose" size="lg">
        <DiagnoseForm />
      </Modal>
    </>
  );
}

interface DiagnoseResult {
  sourceUserExists: boolean;
  chainDepth: number;
  evaluated: Array<{
    affiliateId: string;
    level: number;
    isAffiliate: boolean;
    tierName: string | null;
    ratePct: number | null;
    payoutAmount: number;
    eligible: boolean;
    reason: string | null;
  }>;
}

function DiagnoseForm() {
  const [userId, setUserId] = useState('');
  const [amount, setAmount] = useState(1000);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<DiagnoseResult | null>(null);

  const run = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch('/api/admin/affiliate/diagnose', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ userId: userId.trim(), amount: Number(amount) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message ?? data?.code ?? 'Diagnose failed');
      setResult(data as DiagnoseResult);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Diagnose failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-xs text-ink-mid">
        Dry-run the commission engine for a downline user + deposit amount. Use this to verify the upline chain, tier assignments and per-level rates BEFORE approving real money. Nothing is written.
      </p>
      <form className="grid gap-3 md:grid-cols-2" onSubmit={run}>
        <FormField label="Downline user id" required>
          <Input value={userId} onChange={(e) => setUserId(e.target.value)} placeholder="cuid of the user whose deposit you want to simulate" />
        </FormField>
        <FormField label="Deposit amount (BDT)" required>
          <Input type="number" min={1} value={amount} onChange={(e) => setAmount(Number(e.target.value))} />
        </FormField>
        <div className="md:col-span-2 flex justify-end">
          <Button type="submit" loading={busy} disabled={!userId.trim() || amount <= 0}>Run diagnose</Button>
        </div>
      </form>

      {err ? <p className="text-sm text-signal-danger">{err}</p> : null}

      {result ? (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2 text-xs">
            <Field label="Source user exists" value={result.sourceUserExists ? 'yes' : 'no'} />
            <Field label="Upline depth" value={String(result.chainDepth)} />
          </div>
          {result.evaluated.length === 0 ? (
            <Card padding="md">
              <p className="text-sm text-ink-mid">
                {result.sourceUserExists
                  ? 'No referral upline. This user has no referredById, so no commission can accrue.'
                  : 'User id not found.'}
              </p>
            </Card>
          ) : (
            <ul className="space-y-2">
              {result.evaluated.map((e) => (
                <li
                  key={e.affiliateId + '-' + e.level}
                  className={
                    e.eligible
                      ? 'rounded-lg border border-signal-ok/30 bg-signal-ok/5 p-3'
                      : 'rounded-lg border border-neon/10 bg-base-deep/40 p-3'
                  }
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-ink-hi">L{e.level} affiliate <span className="font-mono text-xs text-ink-lo">{e.affiliateId.slice(0, 12)}...</span></p>
                      <p className="mt-1 flex flex-wrap gap-3 text-xs">
                        <span className={e.isAffiliate ? 'text-signal-ok' : 'text-signal-warn'}>{e.isAffiliate ? 'isAffiliate=true' : 'isAffiliate=false'}</span>
                        <span className={e.tierName ? 'text-signal-ok' : 'text-signal-warn'}>tier={e.tierName ?? 'NONE'}</span>
                        <span>rate={e.ratePct != null ? `${e.ratePct}%` : '-'}</span>
                      </p>
                      {e.eligible ? (
                        <p className="mt-1 inline-flex items-center gap-1 text-xs text-signal-ok">
                          <CheckCircle2 className="h-3 w-3" /> Would accrue {e.payoutAmount.toLocaleString()} BDT
                        </p>
                      ) : (
                        <p className="mt-1 inline-flex items-center gap-1 text-xs text-signal-warn">
                          <XCircle className="h-3 w-3" /> Skipped: {e.reason}
                        </p>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
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
  if (a === 'assign_tier') return 'Assign / change tier';
  return 'Reset application';
}
