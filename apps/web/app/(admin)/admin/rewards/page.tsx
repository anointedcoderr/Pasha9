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
import { Trophy, Pencil, Trash2, Plus } from 'lucide-react';

type Accent = 'yellow' | 'blue' | 'red' | 'green';
type Status = 'active' | 'hidden' | 'paused';
type Category = 'recharge' | 'spin' | 'bet' | 'physical' | 'misc';
type RewardType = 'recharge' | 'physical' | 'digital';

interface RewardItem {
  id: string;
  title: string;
  titleBn?: string | null;
  description?: string | null;
  descriptionBn?: string | null;
  cost: number;
  category: Category;
  rewardType: RewardType;
  accent: Accent;
  imageUrl?: string | null;
  bannerUrl?: string | null;
  shortInstructionEn?: string | null;
  shortInstructionBn?: string | null;
  position: number;
  status: Status;
}

const BLANK: RewardItem = {
  id: '',
  title: '',
  titleBn: '',
  description: '',
  descriptionBn: '',
  cost: 1000,
  category: 'misc',
  rewardType: 'digital',
  accent: 'yellow',
  imageUrl: '',
  bannerUrl: '',
  shortInstructionEn: '',
  shortInstructionBn: '',
  position: 0,
  status: 'active',
};

export default function AdminRewardsPage() {
  const [items, setItems] = useState<RewardItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editor, setEditor] = useState<RewardItem | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch('/api/admin/rewards', { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? data.code);
      setItems((data.items ?? []) as RewardItem[]);
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
      title: editor.title,
      titleBn: editor.titleBn || null,
      description: editor.description || null,
      descriptionBn: editor.descriptionBn || null,
      cost: Number(editor.cost),
      category: editor.category,
      rewardType: editor.rewardType,
      accent: editor.accent,
      imageUrl: editor.imageUrl || null,
      bannerUrl: editor.bannerUrl || null,
      shortInstructionEn: editor.shortInstructionEn || null,
      shortInstructionBn: editor.shortInstructionBn || null,
      position: Number(editor.position),
      status: editor.status,
    };
    try {
      const res = editor.id
        ? await fetch(`/api/admin/rewards/${editor.id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) })
        : await fetch('/api/admin/rewards', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
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
    if (!confirm('Delete this reward?')) return;
    const res = await fetch(`/api/admin/rewards/${id}`, { method: 'DELETE' });
    if (res.ok) refresh();
  };

  const toggle = async (r: RewardItem) => {
    await fetch(`/api/admin/rewards/${r.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status: r.status === 'active' ? 'hidden' : 'active' }),
    });
    refresh();
  };

  return (
    <>
      <PageHeader
        title="Reward Catalog"
        subtitle="Items shown in the Reward Store tab on the public /rewards page"
        icon={<Trophy className="h-5 w-5" />}
        action={<Button leftIcon={<Plus className="h-4 w-4" />} onClick={() => setEditor({ ...BLANK, position: items.length + 1 })}>New Reward</Button>}
      />

      {error ? <Card padding="md" className="mb-4"><p className="text-sm text-signal-danger">{error}</p></Card> : null}

      {loading ? (
        <Card padding="lg">Loading...</Card>
      ) : items.length === 0 ? (
        <Card padding="lg"><EmptyState title="No rewards" description="Add reward items so players can browse and (in M2) redeem them." /></Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {items.map((r) => (
            <Card key={r.id} padding="md" className="flex flex-col gap-2">
              <div className="flex items-start justify-between gap-2">
                <p className="text-base font-extrabold text-brand-ink">{r.title}</p>
                <Chip tone={r.status === 'active' ? 'ok' : 'neutral'}>{r.status}</Chip>
              </div>
              <p className="text-sm text-brand-inkSoft">{r.description}</p>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-brand-inkSoft">
                <span><span className="text-brand-inkMute">Cost</span> <span className="font-bold text-brand-ink tabular-nums">{r.cost.toLocaleString()} coins</span></span>
                <span><span className="text-brand-inkMute">Category</span> <span className="font-bold text-brand-ink capitalize">{r.category}</span></span>
                <span><span className="text-brand-inkMute">Accent</span> <span className="font-bold text-brand-ink capitalize">{r.accent}</span></span>
                <span><span className="text-brand-inkMute">Position</span> <span className="font-bold text-brand-ink">{r.position}</span></span>
              </div>
              <div className="mt-3 flex items-center justify-between">
                <Switch checked={r.status === 'active'} onChange={() => toggle(r)} />
                <div className="flex gap-2">
                  <Button size="sm" variant="neon" leftIcon={<Pencil className="h-3.5 w-3.5" />} onClick={() => setEditor(r)}>Edit</Button>
                  <Button size="sm" variant="danger" leftIcon={<Trash2 className="h-3.5 w-3.5" />} onClick={() => remove(r.id)}>Delete</Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal open={!!editor} onOpenChange={(v) => !v && setEditor(null)} title={editor?.id ? 'Edit Reward' : 'New Reward'} size="lg">
        {editor ? (
          <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); void save(); }}>
            <div className="grid gap-3 md:grid-cols-2">
              <FormField label="Title EN" required>
                <Input value={editor.title} onChange={(e) => setEditor({ ...editor, title: e.target.value })} />
              </FormField>
              <FormField label="Title BN">
                <Input value={editor.titleBn ?? ''} onChange={(e) => setEditor({ ...editor, titleBn: e.target.value })} />
              </FormField>
            </div>
            <FormField label="Description EN">
              <Textarea rows={2} value={editor.description ?? ''} onChange={(e) => setEditor({ ...editor, description: e.target.value })} />
            </FormField>
            <FormField label="Description BN">
              <Textarea rows={2} value={editor.descriptionBn ?? ''} onChange={(e) => setEditor({ ...editor, descriptionBn: e.target.value })} />
            </FormField>
            <div className="grid gap-3 md:grid-cols-2">
              <FormField label="Image URL (square thumbnail)">
                <Input value={editor.imageUrl ?? ''} onChange={(e) => setEditor({ ...editor, imageUrl: e.target.value })} placeholder="https://..." />
              </FormField>
              <FormField label="Banner URL (wide reward card image)">
                <Input value={editor.bannerUrl ?? ''} onChange={(e) => setEditor({ ...editor, bannerUrl: e.target.value })} placeholder="https://..." />
              </FormField>
            </div>
            <FormField label="Short claim instructions EN (shown above the claim form)">
              <Textarea rows={2} value={editor.shortInstructionEn ?? ''} onChange={(e) => setEditor({ ...editor, shortInstructionEn: e.target.value })} />
            </FormField>
            <FormField label="Short claim instructions BN">
              <Textarea rows={2} value={editor.shortInstructionBn ?? ''} onChange={(e) => setEditor({ ...editor, shortInstructionBn: e.target.value })} />
            </FormField>
            <div className="grid gap-3 md:grid-cols-4">
              <FormField label="Cost (coins)">
                <Input type="number" min="0" step="100" value={String(editor.cost)} onChange={(e) => setEditor({ ...editor, cost: Number(e.target.value) || 0 })} />
              </FormField>
              <FormField label="Category">
                <Select value={editor.category} onChange={(e) => setEditor({ ...editor, category: e.target.value as Category })}>
                  <option value="recharge">Recharge</option>
                  <option value="spin">Spin</option>
                  <option value="bet">Free Bet</option>
                  <option value="physical">Physical</option>
                  <option value="misc">Misc</option>
                </Select>
              </FormField>
              <FormField label="Claim flow">
                <Select value={editor.rewardType} onChange={(e) => setEditor({ ...editor, rewardType: e.target.value as RewardType })}>
                  <option value="recharge">Mobile recharge (operator + phone)</option>
                  <option value="physical">Physical (name + address)</option>
                  <option value="digital">Digital (confirm only)</option>
                </Select>
              </FormField>
              <FormField label="Accent">
                <Select value={editor.accent} onChange={(e) => setEditor({ ...editor, accent: e.target.value as Accent })}>
                  <option value="yellow">Yellow</option>
                  <option value="blue">Blue</option>
                  <option value="red">Red</option>
                  <option value="green">Green</option>
                </Select>
              </FormField>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <FormField label="Position">
                <Input type="number" min="0" value={String(editor.position)} onChange={(e) => setEditor({ ...editor, position: Number(e.target.value) || 0 })} />
              </FormField>
              <FormField label="Status">
                <Select value={editor.status} onChange={(e) => setEditor({ ...editor, status: e.target.value as Status })}>
                  <option value="active">Active</option>
                  <option value="hidden">Hidden</option>
                  <option value="paused">Paused</option>
                </Select>
              </FormField>
            </div>
            <p className="text-xs text-brand-inkMute">Real claim, wallet deduct and prize fulfilment ship in Milestone 2.</p>
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
