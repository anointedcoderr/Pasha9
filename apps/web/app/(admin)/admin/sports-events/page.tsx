// Built by Anointed Coder.
'use client';

import { useCallback, useEffect, useState } from 'react';
import { PageHeader } from '@/components/site/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { FormField, Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Modal } from '@/components/ui/Modal';
import { Switch } from '@/components/ui/Switch';
import { Chip } from '@/components/ui/Chip';
import { EmptyState } from '@/components/ui/EmptyState';
import { AdminMediaUpload } from '@/components/admin/AdminMediaUpload';
import { ConfirmDialog } from '@/components/admin/ConfirmDialog';
import { Flag, Plus, Pencil, Trash2 } from 'lucide-react';

interface EventRow {
  id: string;
  sportType: string;
  status: 'upcoming' | 'live' | 'ended';
  leagueNameEn: string;
  leagueNameBn: string | null;
  startsAt: string;
  endsAt: string | null;
  teamAName: string;
  teamAShortName: string | null;
  teamALogoUrl: string | null;
  teamBName: string;
  teamBShortName: string | null;
  teamBLogoUrl: string | null;
  providerName: string | null;
  providerEventId: string | null;
  deepLinkUrl: string | null;
  sortOrder: number;
  isActive: boolean;
  source: string;
}

const SPORT_TYPES = ['cricket', 'football', 'tennis', 'basketball', 'esports', 'other'];
const STATUSES: Array<EventRow['status']> = ['upcoming', 'live', 'ended'];

const BLANK: EventRow = {
  id: '',
  sportType: 'cricket',
  status: 'upcoming',
  leagueNameEn: '',
  leagueNameBn: '',
  startsAt: '',
  endsAt: null,
  teamAName: '',
  teamAShortName: '',
  teamALogoUrl: '',
  teamBName: '',
  teamBShortName: '',
  teamBLogoUrl: '',
  providerName: '',
  providerEventId: '',
  deepLinkUrl: '',
  sortOrder: 0,
  isActive: true,
  source: 'manual',
};

// Prefill for <input type="datetime-local">. Convert the stored UTC
// value to local wall-clock time so an edit-and-save round trip does
// not shift the schedule by the local offset.
function toLocalInput(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

export default function AdminSportsEventsPage() {
  const [events, setEvents] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editor, setEditor] = useState<EventRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  // In-page confirm dialog instead of native confirm(), which
  // installed PWAs suppress silently.
  const [deleteTarget, setDeleteTarget] = useState<EventRow | null>(null);

  const notify = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  };

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch('/api/admin/sports-events', { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? data.code ?? 'Failed');
      setEvents(data.events ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const save = async () => {
    if (!editor) return;
    setBusy(true);
    setError(null);
    try {
      const payload = {
        sportType: editor.sportType,
        status: editor.status,
        leagueNameEn: editor.leagueNameEn,
        leagueNameBn: editor.leagueNameBn || null,
        startsAt: editor.startsAt ? new Date(editor.startsAt).toISOString() : new Date().toISOString(),
        endsAt: editor.endsAt ? new Date(editor.endsAt).toISOString() : null,
        teamAName: editor.teamAName,
        teamAShortName: editor.teamAShortName || null,
        teamALogoUrl: editor.teamALogoUrl || null,
        teamBName: editor.teamBName,
        teamBShortName: editor.teamBShortName || null,
        teamBLogoUrl: editor.teamBLogoUrl || null,
        providerName: editor.providerName || null,
        providerEventId: editor.providerEventId || null,
        deepLinkUrl: editor.deepLinkUrl || null,
        sortOrder: editor.sortOrder,
        isActive: editor.isActive,
      };
      const isNew = !editor.id;
      const res = isNew
        ? await fetch('/api/admin/sports-events', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) })
        : await fetch(`/api/admin/sports-events/${editor.id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? data.code ?? 'Save failed');
      setEditor(null);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (ev: EventRow) => {
    try {
      const res = await fetch(`/api/admin/sports-events/${ev.id}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        notify('Fixture deleted. ফিক্সচার মুছে ফেলা হয়েছে।');
        refresh();
      } else {
        setError(`${data?.message ?? data?.code ?? 'Delete failed'} (Delete failed. ডিলিট ব্যর্থ হয়েছে।)`);
      }
    } catch {
      setError('Delete failed: network error. ডিলিট ব্যর্থ হয়েছে: নেটওয়ার্ক সমস্যা।');
    }
  };

  const toggle = async (ev: EventRow) => {
    try {
      const res = await fetch(`/api/admin/sports-events/${ev.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ isActive: !ev.isActive }),
      });
      if (!res.ok) {
        setError('Failed to update status. স্ট্যাটাস আপডেট ব্যর্থ হয়েছে।');
        return;
      }
      refresh();
    } catch {
      setError('Failed to update status: network error. স্ট্যাটাস আপডেট ব্যর্থ হয়েছে: নেটওয়ার্ক সমস্যা।');
    }
  };

  return (
    <>
      <PageHeader
        title="Sports Fixtures"
        subtitle="Cards rendered in the homepage Sportsbook carousel. Manual entries today; a real provider feed adapter will upsert into this same table."
        icon={<Flag className="h-5 w-5" />}
        action={
          <Button leftIcon={<Plus className="h-4 w-4" />} onClick={() => setEditor({ ...BLANK, startsAt: toLocalInput(new Date().toISOString()) })}>
            New fixture
          </Button>
        }
      />

      {toast ? <Card padding="md" className="mb-4"><p className="text-sm text-signal-ok">{toast}</p></Card> : null}
      {error ? <Card padding="md" className="mb-4"><p className="text-sm text-signal-danger">{error}</p></Card> : null}

      <div className="space-y-3">
        {loading ? (
          <Card padding="lg">Loading...</Card>
        ) : events.length === 0 ? (
          <Card padding="lg">
            <EmptyState
              title="No fixtures yet"
              description="The homepage Sports section falls back to provider entry cards. Add a fixture to render a Babu-style match card on the homepage."
            />
          </Card>
        ) : (
          events.map((ev) => (
            <Card key={ev.id} padding="lg" className="flex flex-col gap-4 md:flex-row md:items-center">
              <div className="flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold text-ink-hi">{ev.leagueNameEn}</p>
                  <Chip tone={ev.isActive ? 'ok' : 'neutral'}>{ev.isActive ? 'active' : 'hidden'}</Chip>
                  <Chip tone={ev.status === 'live' ? 'warn' : 'info'}>{ev.status}</Chip>
                  <Chip>{ev.sportType}</Chip>
                </div>
                <p className="text-sm text-ink-mid">{ev.teamAName} vs {ev.teamBName}</p>
                <p className="text-[11px] text-ink-lo">
                  Starts {new Date(ev.startsAt).toLocaleString()} . sort {ev.sortOrder}
                  {ev.providerName ? ` . ${ev.providerName}` : ''}
                </p>
                {ev.deepLinkUrl ? <p className="break-all text-[11px] text-ink-lo">Deep link: {ev.deepLinkUrl}</p> : null}
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={ev.isActive} onChange={() => toggle(ev)} />
                <Button size="sm" variant="neon" leftIcon={<Pencil className="h-3.5 w-3.5" />} onClick={() => setEditor({ ...ev, startsAt: toLocalInput(ev.startsAt), endsAt: ev.endsAt ? toLocalInput(ev.endsAt) : null, leagueNameBn: ev.leagueNameBn ?? '', teamAShortName: ev.teamAShortName ?? '', teamALogoUrl: ev.teamALogoUrl ?? '', teamBShortName: ev.teamBShortName ?? '', teamBLogoUrl: ev.teamBLogoUrl ?? '', providerName: ev.providerName ?? '', providerEventId: ev.providerEventId ?? '', deepLinkUrl: ev.deepLinkUrl ?? '' })}>
                  Edit
                </Button>
                <Button size="sm" variant="danger" leftIcon={<Trash2 className="h-3.5 w-3.5" />} onClick={() => setDeleteTarget(ev)}>
                  Delete
                </Button>
              </div>
            </Card>
          ))
        )}
      </div>

      <Card padding="md" className="mt-6 border-dashed">
        <p className="text-sm font-semibold text-ink-hi">Provider feed status</p>
        <p className="mt-1 text-xs text-ink-mid">
          A real-time provider feed adapter is not wired yet. Fixtures shown above are admin-managed
          rows (source=manual). When provider credentials become available, set the env vars below
          and the adapter will upsert into this same table.
        </p>
        <ul className="mt-2 list-disc pl-5 text-[11px] text-ink-lo">
          <li><code>SPORTSBOOK_FEED_BASE_URL</code> = https://&lt;provider&gt;/api</li>
          <li><code>SPORTSBOOK_FEED_API_KEY</code> = &lt;provider-issued key&gt;</li>
          <li><code>SPORTSBOOK_FEED_OPERATOR_ID</code> = &lt;your brand/operator id&gt;</li>
          <li><code>SPORTSBOOK_FEED_LAUNCH_URL</code> = &lt;event launch URL pattern&gt;</li>
          <li><code>SPORTSBOOK_FEED_AUTH_ENDPOINT</code> = &lt;auth token endpoint&gt;</li>
        </ul>
        <p className="mt-2 text-[11px] text-amber-700">Provider setup required for automatic feed; manual rows still render publicly.</p>
      </Card>

      <Modal open={!!editor} onOpenChange={(v) => !v && setEditor(null)} title={editor?.id ? 'Edit fixture' : 'New fixture'} size="lg">
        {editor ? (
          <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); void save(); }}>
            <div className="grid gap-3 md:grid-cols-3">
              <FormField label="Sport" required>
                <Select value={editor.sportType} onChange={(e) => setEditor({ ...editor, sportType: e.target.value })}>
                  {SPORT_TYPES.map((s) => <option key={s} value={s}>{s}</option>)}
                </Select>
              </FormField>
              <FormField label="Status" required>
                <Select value={editor.status} onChange={(e) => setEditor({ ...editor, status: e.target.value as EventRow['status'] })}>
                  {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </Select>
              </FormField>
              <FormField label="Sort order">
                <Input type="number" value={editor.sortOrder} onChange={(e) => setEditor({ ...editor, sortOrder: Number(e.target.value) || 0 })} />
              </FormField>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <FormField label="League (English)" required>
                <Input value={editor.leagueNameEn} onChange={(e) => setEditor({ ...editor, leagueNameEn: e.target.value })} placeholder="One Day International" />
              </FormField>
              <FormField label="League (Bangla)">
                <Input value={editor.leagueNameBn ?? ''} onChange={(e) => setEditor({ ...editor, leagueNameBn: e.target.value })} />
              </FormField>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <FormField label="Starts at" required>
                <Input type="datetime-local" value={editor.startsAt} onChange={(e) => setEditor({ ...editor, startsAt: e.target.value })} />
              </FormField>
              <FormField label="Ends at (optional)">
                <Input type="datetime-local" value={editor.endsAt ?? ''} onChange={(e) => setEditor({ ...editor, endsAt: e.target.value || null })} />
              </FormField>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2 rounded-lg border border-brand-divider bg-brand-paper p-3">
                <p className="text-[11px] font-bold uppercase tracking-wider text-brand-yellow-700">Team A</p>
                <FormField label="Name" required>
                  <Input value={editor.teamAName} onChange={(e) => setEditor({ ...editor, teamAName: e.target.value })} placeholder="West Indies" />
                </FormField>
                <FormField label="Short name">
                  <Input value={editor.teamAShortName ?? ''} onChange={(e) => setEditor({ ...editor, teamAShortName: e.target.value })} placeholder="WI" />
                </FormField>
                <AdminMediaUpload
                  label="Team A logo"
                  hint="PNG / SVG, square works best."
                  value={editor.teamALogoUrl || null}
                  category="categories"
                  constraintHint="SVG / PNG, square, max 1 MB"
                  onChange={(url) => setEditor({ ...editor, teamALogoUrl: url ?? '' })}
                />
              </div>
              <div className="space-y-2 rounded-lg border border-brand-divider bg-brand-paper p-3">
                <p className="text-[11px] font-bold uppercase tracking-wider text-brand-yellow-700">Team B</p>
                <FormField label="Name" required>
                  <Input value={editor.teamBName} onChange={(e) => setEditor({ ...editor, teamBName: e.target.value })} placeholder="Sri Lanka" />
                </FormField>
                <FormField label="Short name">
                  <Input value={editor.teamBShortName ?? ''} onChange={(e) => setEditor({ ...editor, teamBShortName: e.target.value })} placeholder="SL" />
                </FormField>
                <AdminMediaUpload
                  label="Team B logo"
                  hint="PNG / SVG, square works best."
                  value={editor.teamBLogoUrl || null}
                  category="categories"
                  constraintHint="SVG / PNG, square, max 1 MB"
                  onChange={(url) => setEditor({ ...editor, teamBLogoUrl: url ?? '' })}
                />
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <FormField label="Provider name (optional)">
                <Input value={editor.providerName ?? ''} onChange={(e) => setEditor({ ...editor, providerName: e.target.value })} placeholder="9Wickets" />
              </FormField>
              <FormField label="Provider event id (optional)">
                <Input value={editor.providerEventId ?? ''} onChange={(e) => setEditor({ ...editor, providerEventId: e.target.value })} />
              </FormField>
            </div>
            <FormField label="Deep link URL (where the Bet now button opens)">
              <Input value={editor.deepLinkUrl ?? ''} onChange={(e) => setEditor({ ...editor, deepLinkUrl: e.target.value })} placeholder="https://provider.example/event/12345" />
            </FormField>
            <label className="flex items-center gap-2 text-sm text-ink-mid">
              <Switch checked={editor.isActive} onChange={(v) => setEditor({ ...editor, isActive: Boolean(v) })} />
              Active
            </label>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" type="button" onClick={() => setEditor(null)}>Cancel</Button>
              <Button type="submit" loading={busy}>Save</Button>
            </div>
          </form>
        ) : null}
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(v) => !v && setDeleteTarget(null)}
        title="Delete fixture"
        message={deleteTarget ? `Delete fixture "${deleteTarget.teamAName} vs ${deleteTarget.teamBName}"? This cannot be undone.` : ''}
        messageBn={deleteTarget ? `"${deleteTarget.teamAName} vs ${deleteTarget.teamBName}" ফিক্সচারটি মুছে ফেলবেন? এটি আর ফেরানো যাবে না।` : ''}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onConfirm={async () => { if (deleteTarget) await remove(deleteTarget); }}
      />
    </>
  );
}
