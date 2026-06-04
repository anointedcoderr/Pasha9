// Built by Anointed Coder.
//
// /admin/spin-segments. Drives the public Spin wheel. Operator adds,
// edits, reorders and toggles segments. Includes a one-click "Seed
// defaults" button that materialises 8 baseline wedges when the table
// is empty so a fresh deployment is never stuck on the "not
// configured" screen.

'use client';

import { useCallback, useEffect, useState } from 'react';
import { PageHeader } from '@/components/site/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { FormField, Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Switch } from '@/components/ui/Switch';
import { Modal } from '@/components/ui/Modal';
import { Chip } from '@/components/ui/Chip';
import { Sparkles, Plus, Pencil, Trash2, RefreshCw, AlertTriangle, ArrowUp, ArrowDown } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

type PayoutType = 'coins' | 'bonus' | 'freebet' | 'freespin' | 'nothing';

interface Segment {
  id: string;
  label: string;
  color: string;
  weight: number;
  payoutType: PayoutType;
  payoutAmount: number;
  turnoverX: number;
  position: number;
  isActive: boolean;
}

const BLANK: Segment = {
  id: '',
  label: '',
  color: '#FFCC00',
  weight: 1,
  payoutType: 'coins',
  payoutAmount: 0,
  turnoverX: 0,
  position: 0,
  isActive: true,
};

export default function AdminSpinSegmentsPage() {
  const [segments, setSegments] = useState<Segment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [editor, setEditor] = useState<Segment | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    setError(null);
    try {
      const r = await fetch('/api/admin/spin-segments', { cache: 'no-store' });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.message ?? j?.code ?? 'Failed to load');
      setSegments(j.segments as Segment[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const onSeedDefaults = async () => {
    setSeeding(true);
    setError(null);
    try {
      const r = await fetch('/api/admin/spin-segments/seed', { method: 'POST' });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.message ?? j?.code ?? 'Seed failed');
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Seed failed');
    } finally {
      setSeeding(false);
    }
  };

  const saveSegment = async () => {
    if (!editor) return;
    setBusy(true);
    setError(null);
    try {
      const payload = {
        label: editor.label,
        color: editor.color || '#FFCC00',
        weight: Number(editor.weight),
        payoutType: editor.payoutType,
        payoutAmount: Number(editor.payoutAmount),
        turnoverX: Number(editor.turnoverX),
        position: Number(editor.position),
        isActive: editor.isActive,
      };
      const r = editor.id
        ? await fetch('/api/admin/spin-segments', {
            method: 'PATCH',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ id: editor.id, ...payload }),
          })
        : await fetch('/api/admin/spin-segments', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(payload),
          });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.message ?? j?.code ?? 'Save failed');
      setEditor(null);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setBusy(false);
    }
  };

  const removeSegment = async (id: string) => {
    if (!confirm('Delete this segment? It cannot be undone.')) return;
    try {
      const r = await fetch(`/api/admin/spin-segments?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
      if (!r.ok) {
        const j = await r.json().catch(() => null);
        throw new Error(j?.message ?? j?.code ?? 'Delete failed');
      }
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed');
    }
  };

  const reorder = async (id: string, dir: 'up' | 'down') => {
    const idx = segments.findIndex((s) => s.id === id);
    const swap = dir === 'up' ? idx - 1 : idx + 1;
    if (idx < 0 || swap < 0 || swap >= segments.length) return;
    const a = segments[idx];
    const b = segments[swap];
    setError(null);
    try {
      await Promise.all([
        fetch('/api/admin/spin-segments', {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ id: a.id, position: b.position }),
        }),
        fetch('/api/admin/spin-segments', {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ id: b.id, position: a.position }),
        }),
      ]);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Reorder failed');
    }
  };

  return (
    <>
      <PageHeader
        title="Spin Segments"
        subtitle={loading ? 'Loading...' : `${segments.length} segment${segments.length === 1 ? '' : 's'} . ${segments.filter((s) => s.isActive).length} active`}
        icon={<Sparkles className="h-5 w-5" />}
        action={
          <div className="flex items-center gap-2">
            <Button variant="ghost" leftIcon={<RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} />} onClick={refresh}>
              Refresh
            </Button>
            <Button leftIcon={<Plus className="h-4 w-4" />} onClick={() => setEditor({ ...BLANK, position: segments.length })}>
              New Segment
            </Button>
          </div>
        }
      />

      {error ? <Card padding="md" className="mb-4 border-l-4 border-rose-500"><p className="text-sm text-rose-300">{error}</p></Card> : null}

      {segments.length === 0 && !loading ? (
        <Card padding="md" className="mb-4 border border-amber-400/50 bg-amber-500/10">
          <div className="flex flex-wrap items-center gap-3">
            <AlertTriangle className="h-5 w-5 shrink-0 text-amber-300" />
            <div className="grow">
              <p className="text-sm font-bold text-amber-100">No spin segments configured.</p>
              <p className="text-xs text-amber-200">
                The public /rewards Spin tab shows {'"Spin wheel is not configured"'} until at least one active segment exists. Seed the default 8-segment wheel below or add segments manually.
              </p>
            </div>
            <Button variant="gold" loading={seeding} onClick={onSeedDefaults}>Seed default wheel</Button>
          </div>
        </Card>
      ) : null}

      {loading ? (
        <Card padding="lg">Loading...</Card>
      ) : (
        <div className="space-y-2">
          {segments.map((s, i) => (
            <Card key={s.id} padding="md" className={cn('flex flex-wrap items-center gap-3', !s.isActive && 'opacity-60')}>
              <span
                aria-hidden
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-xs font-extrabold text-white"
                style={{ background: s.color || '#FFCC00' }}
              >
                {s.label.slice(0, 3)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-extrabold text-brand-ink">{s.label}</p>
                <p className="truncate text-[11px] text-brand-inkMute">
                  {s.payoutType} {s.payoutAmount} . weight {s.weight} . turnover {s.turnoverX}x . pos {s.position}
                </p>
              </div>
              <Chip tone={s.isActive ? 'ok' : 'neutral'}>{s.isActive ? 'active' : 'inactive'}</Chip>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  aria-label="Move up"
                  onClick={() => reorder(s.id, 'up')}
                  disabled={i === 0}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-brand-divider text-brand-inkSoft hover:text-brand-ink disabled:opacity-40"
                >
                  <ArrowUp className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  aria-label="Move down"
                  onClick={() => reorder(s.id, 'down')}
                  disabled={i === segments.length - 1}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-brand-divider text-brand-inkSoft hover:text-brand-ink disabled:opacity-40"
                >
                  <ArrowDown className="h-3.5 w-3.5" />
                </button>
              </div>
              <Button size="sm" variant="ghost" leftIcon={<Pencil className="h-3.5 w-3.5" />} onClick={() => setEditor(s)}>Edit</Button>
              <Button size="sm" variant="danger" leftIcon={<Trash2 className="h-3.5 w-3.5" />} onClick={() => removeSegment(s.id)}>Delete</Button>
            </Card>
          ))}
        </div>
      )}

      <Modal open={!!editor} onOpenChange={(v) => !v && setEditor(null)} title={editor?.id ? 'Edit segment' : 'New segment'} size="lg">
        {editor ? (
          <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); void saveSegment(); }}>
            <div className="grid gap-3 md:grid-cols-2">
              <FormField label="Label" required>
                <Input value={editor.label} onChange={(e) => setEditor({ ...editor, label: e.target.value })} placeholder="100" />
              </FormField>
              <FormField label="Color (hex)">
                <Input value={editor.color} onChange={(e) => setEditor({ ...editor, color: e.target.value })} placeholder="#FFCC00" />
              </FormField>
              <FormField label="Payout type">
                <Select value={editor.payoutType} onChange={(e) => setEditor({ ...editor, payoutType: e.target.value as PayoutType })}>
                  <option value="coins">Coins (bonusBalance)</option>
                  <option value="bonus">Bonus (locked + UserBonus row)</option>
                  <option value="freebet">Freebet (lockedBalance)</option>
                  <option value="freespin">Free spin token</option>
                  <option value="nothing">Try Again (no payout)</option>
                </Select>
              </FormField>
              <FormField label="Payout amount">
                <Input type="number" min={0} value={String(editor.payoutAmount)} onChange={(e) => setEditor({ ...editor, payoutAmount: Number(e.target.value) || 0 })} />
              </FormField>
              <FormField label="Weight" hint="Higher = more likely. Sum across all active segments is the divisor.">
                <Input type="number" min={1} value={String(editor.weight)} onChange={(e) => setEditor({ ...editor, weight: Number(e.target.value) || 1 })} />
              </FormField>
              <FormField label="Turnover multiplier" hint="Used only for payoutType=bonus. 3 means 3x wager required to release.">
                <Input type="number" min={0} step="0.1" value={String(editor.turnoverX)} onChange={(e) => setEditor({ ...editor, turnoverX: Number(e.target.value) || 0 })} />
              </FormField>
              <FormField label="Position (sort order)">
                <Input type="number" min={0} value={String(editor.position)} onChange={(e) => setEditor({ ...editor, position: Number(e.target.value) || 0 })} />
              </FormField>
              <div className="flex items-center justify-between rounded-lg border border-brand-divider bg-brand-surface p-3">
                <p className="text-sm font-semibold text-brand-ink">Active</p>
                <Switch checked={editor.isActive} onChange={(v) => setEditor({ ...editor, isActive: v })} />
              </div>
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
