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

type PayoutType = 'coins' | 'bonus' | 'cash' | 'free_bet' | 'freebet' | 'freespin' | 'nothing' | 'loss';

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
  tierId: string | null;
}

interface Tier {
  id: string;
  key: string;
  nameEn: string;
  nameBn: string | null;
  costPerSpin: number;
  freeSpinsPerDay: number;
  color: string;
  position: number;
  isActive: boolean;
  segmentCount: number;
}

const LEGACY_TAB = 'legacy';

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
  tierId: null,
};

export default function AdminSpinSegmentsPage() {
  const [segments, setSegments] = useState<Segment[]>([]);
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [activeTab, setActiveTab] = useState<string>('');
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
      const [a, b] = await Promise.all([
        fetch('/api/admin/spin-tiers', { cache: 'no-store' }),
        fetch('/api/admin/spin-segments', { cache: 'no-store' }),
      ]);
      const ja = await a.json();
      const jb = await b.json();
      if (!a.ok) throw new Error(ja?.message ?? ja?.code ?? 'Failed to load tiers');
      if (!b.ok) throw new Error(jb?.message ?? jb?.code ?? 'Failed to load segments');
      const loadedTiers = (ja.tiers as Tier[]) ?? [];
      setTiers(loadedTiers);
      setSegments(jb.segments as Segment[]);
      // Default tab: first tier if any tiers exist, else legacy.
      if (!activeTab) {
        setActiveTab(loadedTiers[0]?.id ?? LEGACY_TAB);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => { refresh(); /* eslint-disable-line react-hooks/exhaustive-deps */ }, []);

  const visibleSegments = segments.filter((s) => (activeTab === LEGACY_TAB ? s.tierId == null : s.tierId === activeTab));
  const hasLegacyRows = segments.some((s) => s.tierId == null);

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
        tierId: editor.tierId ?? null,
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
    // Reorder within the visible tier so swaps stay inside one wheel.
    const idx = visibleSegments.findIndex((s) => s.id === id);
    const swap = dir === 'up' ? idx - 1 : idx + 1;
    if (idx < 0 || swap < 0 || swap >= visibleSegments.length) return;
    const a = visibleSegments[idx];
    const b = visibleSegments[swap];
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
        title="Spin Wheel"
        subtitle={loading
          ? 'Loading...'
          : `${tiers.length} tier${tiers.length === 1 ? '' : 's'} . ${segments.length} segment${segments.length === 1 ? '' : 's'} . ${segments.filter((s) => s.isActive).length} active`}
        icon={<Sparkles className="h-5 w-5" />}
        action={
          <div className="flex items-center gap-2">
            <Button variant="ghost" leftIcon={<RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} />} onClick={refresh}>
              Refresh
            </Button>
            <Button
              leftIcon={<Plus className="h-4 w-4" />}
              onClick={() => setEditor({
                ...BLANK,
                position: visibleSegments.length,
                tierId: activeTab === LEGACY_TAB ? null : activeTab,
              })}
            >
              New Segment
            </Button>
          </div>
        }
      />

      {error ? <Card padding="md" className="mb-4 border-l-4 border-rose-500"><p className="text-sm text-rose-300">{error}</p></Card> : null}

      {tiers.length === 0 && !loading ? (
        <Card padding="md" className="mb-4 border border-amber-400/50 bg-amber-500/10">
          <div className="flex flex-wrap items-center gap-3">
            <AlertTriangle className="h-5 w-5 shrink-0 text-amber-300" />
            <div className="grow">
              <p className="text-sm font-bold text-amber-100">No spin wheel configured.</p>
              <p className="text-xs text-amber-200">
                Seed the default 3-tier wheel (Lucky / Grand / Supreme) below. The seed is idempotent and migrates any legacy untiered segments to the Lucky tier.
              </p>
            </div>
            <Button variant="gold" loading={seeding} onClick={onSeedDefaults}>Seed default 3-tier wheel</Button>
          </div>
        </Card>
      ) : null}

      {tiers.length > 0 ? (
        <Card padding="sm" className="mb-3">
          <div role="tablist" aria-label="Spin wheel tiers" className="flex flex-wrap gap-1">
            {tiers.map((t) => {
              const active = activeTab === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setActiveTab(t.id)}
                  className={cn(
                    'inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-xs font-bold uppercase tracking-wider transition',
                    active
                      ? 'border-brand-yellow-500 bg-brand-yellow-500/15 text-brand-ink'
                      : 'border-brand-divider text-brand-inkSoft hover:text-brand-ink',
                  )}
                >
                  <span aria-hidden className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: t.color }} />
                  {t.nameEn}
                  <span className="rounded-full bg-brand-surface px-1.5 py-0.5 text-[10px] text-brand-inkMute">{t.segmentCount}</span>
                </button>
              );
            })}
            {hasLegacyRows ? (
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === LEGACY_TAB}
                onClick={() => setActiveTab(LEGACY_TAB)}
                className={cn(
                  'inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-xs font-bold uppercase tracking-wider transition',
                  activeTab === LEGACY_TAB
                    ? 'border-brand-yellow-500 bg-brand-yellow-500/15 text-brand-ink'
                    : 'border-brand-divider text-brand-inkSoft hover:text-brand-ink',
                )}
              >
                Legacy (untiered)
              </button>
            ) : null}
          </div>
          {activeTab !== LEGACY_TAB ? (() => {
            const t = tiers.find((x) => x.id === activeTab);
            if (!t) return null;
            return (
              <p className="mt-2 text-[11px] text-brand-inkMute">
                key <code className="font-mono">{t.key}</code> . cost {t.costPerSpin} coins . {t.freeSpinsPerDay} free spins/day . pos {t.position} . {t.isActive ? 'active' : 'paused'}
              </p>
            );
          })() : null}
        </Card>
      ) : null}

      {loading ? (
        <Card padding="lg">Loading...</Card>
      ) : (
        <div className="space-y-2">
          {visibleSegments.length === 0 && tiers.length > 0 ? (
            <Card padding="md"><p className="text-sm text-brand-inkMute">No segments on this tier yet. Use New Segment to add wedges.</p></Card>
          ) : null}
          {visibleSegments.map((s, i) => (
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
                  <option value="cash">BDT cash (Wallet.balance, turnover-locked)</option>
                  <option value="free_bet">Free Bet (Wallet.balance, 1x turnover)</option>
                  <option value="bonus">Bonus (lockedBalance + UserBonus)</option>
                  <option value="coins">Coins (bonusBalance, non-monetary)</option>
                  <option value="nothing">Try Again (no payout)</option>
                  <option value="loss">0 BDT (loss, no payout)</option>
                  <option value="freebet">Freebet legacy (no-op)</option>
                  <option value="freespin">Free spin token (no-op)</option>
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
