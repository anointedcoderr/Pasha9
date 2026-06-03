// Built by Anointed Coder.
//
// /admin/deposit-bonus-tiers
//
// Flat tier editor. Each tier row materialises into a BonusRule of
// type='reload' on save (see lib/bonuses/deposit-tiers.ts), so the
// existing bonus engine grants the bonus on deposit approval. The
// engine picks the highest-priority matching reload rule; with our
// priority formula the biggest matching tier wins.

'use client';

import { useCallback, useEffect, useState } from 'react';
import { PageHeader } from '@/components/site/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Layers, Plus, Save, Trash2, Eye, EyeOff, RefreshCcw } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

interface TierRow {
  id: string;
  minDeposit: number;
  percentage: number;
  isActive: boolean;
  position: number;
  titleEn: string | null;
  titleBn: string | null;
  descriptionEn: string | null;
  descriptionBn: string | null;
  bannerUrl: string | null;
  updatedAt: string;
}

const inputCls = 'w-full rounded-lg border border-brand-divider bg-brand-paper px-3 py-2 text-sm text-brand-ink placeholder:text-brand-inkMute focus:outline-none focus:ring-2 focus:ring-brand-blue-500';

export default function AdminDepositBonusTiersPage() {
  const [rows, setRows] = useState<TierRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [busyResync, setBusyResync] = useState(false);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const r = await fetch('/api/admin/deposit-bonus-tiers', { cache: 'no-store' });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.message ?? j?.code ?? 'Load failed');
      setRows(j.tiers as TierRow[]);
    } catch (e) { setError(e instanceof Error ? e.message : 'Load failed'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const create = async () => {
    setError(null);
    try {
      const r = await fetch('/api/admin/deposit-bonus-tiers', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ minDeposit: 1000, percentage: 3, isActive: true }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.message ?? j?.code ?? 'Create failed');
      await refresh();
    } catch (e) { setError(e instanceof Error ? e.message : 'Create failed'); }
  };

  const patch = async (id: string, body: Partial<TierRow>) => {
    setBusyId(id); setError(null);
    try {
      const r = await fetch(`/api/admin/deposit-bonus-tiers/${id}`, {
        method: 'PATCH', headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.message ?? j?.code ?? 'Save failed');
      await refresh();
    } catch (e) { setError(e instanceof Error ? e.message : 'Save failed'); }
    finally { setBusyId(null); }
  };

  const remove = async (id: string) => {
    if (!confirm('Delete this tier and its bonus rule?')) return;
    setBusyId(id);
    try {
      const r = await fetch(`/api/admin/deposit-bonus-tiers/${id}`, { method: 'DELETE' });
      const j = await r.json().catch(() => null);
      if (!r.ok) throw new Error(j?.message ?? j?.code ?? 'Delete failed');
      setRows((rs) => rs.filter((t) => t.id !== id));
    } catch (e) { setError(e instanceof Error ? e.message : 'Delete failed'); }
    finally { setBusyId(null); }
  };

  const resync = async () => {
    setBusyResync(true); setError(null); setInfo(null);
    try {
      const r = await fetch('/api/admin/deposit-bonus-tiers/resync', { method: 'POST' });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.message ?? j?.code ?? 'Resync failed');
      setInfo(`Synced ${j.synced ?? 0} tiers. Removed ${j.removed ?? 0} orphan rules.`);
    } catch (e) { setError(e instanceof Error ? e.message : 'Resync failed'); }
    finally { setBusyResync(false); }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        icon={<Layers className="h-5 w-5" />}
        title="Deposit bonus tiers"
        subtitle="Tier table the deposit form previews from. Each tier syncs to a BonusRule the engine grants on approval."
      />

      {error ? <Card padding="sm" className="border-l-4 border-rose-400/60"><p className="text-sm text-rose-300">{error}</p></Card> : null}
      {info ? <Card padding="sm" className="border-l-4 border-emerald-400/60"><p className="text-sm text-emerald-300">{info}</p></Card> : null}

      <Card padding="md">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-brand-inkMute">Tiers</p>
            <p className="text-xs text-brand-inkMute">Engine picks the highest-priority matching tier on approval. With these rows the biggest matching minDeposit wins.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" leftIcon={<RefreshCcw className="h-4 w-4" />} loading={busyResync} onClick={resync}>Resync rules</Button>
            <Button variant="gold" leftIcon={<Plus className="h-4 w-4" />} onClick={create}>Add tier</Button>
          </div>
        </div>

        <div className="mt-4 space-y-2">
          {rows.length === 0 && !loading ? (
            <p className="text-sm text-brand-inkMute">No tiers configured. Add 1000 BDT = 3%, 5000 BDT = 5%, 10000 BDT = 8% to mirror the spec.</p>
          ) : null}
          {rows.map((row) => (
            <TierEditor key={row.id} row={row} saving={busyId === row.id} onPatch={(b) => patch(row.id, b)} onDelete={() => remove(row.id)} />
          ))}
        </div>
      </Card>
    </div>
  );
}

function TierEditor({ row, saving, onPatch, onDelete }: { row: TierRow; saving: boolean; onPatch: (p: Partial<TierRow>) => void; onDelete: () => void }) {
  const [minDeposit, setMinDeposit] = useState(String(row.minDeposit));
  const [percentage, setPercentage] = useState(String(row.percentage));
  const [position, setPosition] = useState(String(row.position));
  const [titleEn, setTitleEn] = useState(row.titleEn ?? '');
  const [titleBn, setTitleBn] = useState(row.titleBn ?? '');
  const [descriptionEn, setDescriptionEn] = useState(row.descriptionEn ?? '');
  const [descriptionBn, setDescriptionBn] = useState(row.descriptionBn ?? '');
  const [bannerUrl, setBannerUrl] = useState(row.bannerUrl ?? '');

  useEffect(() => {
    setMinDeposit(String(row.minDeposit));
    setPercentage(String(row.percentage));
    setPosition(String(row.position));
    setTitleEn(row.titleEn ?? '');
    setTitleBn(row.titleBn ?? '');
    setDescriptionEn(row.descriptionEn ?? '');
    setDescriptionBn(row.descriptionBn ?? '');
    setBannerUrl(row.bannerUrl ?? '');
  }, [row.id, row.minDeposit, row.percentage, row.position, row.titleEn, row.titleBn, row.descriptionEn, row.descriptionBn, row.bannerUrl]);

  const dirty = (
    Number(minDeposit) !== row.minDeposit ||
    Number(percentage) !== row.percentage ||
    Number(position) !== row.position ||
    titleEn !== (row.titleEn ?? '') ||
    titleBn !== (row.titleBn ?? '') ||
    descriptionEn !== (row.descriptionEn ?? '') ||
    descriptionBn !== (row.descriptionBn ?? '') ||
    bannerUrl !== (row.bannerUrl ?? '')
  );

  return (
    <div className={cn('space-y-3 rounded-lg border border-brand-divider bg-brand-surface p-3', !row.isActive && 'opacity-70')}>
      <div className="flex flex-wrap items-end gap-3">
        <label className="block w-32">
          <span className="text-[10px] font-bold uppercase tracking-wider text-brand-inkMute">Min deposit</span>
          <input type="number" value={minDeposit} onChange={(e) => setMinDeposit(e.target.value)} className={inputCls} />
        </label>
        <label className="block w-24">
          <span className="text-[10px] font-bold uppercase tracking-wider text-brand-inkMute">Percent</span>
          <input type="number" value={percentage} onChange={(e) => setPercentage(e.target.value)} className={inputCls} />
        </label>
        <label className="block w-20">
          <span className="text-[10px] font-bold uppercase tracking-wider text-brand-inkMute">Position</span>
          <input type="number" value={position} onChange={(e) => setPosition(e.target.value)} className={inputCls} />
        </label>
        <button
          type="button"
          onClick={() => onPatch({ isActive: !row.isActive })}
          disabled={saving}
          className={cn('inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-bold uppercase tracking-wider transition',
            row.isActive ? 'border-emerald-400/60 bg-emerald-500/15 text-emerald-100' : 'border-brand-divider text-brand-inkMute')}
        >
          {row.isActive ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
          {row.isActive ? 'Active' : 'Disabled'}
        </button>
      </div>
      <div className="grid gap-2 md:grid-cols-2">
        <label className="block">
          <span className="text-[10px] font-bold uppercase tracking-wider text-brand-inkMute">Title EN (optional)</span>
          <input value={titleEn} onChange={(e) => setTitleEn(e.target.value)} className={inputCls} placeholder="Auto-generated when empty" />
        </label>
        <label className="block">
          <span className="text-[10px] font-bold uppercase tracking-wider text-brand-inkMute">Title BN (optional)</span>
          <input value={titleBn} onChange={(e) => setTitleBn(e.target.value)} className={inputCls} />
        </label>
        <label className="block md:col-span-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-brand-inkMute">Banner URL (replaces gradient on the promotion card)</span>
          <input value={bannerUrl} onChange={(e) => setBannerUrl(e.target.value)} className={inputCls} placeholder="https://..." />
        </label>
        <label className="block md:col-span-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-brand-inkMute">Description EN</span>
          <textarea rows={2} value={descriptionEn} onChange={(e) => setDescriptionEn(e.target.value)} className={inputCls} placeholder="Get a 3% bonus on deposits of 1,000 BDT or more..." />
        </label>
        <label className="block md:col-span-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-brand-inkMute">Description BN</span>
          <textarea rows={2} value={descriptionBn} onChange={(e) => setDescriptionBn(e.target.value)} className={inputCls} />
        </label>
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="gold"
          leftIcon={<Save className="h-4 w-4" />}
          disabled={!dirty || saving}
          loading={saving}
          onClick={() => onPatch({
            minDeposit: Number(minDeposit),
            percentage: Number(percentage),
            position: Number(position),
            titleEn: titleEn || null,
            titleBn: titleBn || null,
            descriptionEn: descriptionEn || null,
            descriptionBn: descriptionBn || null,
            bannerUrl: bannerUrl || null,
          })}
        >
          Save
        </Button>
        <Button variant="ghost" leftIcon={<Trash2 className="h-3.5 w-3.5" />} onClick={onDelete} loading={saving}>Delete</Button>
      </div>
    </div>
  );
}
