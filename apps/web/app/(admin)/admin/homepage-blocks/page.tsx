// Built by Anointed Coder.
//
// /admin/homepage-blocks - flexible custom homepage block manager.
// Each block has its own title + subtitle and one of five source
// types: manual (curated items), category, brand, jackpot, featured.
// Blocks render on the public homepage in position order under the
// legacy PublicSection strips. Empty blocks auto-hide on the public
// site, so the operator can leave WIP blocks invisible until ready.

'use client';

import { useCallback, useEffect, useState } from 'react';
import { PageHeader } from '@/components/site/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { Modal } from '@/components/ui/Modal';
import { Plus, Save, Trash2, ArrowUp, ArrowDown, Eye, EyeOff, Search, Flame, Award, X } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils/cn';

type SourceType = 'manual' | 'category' | 'brand' | 'jackpot' | 'featured';

interface BlockRow {
  id: string;
  key: string;
  titleEn: string;
  titleBn: string | null;
  subtitleEn: string | null;
  subtitleBn: string | null;
  sourceType: SourceType;
  category: string | null;
  brandId: string | null;
  limit: number;
  position: number;
  isVisible: boolean;
  layout: string | null;
  items: ItemRow[];
}

interface ItemRow {
  id: string;
  source: 'external' | 'native';
  externalGameId: string | null;
  nativeGameCode: string | null;
  isHot: boolean;
  isJackpot: boolean;
  position: number;
}

interface EnrichedItem extends ItemRow {
  displayName: string;
  providerName: string;
  brandName: string | null;
  brandKey: string | null;
  category: string | null;
  imageUrl: string | null;
  live: boolean;
}

interface BrandOption { id: string; brandKey: string; displayName: string }

const CATEGORY_OPTIONS = ['slots', 'live_casino', 'table', 'fishing', 'crash', 'flash', 'sportsbook'];
const inputCls = 'w-full rounded-lg border border-brand-divider bg-brand-paper px-3 py-2 text-sm text-brand-ink placeholder:text-brand-inkMute focus:outline-none focus:ring-2 focus:ring-brand-blue-500';

export default function AdminHomepageBlocksPage() {
  const [blocks, setBlocks] = useState<BlockRow[]>([]);
  const [brands, setBrands] = useState<BrandOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openCreate, setOpenCreate] = useState(false);
  const [pickerBlock, setPickerBlock] = useState<BlockRow | null>(null);
  const [savingBlockId, setSavingBlockId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const r = await fetch('/api/admin/homepage-blocks', { cache: 'no-store' });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.message ?? j?.code ?? 'Failed to load blocks');
      setBlocks((j?.blocks as BlockRow[]) ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadBrands = useCallback(async () => {
    try {
      const r = await fetch('/api/admin/providers', { cache: 'no-store' });
      const j = await r.json();
      const list: BrandOption[] = [];
      for (const s of j?.summaries ?? []) {
        for (const b of s.brands ?? []) {
          list.push({ id: b.id, brandKey: b.brandKey, displayName: b.displayName });
        }
      }
      setBrands(list);
    } catch { /* non-fatal */ }
  }, []);

  useEffect(() => { refresh(); loadBrands(); }, [refresh, loadBrands]);

  const onBlockPatch = async (id: string, patch: Partial<BlockRow>) => {
    setSavingBlockId(id);
    try {
      const r = await fetch(`/api/admin/homepage-blocks/${id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(patch),
      });
      const j = await r.json().catch(() => null);
      if (!r.ok) throw new Error(j?.message ?? j?.code ?? 'Save failed');
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSavingBlockId(null);
    }
  };

  const onBlockDelete = async (id: string) => {
    if (!confirm('Delete this block? Items will be removed too.')) return;
    setSavingBlockId(id);
    try {
      const r = await fetch(`/api/admin/homepage-blocks/${id}`, { method: 'DELETE' });
      const j = await r.json().catch(() => null);
      if (!r.ok) throw new Error(j?.message ?? j?.code ?? 'Delete failed');
      setBlocks((rows) => rows.filter((b) => b.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed');
    } finally {
      setSavingBlockId(null);
    }
  };

  const onMove = (id: string, dir: 'up' | 'down') => {
    const sorted = [...blocks].sort((a, b) => a.position - b.position);
    const idx = sorted.findIndex((r) => r.id === id);
    if (idx < 0) return;
    const swap = dir === 'up' ? idx - 1 : idx + 1;
    if (swap < 0 || swap >= sorted.length) return;
    const a = sorted[idx], b = sorted[swap];
    void Promise.all([
      onBlockPatch(a.id, { position: b.position }),
      onBlockPatch(b.id, { position: a.position }),
    ]);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        icon={<Plus className="h-5 w-5" />}
        title="Custom homepage blocks"
        subtitle="Create homepage strips with your own title and curated games. Public homepage shows admin changes on the next page load - no caching."
        action={
          <div className="flex items-center gap-2">
            <Link href="/admin/homepage-sections"><Button variant="ghost">Section + Hot Games</Button></Link>
            <Button variant="gold" leftIcon={<Plus className="h-4 w-4" />} onClick={() => setOpenCreate(true)}>New block</Button>
          </div>
        }
      />

      {error ? <Card padding="sm" className="border-l-4 border-rose-400/60"><p className="text-sm text-rose-300">{error}</p></Card> : null}

      {loading ? (
        <p className="text-sm text-brand-inkMute">Loading...</p>
      ) : blocks.length === 0 ? (
        <Card padding="lg"><p className="text-sm text-brand-inkMute">No custom blocks yet. Click <strong>New block</strong> to add a Slots, Brand, Jackpot or fully manual strip.</p></Card>
      ) : (
        <div className="space-y-3">
          {[...blocks].sort((a, b) => a.position - b.position).map((b, i, arr) => (
            <BlockRowCard
              key={b.id}
              row={b}
              brands={brands}
              saving={savingBlockId === b.id}
              first={i === 0}
              last={i === arr.length - 1}
              onPatch={(patch) => onBlockPatch(b.id, patch)}
              onDelete={() => onBlockDelete(b.id)}
              onMove={(dir) => onMove(b.id, dir)}
              onOpenItems={() => setPickerBlock(b)}
            />
          ))}
        </div>
      )}

      <CreateBlockModal
        open={openCreate}
        onOpenChange={setOpenCreate}
        brands={brands}
        onCreated={() => { setOpenCreate(false); refresh(); }}
      />
      {pickerBlock ? (
        <ItemsModal
          open
          onOpenChange={(v) => { if (!v) setPickerBlock(null); refresh(); }}
          block={pickerBlock}
        />
      ) : null}
    </div>
  );
}

function BlockRowCard({ row, brands, saving, first, last, onPatch, onDelete, onMove, onOpenItems }: {
  row: BlockRow;
  brands: BrandOption[];
  saving: boolean;
  first: boolean;
  last: boolean;
  onPatch: (patch: Partial<BlockRow>) => void;
  onDelete: () => void;
  onMove: (dir: 'up' | 'down') => void;
  onOpenItems: () => void;
}) {
  const [titleEn, setTitleEn] = useState(row.titleEn);
  const [titleBn, setTitleBn] = useState(row.titleBn ?? '');
  const [subtitleEn, setSubtitleEn] = useState(row.subtitleEn ?? '');
  const [subtitleBn, setSubtitleBn] = useState(row.subtitleBn ?? '');
  const [limit, setLimit] = useState(String(row.limit ?? 12));
  const [sourceType, setSourceType] = useState<SourceType>(row.sourceType);
  const [category, setCategory] = useState(row.category ?? 'slots');
  const [brandId, setBrandId] = useState(row.brandId ?? '');

  const onSave = () => onPatch({
    titleEn,
    titleBn: titleBn || null,
    subtitleEn: subtitleEn || null,
    subtitleBn: subtitleBn || null,
    limit: Math.min(Math.max(Number(limit) || 12, 1), 30),
    sourceType,
    category: sourceType === 'category' ? category : null,
    brandId: sourceType === 'brand' ? brandId || null : null,
  });

  return (
    <Card padding="md" className={cn('relative', !row.isVisible && 'opacity-75')}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-[10px] uppercase tracking-wider text-brand-inkMute">{row.key}</span>
            <Chip tone={row.isVisible ? 'ok' : 'neutral'}>{row.isVisible ? 'visible' : 'hidden'}</Chip>
            <Chip tone="neutral">{row.sourceType}</Chip>
            <span className="text-[10px] text-brand-inkMute">position {row.position}</span>
            {row.sourceType === 'manual' ? <span className="text-[10px] text-brand-inkMute">. {row.items.length} game{row.items.length === 1 ? '' : 's'}</span> : null}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button type="button" disabled={first} onClick={() => onMove('up')} className="rounded p-1 text-brand-inkMute hover:bg-brand-surface disabled:opacity-40" title="Move up"><ArrowUp className="h-4 w-4" /></button>
          <button type="button" disabled={last} onClick={() => onMove('down')} className="rounded p-1 text-brand-inkMute hover:bg-brand-surface disabled:opacity-40" title="Move down"><ArrowDown className="h-4 w-4" /></button>
          <button type="button" onClick={() => onPatch({ isVisible: !row.isVisible })} className="rounded p-1 text-brand-inkMute hover:bg-brand-surface" title={row.isVisible ? 'Hide' : 'Show'}>{row.isVisible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}</button>
          <button type="button" onClick={onDelete} className="rounded p-1 text-rose-400 hover:bg-rose-500/10" title="Delete"><Trash2 className="h-4 w-4" /></button>
        </div>
      </div>

      <div className="mt-3 grid gap-2 md:grid-cols-2">
        <input value={titleEn} onChange={(e) => setTitleEn(e.target.value)} className={inputCls} placeholder="Title EN" />
        <input value={titleBn} onChange={(e) => setTitleBn(e.target.value)} className={inputCls} placeholder="Title BN" />
        <input value={subtitleEn} onChange={(e) => setSubtitleEn(e.target.value)} className={inputCls} placeholder="Subtitle EN (optional)" />
        <input value={subtitleBn} onChange={(e) => setSubtitleBn(e.target.value)} className={inputCls} placeholder="Subtitle BN (optional)" />
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wider text-brand-inkMute">Source</label>
          <select value={sourceType} onChange={(e) => setSourceType(e.target.value as SourceType)} className={cn(inputCls, 'mt-1')}>
            <option value="manual">manual (curated)</option>
            <option value="category">category</option>
            <option value="brand">brand</option>
            <option value="jackpot">jackpot</option>
            <option value="featured">featured</option>
          </select>
        </div>
        {sourceType === 'category' ? (
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-brand-inkMute">Category</label>
            <select value={category} onChange={(e) => setCategory(e.target.value)} className={cn(inputCls, 'mt-1')}>
              {CATEGORY_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        ) : null}
        {sourceType === 'brand' ? (
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-brand-inkMute">Brand</label>
            <select value={brandId} onChange={(e) => setBrandId(e.target.value)} className={cn(inputCls, 'mt-1')}>
              <option value="">- pick a brand -</option>
              {brands.map((b) => <option key={b.id} value={b.id}>{b.displayName} ({b.brandKey})</option>)}
            </select>
          </div>
        ) : null}
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wider text-brand-inkMute">Limit (1-30)</label>
          <input type="number" min={1} max={30} value={limit} onChange={(e) => setLimit(e.target.value)} className={cn(inputCls, 'mt-1')} />
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <Button variant="gold" loading={saving} leftIcon={<Save className="h-3.5 w-3.5" />} onClick={onSave}>Save</Button>
        {sourceType === 'manual' ? (
          <Button variant="ghost" leftIcon={<Plus className="h-3.5 w-3.5" />} onClick={onOpenItems}>Edit games ({row.items.length})</Button>
        ) : null}
      </div>
    </Card>
  );
}

function CreateBlockModal({ open, onOpenChange, brands, onCreated }: { open: boolean; onOpenChange: (v: boolean) => void; brands: BrandOption[]; onCreated: () => void }) {
  const [key, setKey] = useState('');
  const [titleEn, setTitleEn] = useState('');
  const [titleBn, setTitleBn] = useState('');
  const [subtitleEn, setSubtitleEn] = useState('');
  const [subtitleBn, setSubtitleBn] = useState('');
  const [sourceType, setSourceType] = useState<SourceType>('manual');
  const [category, setCategory] = useState('slots');
  const [brandId, setBrandId] = useState('');
  const [limit, setLimit] = useState('12');
  const [position, setPosition] = useState('100');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const onSave = async () => {
    setBusy(true); setErr(null);
    try {
      const r = await fetch('/api/admin/homepage-blocks', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          key: key.trim(),
          titleEn: titleEn.trim(),
          titleBn: titleBn.trim() || null,
          subtitleEn: subtitleEn.trim() || null,
          subtitleBn: subtitleBn.trim() || null,
          sourceType,
          category: sourceType === 'category' ? category : undefined,
          brandId: sourceType === 'brand' ? brandId || undefined : undefined,
          limit: Math.min(Math.max(Number(limit) || 12, 1), 30),
          position: Number(position) || 100,
          isVisible: true,
          layout: 'grid',
        }),
      });
      const j = await r.json().catch(() => null);
      if (!r.ok) { setErr(j?.message ?? j?.code ?? 'Create failed'); return; }
      onCreated();
    } catch (e) { setErr(e instanceof Error ? e.message : 'Create failed'); }
    finally { setBusy(false); }
  };

  return (
    <Modal open={open} onOpenChange={onOpenChange} title="New homepage block" description="The block renders on the public homepage in position order. Empty blocks auto-hide." footer={(
      <>
        <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
        <Button variant="gold" loading={busy} leftIcon={<Save className="h-3.5 w-3.5" />} onClick={onSave}>Create</Button>
      </>
    )}>
      {err ? <p className="mb-3 text-sm text-rose-300">{err}</p> : null}
      <div className="grid gap-2 md:grid-cols-2">
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wider text-brand-inkMute">Key (URL slug)</label>
          <input value={key} onChange={(e) => setKey(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))} className={cn(inputCls, 'mt-1')} placeholder="homepage_my_block" />
        </div>
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wider text-brand-inkMute">Source</label>
          <select value={sourceType} onChange={(e) => setSourceType(e.target.value as SourceType)} className={cn(inputCls, 'mt-1')}>
            <option value="manual">manual (curated)</option>
            <option value="category">category</option>
            <option value="brand">brand</option>
            <option value="jackpot">jackpot</option>
            <option value="featured">featured</option>
          </select>
        </div>
        <input value={titleEn} onChange={(e) => setTitleEn(e.target.value)} className={inputCls} placeholder="Title EN" />
        <input value={titleBn} onChange={(e) => setTitleBn(e.target.value)} className={inputCls} placeholder="Title BN" />
        <input value={subtitleEn} onChange={(e) => setSubtitleEn(e.target.value)} className={inputCls} placeholder="Subtitle EN (optional)" />
        <input value={subtitleBn} onChange={(e) => setSubtitleBn(e.target.value)} className={inputCls} placeholder="Subtitle BN (optional)" />
        {sourceType === 'category' ? (
          <select value={category} onChange={(e) => setCategory(e.target.value)} className={inputCls}>
            {CATEGORY_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        ) : null}
        {sourceType === 'brand' ? (
          <select value={brandId} onChange={(e) => setBrandId(e.target.value)} className={inputCls}>
            <option value="">- pick a brand -</option>
            {brands.map((b) => <option key={b.id} value={b.id}>{b.displayName} ({b.brandKey})</option>)}
          </select>
        ) : null}
        <input type="number" min={1} max={30} value={limit} onChange={(e) => setLimit(e.target.value)} className={inputCls} placeholder="Limit (1-30)" />
        <input type="number" value={position} onChange={(e) => setPosition(e.target.value)} className={inputCls} placeholder="Position" />
      </div>
    </Modal>
  );
}

function ItemsModal({ open, onOpenChange, block }: { open: boolean; onOpenChange: (v: boolean) => void; block: BlockRow }) {
  const [items, setItems] = useState<EnrichedItem[]>([]);
  const [q, setQ] = useState('');
  const [results, setResults] = useState<Array<{ source: 'external' | 'native'; id?: string; gameCode?: string; displayName: string; providerName?: string; brandName?: string | null; category?: string | null; imageUrl?: string | null }>>([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const r = await fetch(`/api/admin/homepage-blocks/${block.id}/items`, { cache: 'no-store' });
    const j = await r.json();
    setItems((j?.items as EnrichedItem[]) ?? []);
  }, [block.id]);

  useEffect(() => { load(); }, [load]);

  const search = useCallback(async () => {
    setBusy(true);
    try {
      const params = new URLSearchParams();
      if (q.trim()) params.set('q', q.trim());
      const r = await fetch(`/api/admin/homepage-featured/search?${params}`, { cache: 'no-store' });
      const j = await r.json();
      const list: typeof results = [];
      for (const e of (j?.external ?? [])) list.push({ source: 'external', id: e.id, displayName: e.displayName, providerName: e.providerName, brandName: e.brandName ?? null, category: e.category ?? null, imageUrl: e.imageUrl ?? null });
      for (const n of (j?.native ?? [])) list.push({ source: 'native', gameCode: n.gameCode, displayName: n.displayName });
      setResults(list);
    } finally { setBusy(false); }
  }, [q]);

  useEffect(() => { const t = setTimeout(() => { void search(); }, 250); return () => clearTimeout(t); }, [search]);

  const add = async (r: typeof results[number]) => {
    const body = r.source === 'external'
      ? { source: 'external', externalGameId: r.id }
      : { source: 'native', nativeGameCode: r.gameCode };
    const res = await fetch(`/api/admin/homepage-blocks/${block.id}/items`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
    });
    if (res.ok) load();
  };

  const remove = async (itemId: string) => {
    await fetch(`/api/admin/homepage-blocks/${block.id}/items/${itemId}`, { method: 'DELETE' });
    load();
  };

  const toggleFlag = async (itemId: string, flag: 'isHot' | 'isJackpot', value: boolean) => {
    await fetch(`/api/admin/homepage-blocks/${block.id}/items/${itemId}`, {
      method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ [flag]: value }),
    });
    load();
  };

  return (
    <Modal open={open} onOpenChange={onOpenChange} size="lg" title={`Games in ${block.titleEn}`} description={`${items.length} selected. Max 30. Search and click to add.`}>
      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-brand-inkMute">Selected</h3>
          <ul className="mt-2 max-h-[60vh] space-y-1 overflow-y-auto pr-2">
            {items.length === 0 ? <li className="text-xs text-brand-inkMute">None yet.</li> : null}
            {items.map((it) => (
              <li key={it.id} className="flex items-center gap-2 rounded-lg border border-brand-divider bg-brand-paper px-2 py-1.5 text-xs">
                <div className="min-w-0 grow">
                  <p className="truncate font-semibold text-brand-ink">{it.displayName}</p>
                  <p className="truncate text-[10px] text-brand-inkMute">{it.brandName ?? it.providerName} {it.category ? `. ${it.category}` : ''} {!it.live ? '. removed' : ''}</p>
                </div>
                <button type="button" onClick={() => toggleFlag(it.id, 'isHot', !it.isHot)} className={cn('rounded p-1', it.isHot ? 'bg-rose-500/15 text-rose-200' : 'text-brand-inkMute hover:bg-brand-surface')} title="Toggle hot"><Flame className="h-3.5 w-3.5" /></button>
                <button type="button" onClick={() => toggleFlag(it.id, 'isJackpot', !it.isJackpot)} className={cn('rounded p-1', it.isJackpot ? 'bg-amber-500/15 text-amber-200' : 'text-brand-inkMute hover:bg-brand-surface')} title="Toggle jackpot"><Award className="h-3.5 w-3.5" /></button>
                <button type="button" onClick={() => remove(it.id)} className="rounded p-1 text-rose-400 hover:bg-rose-500/10" title="Remove"><X className="h-3.5 w-3.5" /></button>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-brand-inkMute">Add games</h3>
          <div className="mt-2 flex items-center gap-2">
            <Search className="h-4 w-4 text-brand-inkMute" />
            <input value={q} onChange={(e) => setQ(e.target.value)} className={inputCls} placeholder="Search game name or gameUid" />
          </div>
          {busy ? <p className="mt-2 text-xs text-brand-inkMute">Searching...</p> : null}
          <ul className="mt-2 max-h-[55vh] space-y-1 overflow-y-auto pr-2">
            {results.map((r, i) => (
              <li key={`${r.source}:${r.id ?? r.gameCode}:${i}`} className="flex items-center gap-2 rounded-lg border border-brand-divider bg-brand-paper px-2 py-1.5 text-xs">
                <div className="min-w-0 grow">
                  <p className="truncate font-semibold text-brand-ink">{r.displayName}</p>
                  <p className="truncate text-[10px] text-brand-inkMute">{r.brandName ?? r.providerName ?? 'Pasha Originals'} {r.category ? `. ${r.category}` : ''}</p>
                </div>
                <Button size="sm" variant="ghost" onClick={() => add(r)}>Add</Button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Modal>
  );
}
