// Built by Anointed Coder.
'use client';

import { useCallback, useEffect, useState } from 'react';
import { PageHeader } from '@/components/site/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { Modal } from '@/components/ui/Modal';
import { FormField, Input, Textarea } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Switch } from '@/components/ui/Switch';
import { EmptyState } from '@/components/ui/EmptyState';
import { Ticket, Pencil, Trash2, Plus } from 'lucide-react';
import { formatBDT } from '@/lib/utils/format';

type Accent = 'yellow' | 'blue' | 'red' | 'royal';
type Status = 'active' | 'hidden' | 'paused';

interface Draw {
  id: string;
  name: string;
  schedule?: string | null;
  drawsAt?: string | null;
  digitsCount: number;
  ticketPrice: number | string;
  prizePool: number | string;
  accent: Accent;
  position: number;
  status: Status;
}

const BLANK: Draw = {
  id: '',
  name: '',
  schedule: '',
  drawsAt: '',
  digitsCount: 4,
  ticketPrice: 20,
  prizePool: 100000,
  accent: 'yellow',
  position: 0,
  status: 'active',
};

export default function AdminLottoPage() {
  const [draws, setDraws] = useState<Draw[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editor, setEditor] = useState<Draw | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch('/api/admin/lotto', { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? data.code);
      setDraws((data.draws ?? []) as Draw[]);
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
    const toIso = (v?: string | null) => (v ? new Date(v).toISOString() : null);
    const payload = {
      name: editor.name,
      schedule: editor.schedule || null,
      drawsAt: toIso(editor.drawsAt),
      digitsCount: Number(editor.digitsCount),
      ticketPrice: Number(editor.ticketPrice),
      prizePool: Number(editor.prizePool),
      accent: editor.accent,
      position: Number(editor.position),
      status: editor.status,
    };
    try {
      const res = editor.id
        ? await fetch(`/api/admin/lotto/${editor.id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) })
        : await fetch('/api/admin/lotto', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
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

  const remove = async (id: string) => {
    if (!confirm('Delete this draw?')) return;
    const res = await fetch(`/api/admin/lotto/${id}`, { method: 'DELETE' });
    if (res.ok) refresh();
  };

  const toggle = async (d: Draw) => {
    await fetch(`/api/admin/lotto/${d.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status: d.status === 'active' ? 'hidden' : 'active' }),
    });
    refresh();
  };

  return (
    <>
      <PageHeader
        title="Lotto Draws"
        subtitle="Lottery sections shown on the public /lotto page"
        icon={<Ticket className="h-5 w-5" />}
        action={<Button leftIcon={<Plus className="h-4 w-4" />} onClick={() => setEditor({ ...BLANK, position: draws.length + 1 })}>New Draw</Button>}
      />

      {error ? <Card padding="md" className="mb-4"><p className="text-sm text-signal-danger">{error}</p></Card> : null}

      {loading ? (
        <Card padding="lg">Loading...</Card>
      ) : draws.length === 0 ? (
        <Card padding="lg"><EmptyState title="No lotto draws" description="Create the first draw to populate the public lotto page." /></Card>
      ) : (
        <div className="space-y-3">
          {draws.map((d) => (
            <Card key={d.id} padding="lg" className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-base font-extrabold text-brand-ink">{d.name}</p>
                  <Chip tone={d.status === 'active' ? 'ok' : 'neutral'}>{d.status}</Chip>
                  <span className="text-[11px] text-brand-inkMute">position {d.position}</span>
                </div>
                <p className="text-sm text-brand-inkSoft">{d.schedule ?? 'no schedule'}</p>
                <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-brand-inkSoft">
                  <span><span className="text-brand-inkMute">Digits</span> <span className="font-bold text-brand-ink">{d.digitsCount}</span></span>
                  <span><span className="text-brand-inkMute">Ticket</span> <span className="font-bold text-brand-ink">{formatBDT(Number(d.ticketPrice))}</span></span>
                  <span><span className="text-brand-inkMute">Prize Pool</span> <span className="font-bold text-brand-ink">{formatBDT(Number(d.prizePool), { compact: true })}</span></span>
                  <span><span className="text-brand-inkMute">Accent</span> <span className="font-bold text-brand-ink capitalize">{d.accent}</span></span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={d.status === 'active'} onChange={() => toggle(d)} />
                <Button size="sm" variant="neon" leftIcon={<Pencil className="h-3.5 w-3.5" />} onClick={() => setEditor({ ...d, drawsAt: d.drawsAt ? d.drawsAt.slice(0, 16) : '' })}>Edit</Button>
                <Button size="sm" variant="danger" leftIcon={<Trash2 className="h-3.5 w-3.5" />} onClick={() => remove(d.id)}>Delete</Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal open={!!editor} onOpenChange={(v) => !v && setEditor(null)} title={editor?.id ? 'Edit Draw' : 'New Draw'} size="lg">
        {editor ? (
          <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); void save(); }}>
            <div className="grid gap-3 md:grid-cols-2">
              <FormField label="Name" required>
                <Input value={editor.name} onChange={(e) => setEditor({ ...editor, name: e.target.value })} />
              </FormField>
              <FormField label="Status">
                <Select value={editor.status} onChange={(e) => setEditor({ ...editor, status: e.target.value as Status })}>
                  <option value="active">Active</option>
                  <option value="hidden">Hidden</option>
                  <option value="paused">Paused</option>
                </Select>
              </FormField>
            </div>
            <FormField label="Schedule" hint="Human readable, e.g. Daily 21:00">
              <Input value={editor.schedule ?? ''} onChange={(e) => setEditor({ ...editor, schedule: e.target.value })} />
            </FormField>
            <div className="grid gap-3 md:grid-cols-3">
              <FormField label="Digits">
                <Input type="number" min="1" max="10" value={String(editor.digitsCount)} onChange={(e) => setEditor({ ...editor, digitsCount: Number(e.target.value) || 0 })} />
              </FormField>
              <FormField label="Ticket price (BDT)">
                <Input type="number" min="0" step="1" value={String(editor.ticketPrice)} onChange={(e) => setEditor({ ...editor, ticketPrice: Number(e.target.value) || 0 })} />
              </FormField>
              <FormField label="Prize pool (BDT)">
                <Input type="number" min="0" step="1000" value={String(editor.prizePool)} onChange={(e) => setEditor({ ...editor, prizePool: Number(e.target.value) || 0 })} />
              </FormField>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <FormField label="Next draw at">
                <Input type="datetime-local" value={editor.drawsAt ?? ''} onChange={(e) => setEditor({ ...editor, drawsAt: e.target.value })} />
              </FormField>
              <FormField label="Accent">
                <Select value={editor.accent} onChange={(e) => setEditor({ ...editor, accent: e.target.value as Accent })}>
                  <option value="yellow">Yellow</option>
                  <option value="blue">Blue</option>
                  <option value="red">Red</option>
                  <option value="royal">Royal</option>
                </Select>
              </FormField>
              <FormField label="Position">
                <Input type="number" min="0" value={String(editor.position)} onChange={(e) => setEditor({ ...editor, position: Number(e.target.value) || 0 })} />
              </FormField>
            </div>
            <Textarea rows={2} className="hidden" value={''} onChange={() => undefined} />
            <p className="text-xs text-brand-inkMute">Ticket purchase and prize payout flow ships in Milestone 2.</p>
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
