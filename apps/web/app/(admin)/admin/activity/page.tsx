// Built by Anointed Coder.
//
// M2G: live ActivityLog viewer with filters. Reads /api/admin/
// activity. Filters: free text (action / target / detail), action
// substring (e.g. BONUS), actor user id (paste from /admin/staff),
// from + to datetimes. Defaults: last 100 rows, no filter.

'use client';

import { useCallback, useEffect, useState } from 'react';
import { PageHeader } from '@/components/site/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { FormField, Input } from '@/components/ui/Input';
import { Chip } from '@/components/ui/Chip';
import { ClipboardList, RefreshCw, Filter as FilterIcon, X } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

interface Row {
  id: string;
  actorId: string | null;
  actorRole: string | null;
  action: string;
  target: string | null;
  detail: string | null;
  ip: string | null;
  userAgent: string | null;
  meta: unknown;
  createdAt: string;
  actor?: { username: string } | null;
}

function actionTone(action: string): 'danger' | 'info' | 'ok' | 'warn' | 'neutral' {
  const a = action.toLowerCase();
  if (a.includes('reject') || a.includes('block') || a.includes('delete') || a.includes('suspend') || a.includes('cancel') || a.includes('fail')) return 'danger';
  if (a.includes('system') || a.includes('auto') || a.includes('rollover') || a.includes('seed')) return 'info';
  if (a.includes('approve') || a.includes('grant') || a.includes('paid') || a.includes('login') || a.includes('create') || a.includes('settle') || a.includes('accrued')) return 'ok';
  if (a.includes('not_granted') || a.includes('skip') || a.includes('none') || a.includes('reset') || a.includes('hold')) return 'warn';
  return 'neutral';
}

export default function AdminActivityPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [q, setQ] = useState('');
  const [action, setAction] = useState('');
  const [actorId, setActorId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [take, setTake] = useState(100);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (q.trim()) params.set('q', q.trim());
      if (action.trim()) params.set('action', action.trim());
      if (actorId.trim()) params.set('actorId', actorId.trim());
      if (from) params.set('from', new Date(from).toISOString());
      if (to) params.set('to', new Date(to).toISOString());
      params.set('take', String(Math.min(200, Math.max(1, take))));
      const res = await fetch(`/api/admin/activity?${params.toString()}`, { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message ?? data?.code ?? 'Failed to load');
      setRows((data.logs ?? []) as Row[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [q, action, actorId, from, to, take]);

  useEffect(() => { load(); }, [load]);

  const clearFilters = () => {
    setQ('');
    setAction('');
    setActorId('');
    setFrom('');
    setTo('');
    setTake(100);
  };

  const hasFilters = q || action || actorId || from || to || take !== 100;

  return (
    <>
      <PageHeader
        title="Admin Activity Log"
        subtitle="Append-only audit trail across deposits, withdrawals, bonuses, commissions, lotto, staff and auth"
        icon={<ClipboardList className="h-5 w-5" />}
        action={
          <Button variant="ghost" leftIcon={<RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />} onClick={load}>
            Reload
          </Button>
        }
      />

      <Card padding="md" className="mb-4">
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          <FormField label="Free text" hint="Action, target id, or detail.">
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="e.g. BONUS, deposit id, 'spam' ..." />
          </FormField>
          <FormField label="Action contains" hint="e.g. DEPOSIT_APPROVE, BONUS, LOTTO">
            <Input value={action} onChange={(e) => setAction(e.target.value)} placeholder="action key fragment" />
          </FormField>
          <FormField label="Actor user id" hint="Paste from /admin/staff or /admin/users.">
            <Input value={actorId} onChange={(e) => setActorId(e.target.value)} placeholder="cuid..." />
          </FormField>
          <FormField label="From">
            <Input type="datetime-local" value={from} onChange={(e) => setFrom(e.target.value)} />
          </FormField>
          <FormField label="To">
            <Input type="datetime-local" value={to} onChange={(e) => setTo(e.target.value)} />
          </FormField>
          <FormField label="Take" hint="1 - 200.">
            <Input type="number" min={1} max={200} value={take} onChange={(e) => setTake(Number(e.target.value))} />
          </FormField>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-ink-lo">{loading ? 'Loading...' : `${rows.length} row${rows.length === 1 ? '' : 's'} returned`}</p>
          <div className="flex gap-2">
            {hasFilters ? (
              <Button variant="ghost" leftIcon={<X className="h-3.5 w-3.5" />} onClick={clearFilters}>Clear filters</Button>
            ) : null}
            <Button leftIcon={<FilterIcon className="h-3.5 w-3.5" />} onClick={load}>Apply</Button>
          </div>
        </div>
      </Card>

      {error ? <Card padding="md" className="mb-4"><p className="text-sm text-signal-danger">{error}</p></Card> : null}

      <Card padding="md" className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="text-xs uppercase tracking-wider text-ink-lo">
            <tr>
              <th className="px-2 py-2 text-left">When</th>
              <th className="px-2 py-2 text-left">Actor</th>
              <th className="px-2 py-2 text-left">Action</th>
              <th className="px-2 py-2 text-left">Target</th>
              <th className="px-2 py-2 text-left">Detail</th>
              <th className="px-2 py-2 text-left">IP</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && !loading ? (
              <tr><td colSpan={6} className="px-2 py-6 text-center text-sm text-ink-lo">No activity matches the current filters.</td></tr>
            ) : null}
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-neon/10 align-top">
                <td className="px-2 py-2 text-xs text-ink-lo">{new Date(r.createdAt).toLocaleString()}</td>
                <td className="px-2 py-2">
                  <p className="font-semibold text-ink-hi">{r.actor?.username ?? '(system)'}</p>
                  {r.actorRole ? <p className="text-[10px] uppercase tracking-wider text-ink-lo">{r.actorRole}</p> : null}
                  {r.actorId ? (
                    <button
                      type="button"
                      className="mt-0.5 font-mono text-[10px] text-ink-lo hover:text-ink-hi underline-offset-2 hover:underline"
                      title="Filter to this actor"
                      onClick={() => { if (r.actorId) { setActorId(r.actorId); } }}
                    >
                      {r.actorId.slice(0, 10)}...
                    </button>
                  ) : null}
                </td>
                <td className="px-2 py-2">
                  <button
                    type="button"
                    className="rounded-md"
                    title="Filter to this action"
                    onClick={() => setAction(r.action)}
                  >
                    <Chip tone={actionTone(r.action)}>{r.action}</Chip>
                  </button>
                </td>
                <td className="px-2 py-2 font-mono text-xs text-ink-mid">{r.target ?? '-'}</td>
                <td className="px-2 py-2 max-w-md break-words text-xs text-ink-mid">{r.detail ?? '-'}</td>
                <td className="px-2 py-2 font-mono text-[11px] text-ink-lo">{r.ip ?? '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </>
  );
}
