// Built by Anointed Coder.
//
// Reusable header strip for the Phase G admin pages. Loads a single
// PublicSection row by `key`, lets the operator toggle visibility +
// edit EN/BN titles + subtitles inline. The wider page below renders
// the per-item CRUD table.

'use client';

import { useCallback, useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Save, Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

interface SectionRow {
  id: string;
  key: string;
  group: string;
  titleEn: string;
  titleBn: string | null;
  subtitleEn: string | null;
  subtitleBn: string | null;
  isVisible: boolean;
  position: number;
}

const inputCls = 'w-full rounded-lg border border-brand-divider bg-brand-paper px-3 py-2 text-sm text-brand-ink placeholder:text-brand-inkMute focus:outline-none focus:ring-2 focus:ring-brand-blue-500';

export function PublicSectionHeader({ sectionKey, group }: { sectionKey: string; group: 'about' | 'payment_display' }) {
  const [row, setRow] = useState<SectionRow | null>(null);
  const [titleEn, setTitleEn] = useState('');
  const [titleBn, setTitleBn] = useState('');
  const [subtitleEn, setSubtitleEn] = useState('');
  const [subtitleBn, setSubtitleBn] = useState('');
  const [saving, setSaving] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [info, setInfo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/admin/public-sections?group=${group}`, { cache: 'no-store' });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.message ?? j?.code ?? 'Failed to load section');
      const list = (j.sections ?? []) as SectionRow[];
      const found = list.find((s) => s.key === sectionKey) ?? null;
      setRow(found);
      if (found) {
        setTitleEn(found.titleEn);
        setTitleBn(found.titleBn ?? '');
        setSubtitleEn(found.subtitleEn ?? '');
        setSubtitleBn(found.subtitleBn ?? '');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    }
  }, [group, sectionKey]);

  useEffect(() => { load(); }, [load]);

  const patch = async (body: Partial<SectionRow>) => {
    if (!row) return;
    setSaving(true); setError(null); setInfo(null);
    try {
      const r = await fetch(`/api/admin/public-sections/${row.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.message ?? j?.code ?? 'Save failed');
      const next = j.section as SectionRow;
      setRow(next);
      setTitleEn(next.titleEn);
      setTitleBn(next.titleBn ?? '');
      setSubtitleEn(next.subtitleEn ?? '');
      setSubtitleBn(next.subtitleBn ?? '');
      setInfo('Section saved.');
      setTimeout(() => setInfo(null), 2500);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  // Recreates the default section rows (idempotent, keeps existing
  // rows untouched) so the operator can fix an unseeded database with
  // one click instead of a developer command.
  const onSeed = async () => {
    setSeeding(true);
    setError(null);
    try {
      const r = await fetch('/api/admin/public-sections/seed', { method: 'POST' });
      const j = await r.json().catch(() => null);
      if (!r.ok) throw new Error(j?.message ?? j?.code ?? 'Set up failed. সেটআপ ব্যর্থ হয়েছে।');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Set up failed. সেটআপ ব্যর্থ হয়েছে।');
    } finally {
      setSeeding(false);
    }
  };

  if (!row) {
    return (
      <Card padding="sm" className="border-l-4 border-amber-400/60">
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-sm text-amber-300">
            This section has not been set up on this site yet. Click <strong>Set up section</strong> to create it with default titles you can edit right after.
            {' '}এই সেকশনটি এখনো চালু হয়নি। <strong>Set up section</strong> বাটনে ক্লিক করলে ডিফল্ট শিরোনামসহ সেকশনটি তৈরি হবে, এরপরই আপনি সম্পাদনা করতে পারবেন।
          </p>
          <Button variant="gold" loading={seeding} onClick={onSeed}>Set up section</Button>
          {error ? <span className="text-xs text-rose-300">{error}</span> : null}
        </div>
      </Card>
    );
  }

  return (
    <Card padding="md">
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-brand-inkMute">Public section</p>
          <code className="text-[11px] text-brand-inkSoft">{row.key}</code>
        </div>
        <button
          type="button"
          disabled={saving}
          onClick={() => patch({ isVisible: !row.isVisible })}
          className={cn(
            'ml-auto inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-bold uppercase tracking-wider transition',
            row.isVisible ? 'border-emerald-400/60 bg-emerald-500/15 text-emerald-100' : 'border-brand-divider text-brand-inkMute',
          )}
        >
          {row.isVisible ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
          {row.isVisible ? 'Visible' : 'Hidden'}
        </button>
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
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button
          variant="gold"
          leftIcon={<Save className="h-4 w-4" />}
          loading={saving}
          onClick={() => patch({
            titleEn,
            titleBn: titleBn.trim() ? titleBn : null,
            subtitleEn: subtitleEn.trim() ? subtitleEn : null,
            subtitleBn: subtitleBn.trim() ? subtitleBn : null,
          })}
        >
          Save section
        </Button>
        {info ? <span className="text-xs text-emerald-300">{info}</span> : null}
        {error ? <span className="text-xs text-rose-300">{error}</span> : null}
      </div>
    </Card>
  );
}
