// Built by Anointed Coder.
'use client';

import { useCallback, useEffect, useState } from 'react';
import { PageHeader } from '@/components/site/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Switch } from '@/components/ui/Switch';
import { FormField, Input, Textarea } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Megaphone, Plus, Pencil, Trash2 } from 'lucide-react';
import { Chip } from '@/components/ui/Chip';
import { EmptyState } from '@/components/ui/EmptyState';
import { formatDateTime } from '@/lib/utils/format';
import { useLang } from '@/lib/i18n/context';

type Status = 'active' | 'hidden' | 'paused';

interface PopupRow {
  id: string;
  title: string;
  body: string;
  ctaLabel?: string | null;
  ctaHref?: string | null;
  startAt?: string | null;
  endAt?: string | null;
  status: Status;
  createdAt: string;
}

const NEW_POPUP: PopupRow = {
  id: '',
  title: '',
  body: '',
  ctaLabel: '',
  ctaHref: '',
  startAt: '',
  endAt: '',
  status: 'active',
  createdAt: '',
};

export default function AdminPopupsPage() {
  const { lang } = useLang();
  const [popups, setPopups] = useState<PopupRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editor, setEditor] = useState<PopupRow | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch('/api/admin/popups', { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? data.code);
      setPopups(data.popups ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load popups');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const save = async () => {
    if (!editor) return;
    setBusy(true);
    setError(null);
    const toIso = (v?: string | null) => (v ? new Date(v).toISOString() : null);
    const payload = {
      title: editor.title,
      body: editor.body,
      ctaLabel: editor.ctaLabel || undefined,
      ctaHref: editor.ctaHref || undefined,
      startAt: toIso(editor.startAt),
      endAt: toIso(editor.endAt),
      status: editor.status,
    };
    try {
      const res = editor.id
        ? await fetch(`/api/admin/popups/${editor.id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) })
        : await fetch('/api/admin/popups', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? data.code);
      setEditor(null);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (p: PopupRow) => {
    await fetch(`/api/admin/popups/${p.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status: p.status === 'active' ? 'hidden' : 'active' }),
    });
    refresh();
  };

  const remove = async (id: string) => {
    if (!confirm('Delete this popup?')) return;
    await fetch(`/api/admin/popups/${id}`, { method: 'DELETE' });
    refresh();
  };

  return (
    <>
      <PageHeader
        title="Popup Announcements"
        subtitle="Show timely messages to visitors and players"
        icon={<Megaphone className="h-5 w-5" />}
        action={<Button leftIcon={<Plus className="h-4 w-4" />} onClick={() => setEditor({ ...NEW_POPUP })}>New Popup</Button>}
      />

      {error ? <Card padding="md" className="mb-4"><p className="text-sm text-signal-danger">{error}</p></Card> : null}

      <div className="space-y-4">
        {loading ? (
          <Card padding="lg">Loading...</Card>
        ) : popups.length === 0 ? (
          <Card padding="lg"><EmptyState title="No popups yet" description="Create one to surface a time-sensitive announcement." /></Card>
        ) : (
          popups.map((p) => (
            <Card key={p.id} padding="lg" className="flex flex-col gap-3 md:flex-row md:items-center">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-ink-hi">{p.title}</p>
                  <Chip tone={p.status === 'active' ? 'ok' : 'neutral'}>{p.status}</Chip>
                </div>
                <p className="mt-1 text-sm text-ink-mid line-clamp-2">{p.body}</p>
                <p className="mt-1 text-xs text-ink-lo">
                  {p.startAt ? `from ${formatDateTime(p.startAt, lang)}` : 'always'}{' '}
                  {p.endAt ? `to ${formatDateTime(p.endAt, lang)}` : ''}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={p.status === 'active'} onChange={() => toggle(p)} />
                <Button size="sm" variant="neon" leftIcon={<Pencil className="h-3.5 w-3.5" />} onClick={() => setEditor({
                  ...p,
                  startAt: p.startAt ? p.startAt.slice(0, 16) : '',
                  endAt: p.endAt ? p.endAt.slice(0, 16) : '',
                })}>Edit</Button>
                <Button size="sm" variant="danger" leftIcon={<Trash2 className="h-3.5 w-3.5" />} onClick={() => remove(p.id)}>Delete</Button>
              </div>
            </Card>
          ))
        )}
      </div>

      <Modal open={!!editor} onOpenChange={(v) => !v && setEditor(null)} title={editor?.id ? 'Edit Popup' : 'New Popup'} size="lg">
        {editor ? (
          <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); void save(); }}>
            <FormField label="Title" required>
              <Input value={editor.title} onChange={(e) => setEditor({ ...editor, title: e.target.value })} />
            </FormField>
            <FormField label="Body" required>
              <Textarea rows={4} value={editor.body} onChange={(e) => setEditor({ ...editor, body: e.target.value })} />
            </FormField>
            <div className="grid gap-3 md:grid-cols-2">
              <FormField label="CTA Label">
                <Input value={editor.ctaLabel ?? ''} onChange={(e) => setEditor({ ...editor, ctaLabel: e.target.value })} />
              </FormField>
              <FormField label="CTA Link">
                <Input value={editor.ctaHref ?? ''} onChange={(e) => setEditor({ ...editor, ctaHref: e.target.value })} />
              </FormField>
              <FormField label="Start">
                <Input type="datetime-local" value={editor.startAt ?? ''} onChange={(e) => setEditor({ ...editor, startAt: e.target.value })} />
              </FormField>
              <FormField label="End">
                <Input type="datetime-local" value={editor.endAt ?? ''} onChange={(e) => setEditor({ ...editor, endAt: e.target.value })} />
              </FormField>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" type="button" onClick={() => setEditor(null)}>Cancel</Button>
              <Button type="submit" loading={busy}>Save</Button>
            </div>
          </form>
        ) : null}
      </Modal>
    </>
  );
}
