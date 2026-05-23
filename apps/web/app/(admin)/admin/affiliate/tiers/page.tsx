// Built by Anointed Coder.
'use client';

import { useCallback, useEffect, useState } from 'react';
import { PageHeader } from '@/components/site/PageHeader';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { Modal } from '@/components/ui/Modal';
import { FormField, Input, Textarea } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Switch } from '@/components/ui/Switch';
import { EmptyState } from '@/components/ui/EmptyState';
import { Trophy, Pencil, Trash2, Plus } from 'lucide-react';

type Status = 'active' | 'hidden' | 'paused';

interface Tier {
  id: string;
  name: string;
  description?: string | null;
  level1Pct: number | string;
  level2Pct: number | string;
  level3Pct: number | string;
  minActiveReferrals: number;
  minMonthlyVolume: number | string;
  position: number;
  status: Status;
}

const BLANK: Tier = {
  id: '',
  name: '',
  description: '',
  level1Pct: 8,
  level2Pct: 4,
  level3Pct: 2,
  minActiveReferrals: 0,
  minMonthlyVolume: 0,
  position: 0,
  status: 'active',
};

export default function AdminAffiliateTiersPage() {
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editor, setEditor] = useState<Tier | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch('/api/admin/affiliate/tiers', { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? data.code);
      setTiers((data.tiers ?? []) as Tier[]);
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
    const payload = {
      name: editor.name,
      description: editor.description || null,
      level1Pct: Number(editor.level1Pct),
      level2Pct: Number(editor.level2Pct),
      level3Pct: Number(editor.level3Pct),
      minActiveReferrals: Number(editor.minActiveReferrals),
      minMonthlyVolume: Number(editor.minMonthlyVolume),
      position: Number(editor.position),
      status: editor.status,
    };
    try {
      const res = editor.id
        ? await fetch(`/api/admin/affiliate/tiers/${editor.id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) })
        : await fetch('/api/admin/affiliate/tiers', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
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
    if (!confirm('Delete this tier?')) return;
    const res = await fetch(`/api/admin/affiliate/tiers/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok) {
      alert(data.message ?? data.code);
      return;
    }
    refresh();
  };

  const toggle = async (t: Tier) => {
    await fetch(`/api/admin/affiliate/tiers/${t.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status: t.status === 'active' ? 'hidden' : 'active' }),
    });
    refresh();
  };

  return (
    <>
      <PageHeader
        title="Commission Tiers"
        subtitle="Tune affiliate commission percentages and qualification rules"
        icon={<Trophy className="h-5 w-5" />}
        action={<Button leftIcon={<Plus className="h-4 w-4" />} onClick={() => setEditor({ ...BLANK, position: tiers.length + 1 })}>New Tier</Button>}
      />

      {error ? <Card padding="md" className="mb-4"><p className="text-sm text-signal-danger">{error}</p></Card> : null}

      {loading ? (
        <Card padding="lg">Loading...</Card>
      ) : tiers.length === 0 ? (
        <Card padding="lg"><EmptyState title="No tiers yet" description="Create the first commission tier to start the affiliate program." /></Card>
      ) : (
        <div className="space-y-3">
          {tiers.map((t) => (
            <Card key={t.id} padding="lg" className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-2">
                  <p className="text-base font-extrabold capitalize text-ink-hi">{t.name}</p>
                  <Chip tone={t.status === 'active' ? 'ok' : 'neutral'}>{t.status}</Chip>
                  <span className="text-[11px] text-ink-lo">position {t.position}</span>
                </div>
                {t.description ? <p className="text-sm text-ink-mid">{t.description}</p> : null}
                <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-mid">
                  <span><span className="text-ink-lo">L1</span> <span className="font-bold text-ink-hi">{Number(t.level1Pct)}%</span></span>
                  <span><span className="text-ink-lo">L2</span> <span className="font-bold text-ink-hi">{Number(t.level2Pct)}%</span></span>
                  <span><span className="text-ink-lo">L3</span> <span className="font-bold text-ink-hi">{Number(t.level3Pct)}%</span></span>
                  <span><span className="text-ink-lo">Min referrals</span> <span className="font-bold text-ink-hi">{t.minActiveReferrals}</span></span>
                  <span><span className="text-ink-lo">Min volume</span> <span className="font-bold text-ink-hi">৳ {Number(t.minMonthlyVolume).toLocaleString()}</span></span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={t.status === 'active'} onChange={() => toggle(t)} />
                <Button size="sm" variant="neon" leftIcon={<Pencil className="h-3.5 w-3.5" />} onClick={() => setEditor(t)}>Edit</Button>
                <Button size="sm" variant="danger" leftIcon={<Trash2 className="h-3.5 w-3.5" />} onClick={() => remove(t.id)}>Delete</Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal open={!!editor} onOpenChange={(v) => !v && setEditor(null)} title={editor?.id ? 'Edit Tier' : 'New Tier'} size="lg">
        {editor ? (
          <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); void save(); }}>
            <div className="grid gap-3 md:grid-cols-2">
              <FormField label="Tier name" required hint="bronze, silver, gold, vip, etc.">
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
            <FormField label="Description" hint="Shown on the public /affiliate page">
              <Textarea rows={2} value={editor.description ?? ''} onChange={(e) => setEditor({ ...editor, description: e.target.value })} />
            </FormField>
            <div className="grid gap-3 md:grid-cols-3">
              <FormField label="Level 1 %" required>
                <Input type="number" step="0.01" min="0" max="100" value={String(editor.level1Pct)} onChange={(e) => setEditor({ ...editor, level1Pct: Number(e.target.value) || 0 })} />
              </FormField>
              <FormField label="Level 2 %" required>
                <Input type="number" step="0.01" min="0" max="100" value={String(editor.level2Pct)} onChange={(e) => setEditor({ ...editor, level2Pct: Number(e.target.value) || 0 })} />
              </FormField>
              <FormField label="Level 3 %" required>
                <Input type="number" step="0.01" min="0" max="100" value={String(editor.level3Pct)} onChange={(e) => setEditor({ ...editor, level3Pct: Number(e.target.value) || 0 })} />
              </FormField>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <FormField label="Min active referrals">
                <Input type="number" step="1" min="0" value={String(editor.minActiveReferrals)} onChange={(e) => setEditor({ ...editor, minActiveReferrals: Number(e.target.value) || 0 })} />
              </FormField>
              <FormField label="Min monthly volume (BDT)">
                <Input type="number" step="100" min="0" value={String(editor.minMonthlyVolume)} onChange={(e) => setEditor({ ...editor, minMonthlyVolume: Number(e.target.value) || 0 })} />
              </FormField>
              <FormField label="Position">
                <Input type="number" min="0" value={String(editor.position)} onChange={(e) => setEditor({ ...editor, position: Number(e.target.value) || 0 })} />
              </FormField>
            </div>
            <CardHeader title="Note" subtitle="Saving writes an ActivityLog entry. Commission auto-calc using these rates launches in Milestone 2." />
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
