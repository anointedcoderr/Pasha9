// Built by Anointed Coder.
//
// /admin/reward-claims. Lists every RewardClaim row the user filed
// from the rewards shop. The operator works through pending claims and
// changes status to approved (in progress), done (delivered) or
// rejected (refund coins to bonusBalance). The PATCH endpoint at
// /api/admin/reward-claims handles the refund inside a transaction so
// no separate refund step is needed here.

'use client';

import { useCallback, useEffect, useState } from 'react';
import { PageHeader } from '@/components/site/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { Modal } from '@/components/ui/Modal';
import { Trophy, RefreshCw, CheckCircle2, XCircle, Gift, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

type ClaimStatus = 'pending' | 'approved' | 'rejected' | 'done' | 'cancelled';

interface ClaimRow {
  id: string;
  userId: string;
  username: string | null;
  phone: string | null;
  itemId: string;
  itemTitle: string;
  rewardType: string;
  costPaid: number;
  status: ClaimStatus;
  payload: Record<string, unknown> | null;
  notes: string | null;
  createdAt: string;
  processedAt: string | null;
}

const STATUS_TONE: Record<ClaimStatus, 'ok' | 'warn' | 'info' | 'neutral' | 'danger'> = {
  pending: 'warn',
  approved: 'info',
  rejected: 'danger',
  done: 'ok',
  cancelled: 'neutral',
};

const STATUS_FILTERS: { value: '' | ClaimStatus; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'In progress' },
  { value: 'done', label: 'Completed' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'cancelled', label: 'Cancelled' },
];

export default function AdminRewardClaimsPage() {
  const [claims, setClaims] = useState<ClaimRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'' | ClaimStatus>('pending');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [pendingPatch, setPendingPatch] = useState<{ id: string; next: ClaimStatus } | null>(null);
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    setError(null);
    try {
      const url = statusFilter
        ? `/api/admin/reward-claims?status=${encodeURIComponent(statusFilter)}`
        : '/api/admin/reward-claims';
      const res = await fetch(url, { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message ?? data?.code ?? 'Failed to load');
      setClaims(data.claims as ClaimRow[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => { refresh(); }, [refresh]);

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const startPatch = (id: string, next: ClaimStatus) => {
    setPendingPatch({ id, next });
    setNotes('');
  };

  const confirmPatch = async () => {
    if (!pendingPatch) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/reward-claims', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id: pendingPatch.id, status: pendingPatch.next, notes: notes || undefined }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.message ?? data?.code ?? 'Update failed');
      setPendingPatch(null);
      setNotes('');
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Update failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Reward Claims"
        subtitle={loading ? 'Loading...' : `${claims.length} claim${claims.length === 1 ? '' : 's'} on screen`}
        icon={<Trophy className="h-5 w-5" />}
        action={
          <Button variant="ghost" leftIcon={<RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} />} onClick={refresh}>
            Refresh
          </Button>
        }
      />

      <Card padding="md" className="mb-4">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-[10px] font-bold uppercase tracking-wider text-brand-inkMute">Filter</p>
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value || 'all'}
              type="button"
              onClick={() => setStatusFilter(f.value)}
              className={cn(
                'rounded-pill border px-3 py-1.5 text-xs font-bold uppercase tracking-wider transition',
                statusFilter === f.value
                  ? 'border-brand-yellow-500 bg-brand-yellow-500/15 text-brand-ink'
                  : 'border-brand-divider text-brand-inkSoft hover:text-brand-ink',
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </Card>

      {error ? <Card padding="md" className="mb-4 border-l-4 border-rose-400"><p className="text-sm text-rose-300">{error}</p></Card> : null}

      {loading ? (
        <Card padding="lg">Loading...</Card>
      ) : claims.length === 0 ? (
        <Card padding="lg"><p className="text-sm text-brand-inkMute">No reward claims match the filter.</p></Card>
      ) : (
        <div className="space-y-2">
          {claims.map((c) => {
            const isOpen = expanded.has(c.id);
            const payloadEntries = c.payload && typeof c.payload === 'object'
              ? Object.entries(c.payload as Record<string, unknown>)
              : [];
            return (
              <Card key={c.id} padding="md">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-yellow-500/15 text-brand-yellow-700">
                    <Gift className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-extrabold text-brand-ink">{c.itemTitle}</p>
                      <Chip tone={STATUS_TONE[c.status]}>{c.status}</Chip>
                      <Chip tone="info">{c.rewardType}</Chip>
                    </div>
                    <p className="mt-0.5 text-[11px] text-brand-inkMute">
                      <span className="font-semibold text-brand-ink">{c.username ?? '(no name)'}</span>
                      {c.phone ? <> . {c.phone}</> : null}
                      {' . '}
                      <span className="font-mono">{c.userId}</span>
                      {' . '}
                      <span>{Math.round(c.costPaid)} coins</span>
                      {' . '}
                      <span>{new Date(c.createdAt).toLocaleString()}</span>
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {c.status === 'pending' ? (
                      <>
                        <Button size="sm" variant="neon" leftIcon={<CheckCircle2 className="h-3.5 w-3.5" />} onClick={() => startPatch(c.id, 'approved')}>
                          Accept
                        </Button>
                        <Button size="sm" variant="danger" leftIcon={<XCircle className="h-3.5 w-3.5" />} onClick={() => startPatch(c.id, 'rejected')}>
                          Reject
                        </Button>
                      </>
                    ) : c.status === 'approved' ? (
                      <>
                        <Button size="sm" variant="neon" leftIcon={<CheckCircle2 className="h-3.5 w-3.5" />} onClick={() => startPatch(c.id, 'done')}>
                          Mark Done
                        </Button>
                        <Button size="sm" variant="danger" leftIcon={<XCircle className="h-3.5 w-3.5" />} onClick={() => startPatch(c.id, 'rejected')}>
                          Reject
                        </Button>
                      </>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => toggleExpand(c.id)}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-brand-divider text-brand-inkSoft hover:text-brand-ink"
                      aria-label={isOpen ? 'Collapse' : 'Expand'}
                    >
                      {isOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>

                {isOpen ? (
                  <div className="mt-3 grid gap-2 text-[11px] text-brand-inkSoft md:grid-cols-2">
                    {payloadEntries.length > 0 ? (
                      <div className="rounded-lg border border-brand-divider bg-brand-surface p-2">
                        <p className="font-bold uppercase tracking-wider text-brand-inkMute">Payload</p>
                        <dl className="mt-1 space-y-0.5">
                          {payloadEntries.map(([k, v]) => (
                            <div key={k} className="flex gap-2">
                              <dt className="min-w-[80px] font-semibold text-brand-ink">{k}</dt>
                              <dd className="break-all">{String(v ?? '')}</dd>
                            </div>
                          ))}
                        </dl>
                      </div>
                    ) : null}
                    <div className="rounded-lg border border-brand-divider bg-brand-surface p-2">
                      <p className="font-bold uppercase tracking-wider text-brand-inkMute">Processing</p>
                      <p className="mt-1">Processed at: {c.processedAt ? new Date(c.processedAt).toLocaleString() : '-'}</p>
                      <p>Operator notes: {c.notes ?? '-'}</p>
                    </div>
                  </div>
                ) : null}
              </Card>
            );
          })}
        </div>
      )}

      <Modal
        open={!!pendingPatch}
        onOpenChange={(v) => { if (!v) { setPendingPatch(null); setNotes(''); } }}
        title={pendingPatch?.next === 'rejected'
          ? 'Reject reward claim'
          : pendingPatch?.next === 'done'
            ? 'Mark claim delivered'
            : 'Accept reward claim'}
        description={pendingPatch?.next === 'rejected'
          ? 'Rejection refunds the coins back to the user wallet automatically.'
          : pendingPatch?.next === 'done'
            ? 'Confirms the reward has been delivered. Cannot be undone from this page.'
            : 'Moves the claim to In Progress so the fulfilment team picks it up.'}
        footer={
          <>
            <Button variant="ghost" onClick={() => { setPendingPatch(null); setNotes(''); }}>Cancel</Button>
            <Button
              variant={pendingPatch?.next === 'rejected' ? 'danger' : 'gold'}
              loading={busy}
              onClick={confirmPatch}
            >
              {pendingPatch?.next === 'rejected' ? 'Reject + refund' : pendingPatch?.next === 'done' ? 'Mark done' : 'Accept'}
            </Button>
          </>
        }
      >
        <label className="block">
          <span className="text-[11px] font-bold uppercase tracking-wider text-brand-inkMute">Operator notes (optional)</span>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className="mt-1 w-full rounded-lg border border-brand-divider bg-brand-paper px-3 py-2 text-sm text-brand-ink focus:outline-none focus:ring-2 focus:ring-brand-yellow-500/40"
            placeholder="Why was this rejected, or what reference id was used to fulfil it?"
          />
        </label>
      </Modal>
    </>
  );
}
