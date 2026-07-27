// Built by Anointed Coder.
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { PageHeader } from '@/components/site/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Switch } from '@/components/ui/Switch';
import { FormField, Input, Textarea } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { AdminMediaUpload } from '@/components/admin/AdminMediaUpload';
import { Modal } from '@/components/ui/Modal';
import { Megaphone, Plus, Pencil, Trash2 } from 'lucide-react';
import { Chip } from '@/components/ui/Chip';
import { EmptyState } from '@/components/ui/EmptyState';
import { formatDateTime } from '@/lib/utils/format';
import { useLang } from '@/lib/i18n/context';
import { ConfirmDialog } from '@/components/admin/ConfirmDialog';

// Prefill for <input type="datetime-local">. The stored value is UTC
// ISO; slicing it directly would show UTC in the input, so every
// edit-and-save round trip shifted the schedule by the local offset
// (6 hours in Dhaka). Convert to local wall-clock time first.
const toLocalInput = (iso?: string | null) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};

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
  target: string;
  targetUrl?: string | null;
  frequency: string;
  imageUrl?: string | null;
  audioUrl?: string | null;
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
  target: 'entry',
  targetUrl: '',
  frequency: 'always',
  imageUrl: '',
  audioUrl: '',
  createdAt: '',
};

export default function AdminPopupsPage() {
  const { lang } = useLang();
  const [popups, setPopups] = useState<PopupRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editor, setEditor] = useState<PopupRow | null>(null);
  const [editorError, setEditorError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  // In-page confirm dialog instead of native confirm(), which
  // installed PWAs suppress silently.
  const [deleteTarget, setDeleteTarget] = useState<PopupRow | null>(null);

  const notify = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  };

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
    setEditorError(null);
    const toIso = (v?: string | null) => (v ? new Date(v).toISOString() : null);
    const payload = {
      title: editor.title,
      body: editor.body,
      ctaLabel: editor.ctaLabel || undefined,
      ctaHref: editor.ctaHref || undefined,
      startAt: toIso(editor.startAt),
      endAt: toIso(editor.endAt),
      status: editor.status,
      target: editor.target,
      targetUrl: editor.targetUrl || null,
      frequency: editor.frequency,
      imageUrl: editor.imageUrl || null,
      audioUrl: editor.audioUrl || null,
    };
    try {
      const res = editor.id
        ? await fetch(`/api/admin/popups/${editor.id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) })
        : await fetch('/api/admin/popups', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? data.code);
      setEditor(null);
      notify(editor.id ? 'Popup updated. পপআপ আপডেট হয়েছে।' : 'Popup created. পপআপ তৈরি হয়েছে।');
      await refresh();
    } catch (e) {
      setEditorError(e instanceof Error ? e.message : 'Save failed. সংরক্ষণ ব্যর্থ হয়েছে।');
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (p: PopupRow) => {
    try {
      const res = await fetch(`/api/admin/popups/${p.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ status: p.status === 'active' ? 'hidden' : 'active' }),
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

  const remove = async (p: PopupRow) => {
    try {
      const res = await fetch(`/api/admin/popups/${p.id}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        notify('Popup deleted. পপআপ মুছে ফেলা হয়েছে।');
        refresh();
      } else {
        setError(`${data?.message ?? data?.code ?? 'Delete failed'} (Delete failed. ডিলিট ব্যর্থ হয়েছে।)`);
      }
    } catch {
      setError('Delete failed: network error. ডিলিট ব্যর্থ হয়েছে: নেটওয়ার্ক সমস্যা।');
    }
  };

  return (
    <>
      <PageHeader
        title="Popup Announcements"
        subtitle="Show timely messages to visitors and players"
        icon={<Megaphone className="h-5 w-5" />}
        action={<Button leftIcon={<Plus className="h-4 w-4" />} onClick={() => setEditor({ ...NEW_POPUP })}>New Popup</Button>}
      />

      {toast ? <Card padding="md" className="mb-4"><p className="text-sm text-signal-ok">{toast}</p></Card> : null}
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
                  startAt: toLocalInput(p.startAt),
                  endAt: toLocalInput(p.endAt),
                })}>Edit</Button>
                <Button size="sm" variant="danger" leftIcon={<Trash2 className="h-3.5 w-3.5" />} onClick={() => setDeleteTarget(p)}>Delete</Button>
              </div>
            </Card>
          ))
        )}
      </div>

      <Modal open={!!editor} onOpenChange={(v) => { if (!v) { setEditor(null); setEditorError(null); } }} title={editor?.id ? 'Edit Popup' : 'New Popup'} size="lg">
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

            <div className="grid gap-3 md:grid-cols-2">
              <FormField label="Show on" hint="Where or when the popup appears.">
                <Select value={editor.target} onChange={(e) => setEditor({ ...editor, target: e.target.value })}>
                  <option value="entry">Website entry (first visit)</option>
                  <option value="homepage">Homepage</option>
                  <option value="deposit_page">Deposit page</option>
                  <option value="deposit_click">Deposit button clicked</option>
                  <option value="withdrawal_page">Withdrawal page</option>
                  <option value="auth_page">Register or Login page</option>
                  <option value="all_pages">All pages</option>
                  <option value="custom_url">Custom page / URL</option>
                </Select>
              </FormField>
              <FormField label="Frequency" hint="How often a visitor sees it.">
                <Select value={editor.frequency} onChange={(e) => setEditor({ ...editor, frequency: e.target.value })}>
                  <option value="always">Every time</option>
                  <option value="once_per_user">Once per user</option>
                  <option value="once_per_session">Once per session</option>
                  <option value="once_per_day">Once per day</option>
                </Select>
              </FormField>
            </div>
            {editor.target === 'custom_url' ? (
              <FormField label="Custom page path" hint="e.g. /promotions or /games. Matches this path and anything under it.">
                <Input value={editor.targetUrl ?? ''} onChange={(e) => setEditor({ ...editor, targetUrl: e.target.value })} placeholder="/promotions" />
              </FormField>
            ) : null}
            <AdminMediaUpload
              label="Popup image (optional)"
              hint="Shown at the top of the popup."
              value={editor.imageUrl}
              category="promo_background"
              constraintHint="PNG / JPG / WEBP, max 4 MB"
              onChange={(url) => setEditor({ ...editor, imageUrl: url ?? '' })}
            />
            <FormField label="Voice / audio message (optional)" hint="A speaker icon on the popup plays this recording.">
              <AudioUpload value={editor.audioUrl} onChange={(url) => setEditor({ ...editor, audioUrl: url ?? '' })} />
            </FormField>
            {editorError ? <p className="text-sm text-signal-danger">{editorError}</p> : null}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" type="button" onClick={() => { setEditor(null); setEditorError(null); }}>Cancel</Button>
              <Button type="submit" loading={busy}>Save</Button>
            </div>
          </form>
        ) : null}
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(v) => !v && setDeleteTarget(null)}
        title="Delete popup"
        message={deleteTarget ? `Delete popup "${deleteTarget.title}"? This cannot be undone.` : ''}
        messageBn={deleteTarget ? `"${deleteTarget.title}" পপআপটি মুছে ফেলবেন? এটি আর ফেরানো যাবে না।` : ''}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onConfirm={async () => { if (deleteTarget) await remove(deleteTarget); }}
      />
    </>
  );
}

// Small audio uploader for the popup voice message. Posts to the shared
// uploads endpoint under the 'sounds' category and previews with a native
// audio player.
function AudioUpload({ value, onChange }: { value?: string | null; onChange: (url: string | null) => void }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const upload = async (file: File) => {
    setBusy(true);
    setErr(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('category', 'sounds');
      const res = await fetch('/api/admin/uploads', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message ?? data?.code ?? 'Upload failed');
      onChange(String(data.url));
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2">
      {value ? (
        <div className="flex items-center gap-2">
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <audio controls src={value} className="h-9 w-full max-w-xs" />
          <Button size="sm" variant="ghost" type="button" onClick={() => onChange(null)}>Remove</Button>
        </div>
      ) : null}
      <input
        ref={inputRef}
        type="file"
        accept="audio/*"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void upload(f);
          e.target.value = '';
        }}
      />
      <Button size="sm" variant="neon" type="button" loading={busy} onClick={() => inputRef.current?.click()}>
        {value ? 'Replace audio' : 'Upload audio'}
      </Button>
      {err ? <p className="text-xs text-signal-danger">{err}</p> : null}
    </div>
  );
}
