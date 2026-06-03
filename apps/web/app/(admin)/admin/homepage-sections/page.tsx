// Built by Anointed Coder.
//
// /admin/homepage-sections - two-pane editor for the public homepage.
//   Pane A: section manager. Edit title EN/BN, subtitle EN/BN, visibility,
//           position for every PublicSection row in group='homepage'.
//   Pane B: featured-game manager. Search games across ExternalGame and
//           NativeGameProvider, add up to 20 to the curated list,
//           toggle Hot / Jackpot, reorder by position, remove.

'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { PageHeader } from '@/components/site/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { Modal } from '@/components/ui/Modal';
import { LayoutGrid, Eye, EyeOff, Save, Trash2, Plus, Search, Flame, Award, ArrowUp, ArrowDown } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

interface SectionRow {
  id: string;
  key: string;
  group: string;
  titleEn: string;
  titleBn: string | null;
  subtitleEn: string | null;
  subtitleBn: string | null;
  position: number;
  isVisible: boolean;
  layout: string | null;
}

interface FeaturedRow {
  id: string;
  source: 'external' | 'native';
  externalGameId: string | null;
  nativeGameCode: string | null;
  isHot: boolean;
  isJackpot: boolean;
  position: number;
  displayName: string;
  providerName: string;
  category: string | null;
  imageUrl: string | null;
  live: boolean;
  createdAt: string;
}

interface SearchExternal {
  source: 'external';
  id: string;
  displayName: string;
  gameUid: string;
  category: string | null;
  imageUrl: string | null;
  providerId: string;
  providerKey: string | null;
  providerName: string;
  brandName: string | null;
}
interface SearchNative {
  source: 'native';
  gameCode: string;
  displayName: string;
}

const FEATURED_LIMIT = 20;
const inputCls = 'w-full rounded-lg border border-brand-divider bg-brand-paper px-3 py-2 text-sm text-brand-ink placeholder:text-brand-inkMute focus:outline-none focus:ring-2 focus:ring-brand-blue-500';

export default function AdminHomepageSectionsPage() {
  const [sections, setSections] = useState<SectionRow[]>([]);
  const [featured, setFeatured] = useState<FeaturedRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingSectionId, setSavingSectionId] = useState<string | null>(null);
  const [savingFeaturedId, setSavingFeaturedId] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const [a, b] = await Promise.all([
        fetch('/api/admin/homepage-sections', { cache: 'no-store' }),
        fetch('/api/admin/homepage-featured', { cache: 'no-store' }),
      ]);
      const ja = await a.json();
      const jb = await b.json();
      if (!a.ok) throw new Error(ja?.message ?? ja?.code ?? 'Failed to load sections');
      if (!b.ok) throw new Error(jb?.message ?? jb?.code ?? 'Failed to load featured games');
      setSections(ja.sections as SectionRow[]);
      setFeatured(jb.featured as FeaturedRow[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const onSectionPatch = async (id: string, patch: Partial<SectionRow>) => {
    setSavingSectionId(id);
    try {
      const r = await fetch(`/api/admin/homepage-sections/${id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(patch),
      });
      const j = await r.json().catch(() => null);
      if (!r.ok) throw new Error(j?.message ?? j?.code ?? 'Save failed');
      setSections((rows) => rows.map((s) => (s.id === id ? { ...s, ...(j.section as SectionRow) } : s)));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSavingSectionId(null);
    }
  };

  const onFeaturedPatch = async (id: string, patch: Partial<FeaturedRow>) => {
    setSavingFeaturedId(id);
    try {
      const r = await fetch(`/api/admin/homepage-featured/${id}`, {
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
      setSavingFeaturedId(null);
    }
  };

  const onFeaturedDelete = async (id: string) => {
    setSavingFeaturedId(id);
    try {
      const r = await fetch(`/api/admin/homepage-featured/${id}`, { method: 'DELETE' });
      const j = await r.json().catch(() => null);
      if (!r.ok) throw new Error(j?.message ?? j?.code ?? 'Delete failed');
      setFeatured((rows) => rows.filter((f) => f.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed');
    } finally {
      setSavingFeaturedId(null);
    }
  };

  const onReorder = (id: string, dir: 'up' | 'down') => {
    const rows = [...featured];
    const idx = rows.findIndex((r) => r.id === id);
    if (idx < 0) return;
    const swap = dir === 'up' ? idx - 1 : idx + 1;
    if (swap < 0 || swap >= rows.length) return;
    const a = rows[idx];
    const b = rows[swap];
    const newAPos = b.position;
    const newBPos = a.position;
    void Promise.all([
      onFeaturedPatch(a.id, { position: newAPos }),
      onFeaturedPatch(b.id, { position: newBPos }),
    ]);
  };

  const remaining = FEATURED_LIMIT - featured.length;

  return (
    <div className="space-y-6">
      <PageHeader
        icon={<LayoutGrid className="h-5 w-5" />}
        title="Homepage sections"
        subtitle="Edit public homepage strips and curate the featured-game list. All changes go live on the next homepage load."
      />

      {error ? <Card padding="sm" className="border-l-4 border-rose-400/60"><p className="text-sm text-rose-300">{error}</p></Card> : null}

      <Card padding="md">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-brand-inkMute">Section manager</p>
            <h2 className="text-lg font-extrabold text-brand-ink">Strips on /</h2>
            <p className="text-xs text-brand-inkMute">Edit title, subtitle, visibility and order. Strips with no games render hidden on the public site.</p>
          </div>
          <Button variant="ghost" onClick={refresh} loading={loading}>Refresh</Button>
        </div>

        <div className="mt-4 space-y-3">
          {sections.length === 0 && !loading ? (
            <p className="text-sm text-brand-inkMute">No PublicSection rows in group=&apos;homepage&apos;. Did the Phase A seed run?</p>
          ) : null}
          {sections.map((s) => (
            <SectionEditorRow
              key={s.id}
              row={s}
              saving={savingSectionId === s.id}
              onPatch={(patch) => onSectionPatch(s.id, patch)}
            />
          ))}
        </div>
      </Card>

      <Card padding="md">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-brand-inkMute">Featured game manager</p>
            <h2 className="text-lg font-extrabold text-brand-ink">Hot Games curation</h2>
            <p className="text-xs text-brand-inkMute">
              {featured.length} / {FEATURED_LIMIT} selected. Hot Games strip on the homepage renders these in order.
            </p>
          </div>
          <Button
            variant="gold"
            leftIcon={<Plus className="h-4 w-4" />}
            onClick={() => setPickerOpen(true)}
            disabled={remaining <= 0}
          >
            {remaining <= 0 ? `Max ${FEATURED_LIMIT} reached` : 'Add featured game'}
          </Button>
        </div>

        {remaining <= 0 ? (
          <p className="mt-3 text-[11px] text-amber-300">Limit reached. Remove a row to add a different game.</p>
        ) : null}

        <div className="mt-4 space-y-2">
          {featured.length === 0 ? (
            <p className="text-sm text-brand-inkMute">No featured games yet. Add the first one to populate the Hot Games strip.</p>
          ) : null}
          {featured.map((f, i) => (
            <div key={f.id} className={cn('flex flex-wrap items-center gap-3 rounded-lg border border-brand-divider bg-brand-surface px-3 py-2', !f.live && 'opacity-60')}>
              <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-brand-yellow-500/15 text-[11px] font-bold text-brand-yellow-700">{i + 1}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-brand-ink">{f.displayName}</p>
                <p className="truncate text-[11px] text-brand-inkMute">
                  {f.providerName}{f.category ? ` . ${f.category}` : ''}{f.source === 'native' ? ' . native' : ''}
                </p>
              </div>
              {!f.live ? <Chip tone="warn">Inactive</Chip> : null}
              <button
                type="button"
                onClick={() => onFeaturedPatch(f.id, { isHot: !f.isHot })}
                disabled={savingFeaturedId === f.id}
                className={cn(
                  'inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-bold uppercase tracking-wider transition',
                  f.isHot ? 'border-rose-300/60 bg-rose-500/20 text-rose-100' : 'border-brand-divider text-brand-inkMute hover:text-brand-ink',
                )}
              >
                <Flame className="h-3 w-3" /> Hot
              </button>
              <button
                type="button"
                onClick={() => onFeaturedPatch(f.id, { isJackpot: !f.isJackpot })}
                disabled={savingFeaturedId === f.id}
                className={cn(
                  'inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-bold uppercase tracking-wider transition',
                  f.isJackpot ? 'border-amber-300/60 bg-amber-300/25 text-amber-50' : 'border-brand-divider text-brand-inkMute hover:text-brand-ink',
                )}
              >
                <Award className="h-3 w-3" /> Jackpot
              </button>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  aria-label="Move up"
                  onClick={() => onReorder(f.id, 'up')}
                  disabled={i === 0 || savingFeaturedId === f.id}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-brand-divider text-brand-inkSoft hover:text-brand-ink disabled:opacity-40"
                >
                  <ArrowUp className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  aria-label="Move down"
                  onClick={() => onReorder(f.id, 'down')}
                  disabled={i === featured.length - 1 || savingFeaturedId === f.id}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-brand-divider text-brand-inkSoft hover:text-brand-ink disabled:opacity-40"
                >
                  <ArrowDown className="h-3.5 w-3.5" />
                </button>
              </div>
              <Button
                variant="ghost"
                leftIcon={<Trash2 className="h-3.5 w-3.5" />}
                onClick={() => onFeaturedDelete(f.id)}
                loading={savingFeaturedId === f.id}
              >
                Remove
              </Button>
            </div>
          ))}
        </div>
      </Card>

      <FeaturedPickerModal
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        existing={featured}
        remaining={remaining}
        onAdded={async () => { await refresh(); }}
      />
    </div>
  );
}

function SectionEditorRow({ row, saving, onPatch }: { row: SectionRow; saving: boolean; onPatch: (p: Partial<SectionRow>) => void | Promise<void> }) {
  const [titleEn, setTitleEn] = useState(row.titleEn);
  const [titleBn, setTitleBn] = useState(row.titleBn ?? '');
  const [subtitleEn, setSubtitleEn] = useState(row.subtitleEn ?? '');
  const [subtitleBn, setSubtitleBn] = useState(row.subtitleBn ?? '');
  const [position, setPosition] = useState(String(row.position));

  useEffect(() => {
    setTitleEn(row.titleEn);
    setTitleBn(row.titleBn ?? '');
    setSubtitleEn(row.subtitleEn ?? '');
    setSubtitleBn(row.subtitleBn ?? '');
    setPosition(String(row.position));
  }, [row.id, row.titleEn, row.titleBn, row.subtitleEn, row.subtitleBn, row.position]);

  const dirty = (
    titleEn !== row.titleEn ||
    (titleBn || null) !== (row.titleBn ?? null) ||
    (subtitleEn || null) !== (row.subtitleEn ?? null) ||
    (subtitleBn || null) !== (row.subtitleBn ?? null) ||
    Number(position) !== row.position
  );

  return (
    <div className={cn('rounded-lg border border-brand-divider bg-brand-surface p-3', !row.isVisible && 'opacity-70')}>
      <div className="flex flex-wrap items-center gap-3">
        <code className="text-[10px] uppercase tracking-wider text-brand-inkMute">{row.key}</code>
        {row.layout ? <Chip tone="info">{row.layout}</Chip> : null}
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => onPatch({ isVisible: !row.isVisible })}
            disabled={saving}
            className={cn(
              'inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-bold uppercase tracking-wider transition',
              row.isVisible ? 'border-emerald-400/60 bg-emerald-500/15 text-emerald-100' : 'border-brand-divider text-brand-inkMute',
            )}
          >
            {row.isVisible ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
            {row.isVisible ? 'Visible' : 'Hidden'}
          </button>
        </div>
      </div>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <label className="block">
          <span className="text-[10px] font-bold uppercase tracking-wider text-brand-inkMute">Title (EN)</span>
          <input value={titleEn} onChange={(e) => setTitleEn(e.target.value)} className={inputCls} />
        </label>
        <label className="block">
          <span className="text-[10px] font-bold uppercase tracking-wider text-brand-inkMute">Title (BN)</span>
          <input value={titleBn} onChange={(e) => setTitleBn(e.target.value)} className={inputCls} />
        </label>
        <label className="block">
          <span className="text-[10px] font-bold uppercase tracking-wider text-brand-inkMute">Subtitle (EN)</span>
          <input value={subtitleEn} onChange={(e) => setSubtitleEn(e.target.value)} className={inputCls} />
        </label>
        <label className="block">
          <span className="text-[10px] font-bold uppercase tracking-wider text-brand-inkMute">Subtitle (BN)</span>
          <input value={subtitleBn} onChange={(e) => setSubtitleBn(e.target.value)} className={inputCls} />
        </label>
        <label className="block">
          <span className="text-[10px] font-bold uppercase tracking-wider text-brand-inkMute">Position</span>
          <input type="number" value={position} onChange={(e) => setPosition(e.target.value)} className={inputCls} />
        </label>
      </div>
      <div className="mt-3 flex justify-end">
        <Button
          variant="gold"
          leftIcon={<Save className="h-4 w-4" />}
          disabled={!dirty || saving}
          loading={saving}
          onClick={() => onPatch({
            titleEn,
            titleBn: titleBn.trim() ? titleBn : null,
            subtitleEn: subtitleEn.trim() ? subtitleEn : null,
            subtitleBn: subtitleBn.trim() ? subtitleBn : null,
            position: Number(position) || 0,
          })}
        >
          Save
        </Button>
      </div>
    </div>
  );
}

function FeaturedPickerModal({
  open, onOpenChange, existing, remaining, onAdded,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  existing: FeaturedRow[];
  remaining: number;
  onAdded: () => Promise<void> | void;
}) {
  const [q, setQ] = useState('');
  const [source, setSource] = useState<'both' | 'external' | 'native'>('both');
  const [busy, setBusy] = useState(false);
  const [addingKey, setAddingKey] = useState<string | null>(null);
  const [external, setExternal] = useState<SearchExternal[]>([]);
  const [native, setNative] = useState<SearchNative[]>([]);
  const [err, setErr] = useState<string | null>(null);

  const taken = useMemo(() => {
    const ext = new Set<string>();
    const nat = new Set<string>();
    for (const f of existing) {
      if (f.externalGameId) ext.add(f.externalGameId);
      if (f.nativeGameCode) nat.add(f.nativeGameCode);
    }
    return { ext, nat };
  }, [existing]);

  const runSearch = useCallback(async () => {
    setBusy(true); setErr(null);
    try {
      const params = new URLSearchParams();
      if (q.trim()) params.set('q', q.trim());
      params.set('source', source);
      const r = await fetch(`/api/admin/homepage-featured/search?${params.toString()}`, { cache: 'no-store' });
      const j = await r.json().catch(() => null);
      if (!r.ok) throw new Error(j?.message ?? j?.code ?? 'Search failed');
      setExternal(Array.isArray(j?.external) ? j.external : []);
      setNative(Array.isArray(j?.native) ? j.native : []);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Search failed');
    } finally {
      setBusy(false);
    }
  }, [q, source]);

  useEffect(() => {
    if (!open) return;
    setQ('');
    setSource('both');
    setExternal([]);
    setNative([]);
    setErr(null);
    void runSearch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const addExternal = async (row: SearchExternal) => {
    if (remaining <= 0) return;
    setAddingKey(`external:${row.id}`); setErr(null);
    try {
      const r = await fetch('/api/admin/homepage-featured', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ source: 'external', externalGameId: row.id }),
      });
      const j = await r.json().catch(() => null);
      if (!r.ok) throw new Error(j?.message ?? j?.code ?? 'Add failed');
      await onAdded();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Add failed');
    } finally {
      setAddingKey(null);
    }
  };

  const addNative = async (row: SearchNative) => {
    if (remaining <= 0) return;
    setAddingKey(`native:${row.gameCode}`); setErr(null);
    try {
      const r = await fetch('/api/admin/homepage-featured', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ source: 'native', nativeGameCode: row.gameCode }),
      });
      const j = await r.json().catch(() => null);
      if (!r.ok) throw new Error(j?.message ?? j?.code ?? 'Add failed');
      await onAdded();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Add failed');
    } finally {
      setAddingKey(null);
    }
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Add featured game"
      description={`${remaining} of ${FEATURED_LIMIT} slots remaining. Picking a game adds it to the bottom of the curated list.`}
      footer={<Button variant="ghost" onClick={() => onOpenChange(false)}>Close</Button>}
    >
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-1 items-center gap-2 rounded-lg border border-brand-divider bg-brand-paper px-2">
          <Search className="h-4 w-4 text-brand-inkMute" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') runSearch(); }}
            placeholder="Search by game name or uid..."
            className="h-9 flex-1 bg-transparent text-sm text-brand-ink placeholder:text-brand-inkMute focus:outline-none"
          />
        </div>
        <select value={source} onChange={(e) => setSource(e.target.value as typeof source)} className={inputCls + ' w-auto'}>
          <option value="both">Both</option>
          <option value="external">External only</option>
          <option value="native">Native only</option>
        </select>
        <Button variant="gold" loading={busy} onClick={runSearch}>Search</Button>
      </div>

      {err ? <p className="mt-2 text-sm text-rose-300">{err}</p> : null}

      <div className="mt-3 max-h-[55vh] space-y-3 overflow-y-auto pr-1">
        {external.length > 0 ? (
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-brand-inkMute">External games</p>
            <div className="mt-1 space-y-1">
              {external.map((row) => {
                const has = taken.ext.has(row.id);
                const key = `external:${row.id}`;
                return (
                  <div key={key} className="flex items-center gap-3 rounded-lg border border-brand-divider bg-brand-surface px-3 py-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-brand-ink">{row.displayName}</p>
                      <p className="truncate text-[11px] text-brand-inkMute">
                        {row.providerName}{row.category ? ` . ${row.category}` : ''}{row.brandName ? ` . ${row.brandName}` : ''}
                      </p>
                    </div>
                    <Button
                      variant={has ? 'ghost' : 'gold'}
                      disabled={has || remaining <= 0}
                      loading={addingKey === key}
                      onClick={() => addExternal(row)}
                      leftIcon={<Plus className="h-3.5 w-3.5" />}
                    >
                      {has ? 'Added' : 'Add'}
                    </Button>
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}

        {native.length > 0 ? (
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-brand-inkMute">Native games</p>
            <div className="mt-1 space-y-1">
              {native.map((row) => {
                const has = taken.nat.has(row.gameCode);
                const key = `native:${row.gameCode}`;
                return (
                  <div key={key} className="flex items-center gap-3 rounded-lg border border-brand-divider bg-brand-surface px-3 py-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-brand-ink">{row.displayName}</p>
                      <p className="truncate text-[11px] text-brand-inkMute">Pasha Originals . {row.gameCode}</p>
                    </div>
                    <Button
                      variant={has ? 'ghost' : 'gold'}
                      disabled={has || remaining <= 0}
                      loading={addingKey === key}
                      onClick={() => addNative(row)}
                      leftIcon={<Plus className="h-3.5 w-3.5" />}
                    >
                      {has ? 'Added' : 'Add'}
                    </Button>
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}

        {!busy && external.length === 0 && native.length === 0 ? (
          <p className="text-sm text-brand-inkMute">No matching games. Try a different search or change the source filter.</p>
        ) : null}
      </div>
    </Modal>
  );
}
