// Built by Anointed Coder.
//
// /admin/brand-ambassadors
//
// CRUD over BrandAmbassador with the Phase D <ImageUpload> driving
// icon updates. The PublicSectionHeader at the top exposes the
// matching about_ambassadors PublicSection row so the operator can
// hide the public block or change titles inline.

'use client';

import { useCallback, useEffect, useState } from 'react';
import { PageHeader } from '@/components/site/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { Star, Plus, Save, Trash2, Eye, EyeOff, ArrowUp, ArrowDown } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { ImageUpload } from '@/components/admin/ImageUpload';
import { PublicSectionHeader } from '@/components/admin/PublicSectionHeader';

interface Row {
  id: string;
  nameEn: string;
  nameBn: string | null;
  subtitle: string | null;
  iconUrl: string | null;
  position: number;
  isActive: boolean;
  updatedAt: string;
}

const inputCls = 'w-full rounded-lg border border-brand-divider bg-brand-paper px-3 py-2 text-sm text-brand-ink placeholder:text-brand-inkMute focus:outline-none focus:ring-2 focus:ring-brand-blue-500';

export default function AdminBrandAmbassadorsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const r = await fetch('/api/admin/brand-ambassadors', { cache: 'no-store' });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.message ?? j?.code ?? 'Failed to load');
      setRows(j.ambassadors as Row[]);
    } catch (e) { setError(e instanceof Error ? e.message : 'Failed to load'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const create = async () => {
    setError(null);
    try {
      const r = await fetch('/api/admin/brand-ambassadors', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ nameEn: 'New ambassador', subtitle: '2025/2026' }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.message ?? j?.code ?? 'Create failed');
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : 'Create failed'); }
  };

  const patch = async (id: string, body: Partial<Row>) => {
    setBusyId(id); setError(null);
    try {
      const r = await fetch(`/api/admin/brand-ambassadors/${id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.message ?? j?.code ?? 'Save failed');
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : 'Save failed'); }
    finally { setBusyId(null); }
  };

  const remove = async (id: string) => {
    if (!confirm('Delete this ambassador?')) return;
    setBusyId(id);
    try {
      const r = await fetch(`/api/admin/brand-ambassadors/${id}`, { method: 'DELETE' });
      const j = await r.json().catch(() => null);
      if (!r.ok) throw new Error(j?.message ?? j?.code ?? 'Delete failed');
      setRows((rs) => rs.filter((row) => row.id !== id));
    } catch (e) { setError(e instanceof Error ? e.message : 'Delete failed'); }
    finally { setBusyId(null); }
  };

  const reorder = async (id: string, dir: 'up' | 'down') => {
    const idx = rows.findIndex((r) => r.id === id);
    if (idx < 0) return;
    const swap = dir === 'up' ? idx - 1 : idx + 1;
    if (swap < 0 || swap >= rows.length) return;
    const a = rows[idx];
    const b = rows[swap];
    await Promise.all([
      patch(a.id, { position: b.position }),
      patch(b.id, { position: a.position }),
    ]);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        icon={<Star className="h-5 w-5" />}
        title="Brand ambassadors"
        subtitle="Public ambassador row shown in the footer / about section."
        action={<Button variant="gold" leftIcon={<Plus className="h-4 w-4" />} onClick={create}>Add ambassador</Button>}
      />

      {error ? <Card padding="sm" className="border-l-4 border-rose-400/60"><p className="text-sm text-rose-300">{error}</p></Card> : null}

      <PublicSectionHeader sectionKey="about_ambassadors" group="about" />

      {loading ? (
        <Card padding="lg"><p className="text-sm text-ink-mid">Loading...</p></Card>
      ) : rows.length === 0 ? (
        <Card padding="lg"><p className="text-sm text-ink-mid">No ambassadors yet. Click Add to create the first one.</p></Card>
      ) : (
        <div className="space-y-3">
          {rows.map((row, i) => (
            <AmbassadorRow
              key={row.id}
              row={row}
              first={i === 0}
              last={i === rows.length - 1}
              saving={busyId === row.id}
              onPatch={(b) => patch(row.id, b)}
              onDelete={() => remove(row.id)}
              onMoveUp={() => reorder(row.id, 'up')}
              onMoveDown={() => reorder(row.id, 'down')}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function AmbassadorRow({ row, first, last, saving, onPatch, onDelete, onMoveUp, onMoveDown }: {
  row: Row;
  first: boolean;
  last: boolean;
  saving: boolean;
  onPatch: (b: Partial<Row>) => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  const [nameEn, setNameEn] = useState(row.nameEn);
  const [nameBn, setNameBn] = useState(row.nameBn ?? '');
  const [subtitle, setSubtitle] = useState(row.subtitle ?? '');

  useEffect(() => {
    setNameEn(row.nameEn);
    setNameBn(row.nameBn ?? '');
    setSubtitle(row.subtitle ?? '');
  }, [row.id, row.nameEn, row.nameBn, row.subtitle]);

  return (
    <Card padding="md" className={cn(!row.isActive && 'opacity-70')}>
      <div className="flex flex-wrap items-center gap-2">
        <Chip tone={row.isActive ? 'ok' : 'neutral'}>{row.isActive ? 'Active' : 'Hidden'}</Chip>
        <span className="text-[11px] text-brand-inkMute">position {row.position}</span>
        <div className="ml-auto flex items-center gap-1">
          <button
            type="button"
            aria-label="Move up"
            onClick={onMoveUp}
            disabled={first || saving}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-brand-divider text-brand-inkSoft hover:text-brand-ink disabled:opacity-40"
          >
            <ArrowUp className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            aria-label="Move down"
            onClick={onMoveDown}
            disabled={last || saving}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-brand-divider text-brand-inkSoft hover:text-brand-ink disabled:opacity-40"
          >
            <ArrowDown className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onPatch({ isActive: !row.isActive })}
            disabled={saving}
            className={cn(
              'inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-bold uppercase tracking-wider transition',
              row.isActive ? 'border-emerald-400/60 bg-emerald-500/15 text-emerald-100' : 'border-brand-divider text-brand-inkMute',
            )}
          >
            {row.isActive ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
            {row.isActive ? 'Enabled' : 'Disabled'}
          </button>
        </div>
      </div>
      <div className="mt-3 grid gap-3 md:grid-cols-3">
        <label className="block">
          <span className="text-[10px] font-bold uppercase tracking-wider text-brand-inkMute">Name (EN)</span>
          <input value={nameEn} onChange={(e) => setNameEn(e.target.value)} className={inputCls} />
        </label>
        <label className="block">
          <span className="text-[10px] font-bold uppercase tracking-wider text-brand-inkMute">Name (BN)</span>
          <input value={nameBn} onChange={(e) => setNameBn(e.target.value)} className={inputCls} />
        </label>
        <label className="block">
          <span className="text-[10px] font-bold uppercase tracking-wider text-brand-inkMute">Subtitle / Year</span>
          <input value={subtitle} onChange={(e) => setSubtitle(e.target.value)} className={inputCls} placeholder="2025/2026" />
        </label>
      </div>
      <div className="mt-3">
        <ImageUpload
          categoryKey="ambassadors"
          label="Ambassador icon"
          value={row.iconUrl}
          onChange={(url) => onPatch({ iconUrl: url })}
        />
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button
          variant="gold"
          leftIcon={<Save className="h-4 w-4" />}
          loading={saving}
          onClick={() => onPatch({
            nameEn,
            nameBn: nameBn.trim() ? nameBn : null,
            subtitle: subtitle.trim() ? subtitle : null,
          })}
        >
          Save
        </Button>
        <Button variant="ghost" leftIcon={<Trash2 className="h-3.5 w-3.5" />} onClick={onDelete} loading={saving}>Delete</Button>
      </div>
    </Card>
  );
}
