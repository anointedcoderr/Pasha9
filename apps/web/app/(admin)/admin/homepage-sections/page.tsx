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
import { LayoutGrid, Eye, EyeOff, Save, Trash2, Plus, Search, Flame, Award, ArrowUp, ArrowDown, AlertTriangle, Activity } from 'lucide-react';
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
  meta?: { iconImageUrl?: string | null } | null;
  iconImageUrl?: string | null;
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
  customImageUrl: string | null;
  providerImageUrl: string | null;
  showProviderLabel: boolean;
  showGameName: boolean;
  showHotBadge: boolean;
  showPlayButton: boolean;
  imageOnlyMode: boolean;
  imageFitMode: 'cover' | 'contain';
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

const FEATURED_LIMIT = 60;
const inputCls = 'w-full rounded-lg border border-brand-divider bg-brand-paper px-3 py-2 text-sm text-brand-ink placeholder:text-brand-inkMute focus:outline-none focus:ring-2 focus:ring-brand-blue-500';

interface DebugSnapshot {
  publicSection: { count: number; homepageHotPresent: boolean };
  homepageFeaturedGame: { count: number; renderableCount: number; rows: Array<{ id: string; position: number; source: string; gameName: string; brand: string | null; renderable: boolean; blockedReason: string | null }> };
  flags: { nativeGamesPublicEnabled: boolean };
  health: { seedMissing: boolean; renderingSynthetic: boolean };
}

interface SyncSnapshot {
  inSync: boolean;
  sameOrder: boolean;
  curatedCount: number;
  renderableCuratedCount: number;
  publicCount: number;
  missingFromPublic: string[];
  extraInPublic: string[];
  adminRows: Array<{ curatedId: string; source: 'external' | 'native'; ref: string; expectedKey: string | null; displayName: string | null; resolvedReason: string | null }>;
  publicKeys: string[];
  hotSection: { present: boolean; isVisible: boolean | null; gamesLength: number; sourceRowExists: boolean; sourceRowIsVisible: boolean | null; sourceRowTitleEn: string | null };
  flags: { nativeGamesPublicEnabled: boolean };
  blockedCuratedRows: Array<{ curatedId: string; source: string; ref: string; reason: string }>;
}

export default function AdminHomepageSectionsPage() {
  const [sections, setSections] = useState<SectionRow[]>([]);
  const [featured, setFeatured] = useState<FeaturedRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingSectionId, setSavingSectionId] = useState<string | null>(null);
  const [savingFeaturedId, setSavingFeaturedId] = useState<string | null>(null);
  const [uploadingFeaturedId, setUploadingFeaturedId] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [debug, setDebug] = useState<DebugSnapshot | null>(null);

  const onFeaturedImageUpload = async (id: string, file: File) => {
    setUploadingFeaturedId(id);
    setError(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('category', 'games');
      const upRes = await fetch('/api/admin/uploads', { method: 'POST', body: fd });
      const upData = await upRes.json().catch(() => null);
      if (!upRes.ok) throw new Error(upData?.message ?? upData?.code ?? 'Upload failed');
      const url = upData.url as string;
      const patchRes = await fetch(`/api/admin/homepage-featured/${id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ customImageUrl: url }),
      });
      const patchData = await patchRes.json().catch(() => null);
      if (!patchRes.ok) throw new Error(patchData?.message ?? patchData?.code ?? 'Save failed');
      setFeatured((rows) => rows.map((r) => (r.id === id ? { ...r, customImageUrl: url, imageUrl: url } : r)));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Image save failed');
    } finally {
      setUploadingFeaturedId(null);
    }
  };

  const onFeaturedImageReset = async (id: string) => {
    setUploadingFeaturedId(id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/homepage-featured/${id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ customImageUrl: null }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.message ?? data?.code ?? 'Save failed');
      setFeatured((rows) =>
        rows.map((r) => (r.id === id ? { ...r, customImageUrl: null, imageUrl: r.providerImageUrl ?? null } : r)),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Reset failed');
    } finally {
      setUploadingFeaturedId(null);
    }
  };
  const [debugBusy, setDebugBusy] = useState(false);
  const [sync, setSync] = useState<SyncSnapshot | null>(null);

  // When the picker has the enriched list in hand (returned inline by
  // POST), pass it via preloadedFeatured so refresh() skips the
  // /api/admin/homepage-featured GET roundtrip. Sections and sync-check
  // still fetch because they have no embedded equivalent.
  const refresh = useCallback(async (preloadedFeatured?: FeaturedRow[]) => {
    setError(null);
    try {
      const featuredFetch = preloadedFeatured
        ? Promise.resolve(null)
        : fetch('/api/admin/homepage-featured', { cache: 'no-store' });
      const [a, b, c] = await Promise.all([
        fetch('/api/admin/homepage-sections', { cache: 'no-store' }),
        featuredFetch,
        fetch('/api/admin/homepage-featured/sync-check', { cache: 'no-store' }),
      ]);
      const ja = await a.json();
      if (!a.ok) throw new Error(ja?.message ?? ja?.code ?? 'Failed to load sections');
      setSections(ja.sections as SectionRow[]);
      if (preloadedFeatured) {
        setFeatured(preloadedFeatured);
      } else if (b) {
        const jb = await b.json();
        if (!b.ok) throw new Error(jb?.message ?? jb?.code ?? 'Failed to load featured games');
        setFeatured(jb.featured as FeaturedRow[]);
      }
      // sync-check is best-effort: a non-2xx response from this
      // endpoint must NOT prevent the rest of the admin from loading.
      // Render the banner only when the endpoint actually returned ok.
      if (c.ok) {
        try {
          const jc = await c.json();
          if (jc?.ok) setSync(jc as SyncSnapshot);
        } catch { /* ignore parse errors */ }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  const onSeedSections = async () => {
    setSeeding(true);
    setError(null);
    try {
      const r = await fetch('/api/admin/homepage-sections/seed', { method: 'POST' });
      const j = await r.json().catch(() => null);
      if (!r.ok) throw new Error(j?.message ?? j?.code ?? 'Seed failed');
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Seed failed');
    } finally {
      setSeeding(false);
    }
  };

  const onLoadDebug = async () => {
    setDebugBusy(true);
    try {
      const r = await fetch('/api/admin/homepage-featured/debug', { cache: 'no-store' });
      const j = await r.json().catch(() => null);
      if (!r.ok) throw new Error(j?.message ?? j?.code ?? 'Debug load failed');
      setDebug(j as DebugSnapshot);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Debug load failed');
    } finally {
      setDebugBusy(false);
    }
  };

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

  const onReorder = async (id: string, dir: 'up' | 'down') => {
    const rows = [...featured];
    const idx = rows.findIndex((r) => r.id === id);
    if (idx < 0) return;
    const swap = dir === 'up' ? idx - 1 : idx + 1;
    if (swap < 0 || swap >= rows.length) return;

    // Optimistic move: swap the two rows locally so the operator sees
    // the new order immediately, then write the full ordered id list
    // to the atomic reorder endpoint. On failure, refresh from DB.
    const reordered = rows.slice();
    [reordered[idx], reordered[swap]] = [reordered[swap], reordered[idx]];
    setFeatured(reordered);
    setSavingFeaturedId(id);
    try {
      const r = await fetch('/api/admin/homepage-featured/reorder', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ids: reordered.map((row) => row.id) }),
      });
      const j = await r.json().catch(() => null);
      if (!r.ok) throw new Error(j?.message ?? j?.code ?? 'Reorder failed');
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Reorder failed');
      await refresh();
    } finally {
      setSavingFeaturedId(null);
    }
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

      {sync && !sync.inSync && sync.curatedCount > 0 ? (
        <Card padding="md" className="border-l-4 border-rose-500 bg-rose-500/10">
          <div className="flex flex-wrap items-start gap-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-300" />
            <div className="grow text-sm text-rose-100">
              <p className="font-bold">Public Hot Games strip is out of sync with the Manager.</p>
              <p className="mt-1 text-[11px] text-rose-200">
                Admin curated {sync.curatedCount} game{sync.curatedCount === 1 ? '' : 's'}, public strip rendering {sync.publicCount}.
                {sync.sameOrder ? '' : ' Order does not match.'}
                {sync.hotSection.sourceRowIsVisible === false ? ' homepage_hot PublicSection is hidden (auto-overridden by the assembler).' : ''}
                {sync.flags.nativeGamesPublicEnabled ? '' : ' native_games_public_enabled is OFF, so native curation is excluded.'}
              </p>
              {sync.adminRows.some((r) => r.expectedKey === null) ? (
                <div className="mt-2 space-y-1">
                  <p className="text-[10px] uppercase tracking-wider text-rose-300">Blocked curated rows</p>
                  <ul className="space-y-0.5 text-[11px]">
                    {sync.adminRows.filter((r) => r.expectedKey === null).map((r) => (
                      <li key={r.curatedId} className="font-mono">
                        {r.source}:{r.ref} {r.displayName ? `(${r.displayName})` : ''} . {r.resolvedReason}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          </div>
        </Card>
      ) : null}

      {sync && sync.inSync && sync.curatedCount > 0 ? (
        <Card padding="sm" className="border-l-4 border-emerald-400/60 bg-emerald-500/10">
          <p className="text-xs text-emerald-100">
            Public Hot Games strip mirrors the Manager. {sync.curatedCount} curated . {sync.publicCount} rendered.
          </p>
        </Card>
      ) : null}

      <Card padding="md">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-brand-inkMute">Section manager</p>
            <h2 className="text-lg font-extrabold text-brand-ink">Strips on /</h2>
            <p className="text-xs text-brand-inkMute">Edit title, subtitle, visibility and order. Strips with no games render hidden on the public site.</p>
          </div>
          <Button variant="ghost" onClick={() => { void refresh(); }} loading={loading}>Refresh</Button>
        </div>

        <div className="mt-4 space-y-3">
          {(sections.length === 0 || !sections.some((s) => s.key === 'homepage_hot')) && !loading ? (
            <div className="flex flex-wrap items-center gap-3 rounded-lg border border-amber-400/50 bg-amber-500/10 px-3 py-3 text-sm">
              <AlertTriangle className="h-4 w-4 shrink-0 text-amber-300" />
              <p className="grow text-amber-100">
                {sections.length === 0
                  ? 'No PublicSection rows in group=‘homepage’. The Phase A seed has not run on this database. Re-seed to publish the homepage strips.'
                  : 'PublicSection ‘homepage_hot’ row missing. The public homepage falls back to a synthetic strip from your curation, but re-seed to restore the editable section row.'}
              </p>
              <Button variant="gold" loading={seeding} onClick={onSeedSections}>
                Seed homepage sections
              </Button>
            </div>
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
              <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-md border border-brand-divider bg-brand-paper">
                {f.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={f.imageUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-[9px] uppercase tracking-wider text-brand-inkMute">No image</div>
                )}
                {f.customImageUrl ? (
                  <span className="absolute right-0 top-0 inline-flex items-center rounded-bl-md bg-brand-yellow-500 px-1 text-[8px] font-bold text-brand-ink">CUSTOM</span>
                ) : null}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-brand-ink">{f.displayName}</p>
                <p className="truncate text-[11px] text-brand-inkMute">
                  {f.providerName}{f.category ? ` . ${f.category}` : ''}{f.source === 'native' ? ' . native' : ''}
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  <label className={cn('inline-flex h-7 cursor-pointer items-center gap-1 rounded-md border border-brand-divider bg-brand-paper px-2 text-[10px] font-semibold text-brand-ink hover:border-brand-yellow-500', uploadingFeaturedId === f.id && 'pointer-events-none opacity-60')}>
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        e.target.value = '';
                        if (file) onFeaturedImageUpload(f.id, file);
                      }}
                    />
                    {uploadingFeaturedId === f.id ? 'Uploading...' : f.customImageUrl ? 'Change image' : 'Upload image'}
                  </label>
                  {f.customImageUrl ? (
                    <button
                      type="button"
                      onClick={() => onFeaturedImageReset(f.id)}
                      disabled={uploadingFeaturedId === f.id}
                      className="inline-flex h-7 items-center rounded-md border border-brand-divider bg-brand-paper px-2 text-[10px] font-semibold text-rose-600 hover:border-rose-400 disabled:opacity-60"
                    >
                      Reset
                    </button>
                  ) : null}
                </div>
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
              <details className="ml-auto basis-full text-[10px] md:basis-auto">
                <summary className="cursor-pointer rounded-md border border-brand-divider px-2 py-1 font-bold uppercase tracking-wider text-brand-inkSoft hover:text-brand-ink">
                  Overlays
                </summary>
                <div className="mt-2 grid w-full grid-cols-2 gap-2 rounded-md border border-brand-divider bg-brand-paper p-2 text-[11px] sm:grid-cols-3 md:absolute md:right-0 md:z-10 md:w-[360px]">
                  {([
                    ['imageOnlyMode', 'Image only'],
                    ['showProviderLabel', 'Provider label'],
                    ['showGameName', 'Game name'],
                    ['showHotBadge', 'HOT badge'],
                    ['showPlayButton', 'Play button'],
                  ] as Array<[keyof FeaturedRow, string]>).map(([key, label]) => (
                    <label key={String(key)} className="flex cursor-pointer items-center gap-1.5">
                      <input
                        type="checkbox"
                        checked={Boolean(f[key])}
                        disabled={savingFeaturedId === f.id}
                        onChange={(e) => onFeaturedPatch(f.id, { [key]: e.target.checked } as Partial<FeaturedRow>)}
                        className="h-3.5 w-3.5"
                      />
                      <span>{label}</span>
                    </label>
                  ))}
                  <label className="col-span-2 flex items-center gap-2 sm:col-span-3">
                    <span className="font-semibold uppercase tracking-wider text-brand-inkMute">Fit mode</span>
                    <select
                      value={f.imageFitMode ?? 'cover'}
                      disabled={savingFeaturedId === f.id}
                      onChange={(e) => onFeaturedPatch(f.id, { imageFitMode: e.target.value as 'cover' | 'contain' })}
                      className="rounded border border-brand-divider bg-brand-paper px-1 py-0.5 text-[11px]"
                    >
                      <option value="cover">Cover (crops to fill)</option>
                      <option value="contain">Contain (full image)</option>
                    </select>
                  </label>
                  <p className="col-span-2 text-[10px] text-brand-inkMute sm:col-span-3">
                    Card is 4:3. Recommended image: 1200 x 900 (4:3) or 800 x 800 (square).
                    Cover crops to fill the card with no borders. Contain shows the full image and
                    fills the gaps with a blurred copy of the same image so the tile never goes
                    black. For PNG with transparency, prefer Cover so the brand backdrop never
                    leaks through.
                  </p>
                </div>
              </details>
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
        onAdded={async (preloaded) => { await refresh(preloaded); }}
      />

      <Card padding="md">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-brand-inkMute">Verification</p>
            <h2 className="text-lg font-extrabold text-brand-ink">Public render diagnostics</h2>
            <p className="text-xs text-brand-inkMute">
              Confirms each curated game is actually renderable on the public homepage. Use this before a session if a recent edit does not appear.
            </p>
          </div>
          <Button variant="ghost" leftIcon={<Activity className="h-4 w-4" />} loading={debugBusy} onClick={onLoadDebug}>
            {debug ? 'Refresh diagnostics' : 'Run diagnostics'}
          </Button>
        </div>

        {debug ? (
          <div className="mt-4 space-y-3">
            <div className="grid gap-2 text-xs md:grid-cols-3">
              <div className="rounded-lg border border-brand-divider bg-brand-surface px-3 py-2">
                <p className="text-[10px] uppercase tracking-wider text-brand-inkMute">PublicSection rows</p>
                <p className="text-lg font-extrabold text-brand-ink">{debug.publicSection.count}</p>
                <p className={cn('text-[11px]', debug.publicSection.homepageHotPresent ? 'text-emerald-300' : 'text-amber-300')}>
                  homepage_hot {debug.publicSection.homepageHotPresent ? 'present' : 'missing (synthetic fallback active)'}
                </p>
              </div>
              <div className="rounded-lg border border-brand-divider bg-brand-surface px-3 py-2">
                <p className="text-[10px] uppercase tracking-wider text-brand-inkMute">Curated games</p>
                <p className="text-lg font-extrabold text-brand-ink">{debug.homepageFeaturedGame.count}</p>
                <p className="text-[11px] text-brand-inkMute">{debug.homepageFeaturedGame.renderableCount} renderable on public site</p>
              </div>
              <div className="rounded-lg border border-brand-divider bg-brand-surface px-3 py-2">
                <p className="text-[10px] uppercase tracking-wider text-brand-inkMute">Pasha Originals flag</p>
                <p className={cn('text-lg font-extrabold', debug.flags.nativeGamesPublicEnabled ? 'text-emerald-300' : 'text-brand-ink')}>
                  {debug.flags.nativeGamesPublicEnabled ? 'Public ON' : 'Public OFF'}
                </p>
                <p className="text-[11px] text-brand-inkMute">native_games_public_enabled</p>
              </div>
            </div>

            <div className="overflow-x-auto rounded-lg border border-brand-divider">
              <table className="min-w-full text-left text-[11px]">
                <thead className="bg-brand-surface text-[10px] uppercase tracking-wider text-brand-inkMute">
                  <tr>
                    <th className="px-2 py-2">#</th>
                    <th className="px-2 py-2">Pos</th>
                    <th className="px-2 py-2">Source</th>
                    <th className="px-2 py-2">Game</th>
                    <th className="px-2 py-2">Brand</th>
                    <th className="px-2 py-2">Renderable</th>
                    <th className="px-2 py-2">Blocked reason</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-brand-divider text-brand-ink">
                  {debug.homepageFeaturedGame.rows.map((r, i) => (
                    <tr key={r.id} className={cn(!r.renderable && 'bg-rose-500/10')}>
                      <td className="px-2 py-1">{i + 1}</td>
                      <td className="px-2 py-1 font-mono text-[10px]">{r.position}</td>
                      <td className="px-2 py-1">{r.source}</td>
                      <td className="px-2 py-1">{r.gameName}</td>
                      <td className="px-2 py-1 text-brand-inkMute">{r.brand ?? '.'}</td>
                      <td className={cn('px-2 py-1 font-bold', r.renderable ? 'text-emerald-300' : 'text-rose-300')}>
                        {r.renderable ? 'YES' : 'NO'}
                      </td>
                      <td className="px-2 py-1 text-[10px] text-brand-inkMute">{r.blockedReason ?? ''}</td>
                    </tr>
                  ))}
                  {debug.homepageFeaturedGame.rows.length === 0 ? (
                    <tr><td className="px-2 py-2 text-brand-inkMute" colSpan={7}>No curated rows.</td></tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <p className="mt-3 text-xs text-brand-inkMute">Click Run diagnostics to compare curation rows against the public render path.</p>
        )}
      </Card>
    </div>
  );
}

function SectionEditorRow({ row, saving, onPatch }: { row: SectionRow; saving: boolean; onPatch: (p: Partial<SectionRow>) => void | Promise<void> }) {
  const [titleEn, setTitleEn] = useState(row.titleEn);
  const [titleBn, setTitleBn] = useState(row.titleBn ?? '');
  const [subtitleEn, setSubtitleEn] = useState(row.subtitleEn ?? '');
  const [subtitleBn, setSubtitleBn] = useState(row.subtitleBn ?? '');
  const [position, setPosition] = useState(String(row.position));
  const initialIcon = (row.meta?.iconImageUrl ?? row.iconImageUrl ?? '') || '';
  const [iconImageUrl, setIconImageUrl] = useState<string>(initialIcon);
  const [iconUploading, setIconUploading] = useState(false);
  const [iconError, setIconError] = useState<string | null>(null);

  useEffect(() => {
    setTitleEn(row.titleEn);
    setTitleBn(row.titleBn ?? '');
    setSubtitleEn(row.subtitleEn ?? '');
    setSubtitleBn(row.subtitleBn ?? '');
    setPosition(String(row.position));
    setIconImageUrl((row.meta?.iconImageUrl ?? row.iconImageUrl ?? '') || '');
  }, [row.id, row.titleEn, row.titleBn, row.subtitleEn, row.subtitleBn, row.position, row.meta?.iconImageUrl, row.iconImageUrl]);

  const uploadIcon = async (file: File) => {
    setIconError(null);
    setIconUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('category', 'categories');
      const res = await fetch('/api/admin/uploads', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message ?? data?.code ?? 'Upload failed');
      setIconImageUrl(data.url as string);
    } catch (err) {
      setIconError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setIconUploading(false);
    }
  };

  const dirty = (
    titleEn !== row.titleEn ||
    (titleBn || null) !== (row.titleBn ?? null) ||
    (subtitleEn || null) !== (row.subtitleEn ?? null) ||
    (subtitleBn || null) !== (row.subtitleBn ?? null) ||
    Number(position) !== row.position ||
    iconImageUrl !== initialIcon
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
      <div className="mt-3">
        <span className="text-[10px] font-bold uppercase tracking-wider text-brand-inkMute">Section icon (optional)</span>
        <div className="mt-1 flex flex-col gap-2 sm:flex-row sm:items-stretch">
          <div className="flex h-[72px] w-full items-center justify-center overflow-hidden rounded-lg border border-brand-divider bg-brand-paper sm:w-[88px]">
            {iconImageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={iconImageUrl} alt="" className="h-14 w-14 object-contain" />
            ) : (
              <p className="text-[10px] text-brand-inkMute">No icon</p>
            )}
          </div>
          <div className="flex flex-1 flex-col gap-2">
            <input value={iconImageUrl} onChange={(e) => setIconImageUrl(e.target.value)} placeholder="/uploads/categories/..." className={inputCls} />
            <div className="flex flex-wrap gap-2">
              <label className="inline-flex h-9 cursor-pointer items-center rounded-md border border-brand-divider bg-brand-paper px-3 text-xs font-semibold text-brand-ink hover:border-brand-yellow-500">
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/svg+xml"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) uploadIcon(f);
                  }}
                />
                {iconUploading ? 'Uploading...' : iconImageUrl ? 'Replace' : 'Upload'}
              </label>
              {iconImageUrl ? (
                <button
                  type="button"
                  onClick={() => setIconImageUrl('')}
                  className="inline-flex h-9 items-center rounded-md border border-brand-divider bg-brand-paper px-3 text-xs font-semibold text-rose-600 hover:border-rose-400"
                >
                  Remove
                </button>
              ) : null}
            </div>
            {iconError ? <p className="text-xs text-rose-600">{iconError}</p> : null}
            <p className="text-[10px] text-brand-inkMute">PNG, JPG, WEBP or SVG. Falls back to the built-in icon when empty.</p>
          </div>
        </div>
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
            iconImageUrl: iconImageUrl.trim() ? iconImageUrl.trim() : null,
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
  onAdded: (preloaded?: FeaturedRow[]) => Promise<void> | void;
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
      // POST returns { featured: row, list: enrichedList }. Hand the
      // enriched list directly to the parent so refresh() skips the
      // redundant /api/admin/homepage-featured GET. Sections and
      // sync-check still fetch (no embedded equivalent).
      const preloaded = Array.isArray(j?.list) ? (j.list as FeaturedRow[]) : undefined;
      await onAdded(preloaded);
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
      const preloaded = Array.isArray(j?.list) ? (j.list as FeaturedRow[]) : undefined;
      await onAdded(preloaded);
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
