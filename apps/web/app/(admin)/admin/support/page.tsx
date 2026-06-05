// Built by Anointed Coder.
//
// /admin/support. Real-data support queue. Lists SupportTicket rows
// from GET /api/admin/support-tickets, supports status filters, opens
// a drawer to update status + admin note via PATCH.

'use client';

import { useCallback, useEffect, useState } from 'react';
import { PageHeader } from '@/components/site/PageHeader';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { Drawer } from '@/components/ui/Modal';
import { Textarea, Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { LifeBuoy, RefreshCw, Send, CheckCircle2, XCircle, Inbox } from 'lucide-react';
import { formatDateTime } from '@/lib/utils/format';
import { useLang } from '@/lib/i18n/context';
import { cn } from '@/lib/utils/cn';

type Status = 'open' | 'pending' | 'resolved' | 'closed';

interface Ticket {
  id: string;
  userId: string | null;
  username: string | null;
  userPhone: string | null;
  guestName: string | null;
  guestEmail: string | null;
  guestPhone: string | null;
  subject: string;
  body: string;
  status: Status;
  adminNote: string | null;
  resolvedAt: string | null;
  resolvedBy: string | null;
  ip: string | null;
  createdAt: string;
  updatedAt: string;
}

interface Counts { open: number; pending: number; resolved: number; closed: number }

const STATUS_FILTERS: Array<{ key: Status | ''; label: string; icon: typeof Inbox | null }> = [
  { key: '',         label: 'All',      icon: null },
  { key: 'open',     label: 'Open',     icon: Inbox },
  { key: 'pending',  label: 'Pending',  icon: RefreshCw },
  { key: 'resolved', label: 'Resolved', icon: CheckCircle2 },
  { key: 'closed',   label: 'Closed',   icon: XCircle },
];

function toneFor(status: Status): 'info' | 'warn' | 'ok' | 'neutral' {
  if (status === 'open') return 'info';
  if (status === 'pending') return 'warn';
  if (status === 'resolved') return 'ok';
  return 'neutral';
}

export default function AdminSupportPage() {
  const { lang } = useLang();
  const [open, setOpen] = useState(false);
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [counts, setCounts] = useState<Counts>({ open: 0, pending: 0, resolved: 0, closed: 0 });
  const [statusFilter, setStatusFilter] = useState<Status | ''>('open');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [savingNote, setSavingNote] = useState(false);
  const [draftNote, setDraftNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    setError(null);
    try {
      const url = statusFilter ? `/api/admin/support-tickets?status=${encodeURIComponent(statusFilter)}` : '/api/admin/support-tickets';
      const r = await fetch(url, { cache: 'no-store' });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.message ?? j?.code ?? 'Failed to load');
      setTickets(j.tickets as Ticket[]);
      setCounts(j.counts as Counts);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => { refresh(); }, [refresh]);

  const openTicket = (t: Ticket) => {
    setTicket(t);
    setDraftNote(t.adminNote ?? '');
    setOpen(true);
  };

  const patch = async (nextStatus: Status | undefined, noteValue: string | undefined) => {
    if (!ticket) return;
    setSavingNote(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {};
      if (nextStatus !== undefined) body.status = nextStatus;
      if (noteValue !== undefined) body.adminNote = noteValue.trim() || null;
      const r = await fetch(`/api/admin/support-tickets/${ticket.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.message ?? j?.code ?? 'Save failed');
      // Refresh + update the open drawer
      await refresh();
      setTicket((t) => (t ? { ...t, ...(j.ticket as Partial<Ticket>) } as Ticket : t));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSavingNote(false);
    }
  };

  const submitter = (t: Ticket): string => {
    if (t.username) return `@${t.username}${t.userPhone ? ` . ${t.userPhone}` : ''}`;
    const parts: string[] = [];
    if (t.guestName) parts.push(t.guestName);
    if (t.guestEmail) parts.push(t.guestEmail);
    if (t.guestPhone) parts.push(t.guestPhone);
    return parts.length > 0 ? parts.join(' . ') : 'Guest';
  };

  const headerSubtitle = `${counts.open} open . ${counts.pending} pending . ${counts.resolved} resolved . ${counts.closed} closed`;

  return (
    <>
      <PageHeader
        title="Support Messages"
        subtitle={loading ? 'Loading...' : headerSubtitle}
        icon={<LifeBuoy className="h-5 w-5" />}
        action={
          <Button variant="ghost" leftIcon={<RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} />} onClick={refresh}>
            Refresh
          </Button>
        }
      />

      {error ? <Card padding="md" className="mb-4 border-l-4 border-rose-400/60"><p className="text-sm text-rose-300">{error}</p></Card> : null}

      <Card padding="sm" className="mb-3">
        <div className="flex flex-wrap items-center gap-1">
          {STATUS_FILTERS.map((f) => {
            const active = statusFilter === f.key;
            const Icon = f.icon;
            return (
              <button
                key={f.key || 'all'}
                type="button"
                onClick={() => setStatusFilter(f.key)}
                className={cn(
                  'inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-xs font-bold uppercase tracking-wider transition',
                  active
                    ? 'border-brand-yellow-500 bg-brand-yellow-500/15 text-brand-ink'
                    : 'border-brand-divider text-brand-inkSoft hover:text-brand-ink',
                )}
              >
                {Icon ? <Icon className="h-3.5 w-3.5" /> : null}
                {f.label}
                {f.key ? <span className="rounded-full bg-brand-surface px-1.5 py-0.5 text-[10px] text-brand-inkMute">{counts[f.key]}</span> : null}
              </button>
            );
          })}
        </div>
      </Card>

      {loading ? (
        <Card padding="lg">Loading...</Card>
      ) : tickets.length === 0 ? (
        <Card padding="lg">
          <p className="text-sm text-brand-inkMute">
            No tickets {statusFilter ? `with status ${statusFilter}` : 'yet'}. The list refreshes when users submit through /support.
          </p>
        </Card>
      ) : (
        <Card padding="none" className="overflow-hidden">
          <ul className="divide-y divide-brand-divider">
            {tickets.map((t) => (
              <li key={t.id} className="flex flex-col items-start gap-3 p-4 md:flex-row md:items-center">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-extrabold text-brand-ink truncate">{t.subject}</p>
                    <Chip tone={toneFor(t.status)}>{t.status}</Chip>
                    {t.adminNote ? <Chip tone="info">note</Chip> : null}
                  </div>
                  <p className="mt-1 text-xs text-brand-inkMute">{submitter(t)} . {formatDateTime(t.createdAt, lang)}</p>
                  <p className="mt-1 truncate text-sm text-brand-inkSoft">{t.body}</p>
                </div>
                <Button size="sm" variant="neon" onClick={() => openTicket(t)}>Open</Button>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Drawer open={open} onOpenChange={setOpen} title={ticket?.subject ?? ''} description={ticket ? submitter(ticket) : ''} width="560px">
        {ticket ? (
          <div className="space-y-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-brand-inkMute">Message</p>
              <div className="mt-1 whitespace-pre-line rounded-xl border border-brand-divider bg-brand-surface p-3 text-sm text-brand-inkSoft">{ticket.body}</div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-[11px] text-brand-inkMute">
              <p><span className="text-brand-ink">Status:</span> {ticket.status}</p>
              <p><span className="text-brand-ink">Created:</span> {formatDateTime(ticket.createdAt, lang)}</p>
              {ticket.resolvedAt ? <p><span className="text-brand-ink">Resolved:</span> {formatDateTime(ticket.resolvedAt, lang)}</p> : null}
              {ticket.ip ? <p><span className="text-brand-ink">IP:</span> {ticket.ip}</p> : null}
              {ticket.userId ? <p><span className="text-brand-ink">User ID:</span> {ticket.userId}</p> : null}
              {ticket.guestEmail ? <p><span className="text-brand-ink">Email:</span> {ticket.guestEmail}</p> : null}
              {ticket.guestPhone ? <p><span className="text-brand-ink">Phone:</span> {ticket.guestPhone}</p> : null}
            </div>

            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-brand-inkMute">Internal note</p>
              <Textarea rows={4} value={draftNote} onChange={(e) => setDraftNote(e.target.value)} placeholder="Reference id, follow-up plan, etc. Not visible to the user." />
              <div className="mt-2 flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setDraftNote(ticket.adminNote ?? '')}>Reset</Button>
                <Button leftIcon={<Send className="h-3.5 w-3.5" />} loading={savingNote} onClick={() => patch(undefined, draftNote)}>Save note</Button>
              </div>
            </div>

            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-brand-inkMute">Status</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {(['open', 'pending', 'resolved', 'closed'] as Status[]).map((s) => (
                  <Button
                    key={s}
                    size="sm"
                    variant={ticket.status === s ? 'neon' : 'ghost'}
                    onClick={() => patch(s, undefined)}
                  >
                    Mark {s}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        ) : null}
      </Drawer>
    </>
  );
}
