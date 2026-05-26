// Built by Anointed Coder.
//
// Promo Marquee Text admin. Was mock-backed and never hit the API,
// which is why edits never reached the public PromoTicker on the
// homepage. Now wired to /api/admin/promo-text for full CRUD +
// status toggle + reorder. Public /api/content/promo-text reads the
// same table with revalidate=0 so the homepage marquee reflects the
// change on next reload.

'use client';

import { useCallback, useEffect, useState } from 'react';
import { PageHeader } from '@/components/site/PageHeader';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { FormField, Input } from '@/components/ui/Input';
import { Switch } from '@/components/ui/Switch';
import { Modal } from '@/components/ui/Modal';
import { Type, Plus, ArrowUp, ArrowDown, Trash2, RefreshCw, Pencil, Save } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

type Status = 'active' | 'hidden' | 'paused';

interface PromoRow {
  id: string;
  message: string;
  status: Status;
  position: number;
  createdAt?: string;
}

export default function AdminPromoTextPage() {
  const [items, setItems] = useState<PromoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const [draft, setDraft] = useState('');
  const [creating, setCreating] = useState(false);

  const [editor, setEditor] = useState<PromoRow | null>(null);
  const [saving, setSaving] = useState(false);

  const flashToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 4000); };

  const load = useCallback(async () => {
    setRefreshing(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/promo-text', { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message ?? data?.code ?? 'Failed to load');
      setItems(data.items as PromoRow[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const addNew = async () => {
    const msg = draft.trim();
    if (!msg) return;
    setCreating(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/promo-text', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          message: msg,
          status: 'active',
          position: items.length + 1,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message ?? data?.code ?? 'Create failed');
      setDraft('');
      flashToast('Promo added. Reload the homepage to see it on the marquee.');
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Create failed');
    } finally { setCreating(false); }
  };

  const patch = async (id: string, body: Partial<PromoRow>) => {
    const res = await fetch(`/api/admin/promo-text/${id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.message ?? data?.code ?? 'Save failed');
    return data.item as PromoRow;
  };

  const toggle = async (it: PromoRow) => {
    try {
      await patch(it.id, { status: it.status === 'active' ? 'hidden' : 'active' });
      flashToast(`${it.status === 'active' ? 'Hidden' : 'Activated'} . marquee updates on next homepage load.`);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Toggle failed');
    }
  };

  const move = async (it: PromoRow, dir: 'up' | 'down') => {
    const idx = items.findIndex((x) => x.id === it.id);
    if (idx === -1) return;
    const targetIdx = dir === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= items.length) return;
    const target = items[targetIdx];
    try {
      await Promise.all([
        patch(it.id, { position: target.position }),
        patch(target.id, { position: it.position }),
      ]);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Reorder failed');
    }
  };

  const remove = async (it: PromoRow) => {
    if (!confirm(`Delete promo text "${it.message.slice(0, 60)}"?`)) return;
    try {
      const res = await fetch(`/api/admin/promo-text/${it.id}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message ?? data?.code ?? 'Delete failed');
      flashToast('Deleted.');
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed');
    }
  };

  const saveEdit = async () => {
    if (!editor) return;
    setSaving(true);
    setError(null);
    try {
      await patch(editor.id, { message: editor.message.trim() });
      setEditor(null);
      flashToast('Message updated.');
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally { setSaving(false); }
  };

  const activeCount = items.filter((i) => i.status === 'active').length;

  return (
    <>
      <PageHeader
        title="Promo Text"
        subtitle={`Scrolling marquee above the homepage sections . ${activeCount} active`}
        icon={<Type className="h-5 w-5" />}
        action={
          <Button variant="ghost" leftIcon={<RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} />} onClick={load}>
            Reload
          </Button>
        }
      />

      {toast ? <Card padding="md" className="mb-4"><p className="text-sm text-signal-ok">{toast}</p></Card> : null}
      {error ? <Card padding="md" className="mb-4"><p className="text-sm text-signal-danger">{error}</p></Card> : null}

      <Card padding="lg" className="mb-6">
        <CardHeader title="Add new promo" subtitle="Bangla or English, emoji friendly. Saved to DB; the homepage marquee reads /api/content/promo-text on every load (no ISR)." />
        <form
          className="flex flex-col gap-3 md:flex-row md:items-end"
          onSubmit={(e) => { e.preventDefault(); void addNew(); }}
        >
          <FormField label="Message" required hint="Up to 280 characters. Newly added rows are active by default.">
            <Input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="🎁 New welcome bonus is live" />
          </FormField>
          <Button type="submit" leftIcon={<Plus className="h-4 w-4" />} loading={creating} disabled={!draft.trim()}>
            Add
          </Button>
        </form>
      </Card>

      {loading ? (
        <Card padding="lg"><p className="text-sm text-ink-mid">Loading...</p></Card>
      ) : items.length === 0 ? (
        <Card padding="lg">
          <p className="text-sm text-ink-mid">No promo text yet. Add the first one above. The homepage marquee will stay hidden until at least one row is set to <b>active</b>.</p>
        </Card>
      ) : (
        <Card padding="none" className="overflow-hidden">
          <ul className="divide-y divide-neon/10">
            {items.map((it, idx) => (
              <li key={it.id} className="flex flex-wrap items-center gap-3 p-4">
                <span className="w-6 text-center text-xs text-ink-lo">{idx + 1}</span>
                <Chip tone={it.status === 'active' ? 'ok' : it.status === 'paused' ? 'warn' : 'neutral'}>{it.status}</Chip>
                <p className="min-w-0 flex-1 truncate text-sm text-ink-hi" title={it.message}>{it.message}</p>
                <span className="text-xs text-ink-lo">pos {it.position}</span>
                <Switch checked={it.status === 'active'} onChange={() => toggle(it)} />
                <Button size="icon" variant="ghost" onClick={() => move(it, 'up')} disabled={idx === 0}><ArrowUp className="h-4 w-4" /></Button>
                <Button size="icon" variant="ghost" onClick={() => move(it, 'down')} disabled={idx === items.length - 1}><ArrowDown className="h-4 w-4" /></Button>
                <Button size="sm" variant="neon" leftIcon={<Pencil className="h-3.5 w-3.5" />} onClick={() => setEditor({ ...it })}>Edit</Button>
                <Button size="sm" variant="danger" leftIcon={<Trash2 className="h-3.5 w-3.5" />} onClick={() => remove(it)}>Delete</Button>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card padding="md" className="mt-4">
        <p className="text-xs text-ink-mid">
          <span className="font-semibold text-ink-hi">Tip:</span> the public /api/content/promo-text endpoint disables ISR (revalidate=0) and the
          PromoTicker fetches with cache: no-store, so changes here land on the homepage as soon as the visitor refreshes - no rebuild
          or invalidation needed.
        </p>
      </Card>

      <Modal open={!!editor} onOpenChange={(v) => !v && setEditor(null)} title="Edit promo message" size="md">
        {editor ? (
          <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); void saveEdit(); }}>
            <FormField label="Message" required hint="Up to 280 characters. Use Bangla or English freely - both render in the marquee.">
              <Input value={editor.message} onChange={(e) => setEditor({ ...editor, message: e.target.value })} />
            </FormField>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={() => setEditor(null)}>Cancel</Button>
              <Button type="submit" variant="gold" loading={saving} leftIcon={<Save className="h-3.5 w-3.5" />} disabled={!editor.message.trim()}>
                Save
              </Button>
            </div>
          </form>
        ) : null}
      </Modal>
    </>
  );
}
