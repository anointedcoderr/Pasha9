// Built by Anointed Coder.
//
// /admin/spin-tiers
//
// Wheel-tier editor. Each tier represents a separate wheel on the
// public /rewards page with its own cost-per-spin, free-spin
// allowance, and a segment set (managed under /admin/spin-segments
// with a tier filter).
//
// Seed button materialises the default 30 / 100 / 500-coin ladder
// (Lucky / Grand / Supreme) idempotently - re-clicking does nothing
// once the rows exist, so it is safe to leave on.

'use client';

import { useCallback, useEffect, useState } from 'react';
import { PageHeader } from '@/components/site/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { FormField, Input, Textarea } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Switch } from '@/components/ui/Switch';
import { Chip } from '@/components/ui/Chip';
import { EmptyState } from '@/components/ui/EmptyState';
import Link from 'next/link';
import { Disc3, Plus, Pencil, Trash2, Sparkles } from 'lucide-react';
import { ConfirmDialog } from '@/components/admin/ConfirmDialog';

interface TierRow {
  id: string;
  key: string;
  nameEn: string;
  nameBn: string | null;
  descriptionEn: string | null;
  descriptionBn: string | null;
  costPerSpin: number;
  freeSpinsPerDay: number;
  color: string;
  iconUrl: string | null;
  position: number;
  isActive: boolean;
  segmentCount: number;
  resultCount: number;
}

const BLANK: TierRow = {
  id: '',
  key: '',
  nameEn: '',
  nameBn: '',
  descriptionEn: '',
  descriptionBn: '',
  costPerSpin: 30,
  freeSpinsPerDay: 0,
  color: '#FFCC00',
  iconUrl: '',
  position: 0,
  isActive: true,
  segmentCount: 0,
  resultCount: 0,
};

export default function AdminSpinTiersPage() {
  const [rows, setRows] = useState<TierRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [editor, setEditor] = useState<TierRow | null>(null);
  const [editorError, setEditorError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [seedBusy, setSeedBusy] = useState(false);
  // In-page confirm dialog instead of native confirm(), which
  // installed PWAs suppress silently.
  const [deleteTarget, setDeleteTarget] = useState<TierRow | null>(null);

  const notify = (msg: string) => {
    setInfo(msg);
    setTimeout(() => setInfo(null), 4000);
  };

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch('/api/admin/spin-tiers', { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? data.code ?? 'Failed');
      setRows((data.tiers ?? []) as TierRow[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load tiers');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const seed = async () => {
    setSeedBusy(true);
    setError(null);
    setInfo(null);
    try {
      const res = await fetch('/api/admin/spin-segments/seed', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? data.code ?? 'Seed failed');
      setInfo(
        data.alreadySeeded
          ? 'Default tiers already exist - nothing to do.'
          : `Seeded ${data.tiersCreated} tier(s), ${data.segmentsCreated} segment(s), backfilled ${data.legacyBackfilled} legacy segment(s).`,
      );
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Seed failed');
    } finally {
      setSeedBusy(false);
    }
  };

  const save = async () => {
    if (!editor) return;
    setBusy(true);
    setEditorError(null);
    const isNew = !editor.id;
    const payload = {
      ...(isNew ? { key: editor.key } : { id: editor.id }),
      nameEn: editor.nameEn,
      nameBn: editor.nameBn || null,
      descriptionEn: editor.descriptionEn || null,
      descriptionBn: editor.descriptionBn || null,
      costPerSpin: editor.costPerSpin,
      freeSpinsPerDay: editor.freeSpinsPerDay,
      color: editor.color,
      iconUrl: editor.iconUrl || null,
      position: editor.position,
      isActive: editor.isActive,
    };
    try {
      const res = await fetch('/api/admin/spin-tiers', {
        method: isNew ? 'POST' : 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? data.code ?? 'Save failed');
      setEditor(null);
      notify(isNew ? 'Tier created. টিয়ার তৈরি হয়েছে।' : 'Tier updated. টিয়ার আপডেট হয়েছে।');
      await refresh();
    } catch (e) {
      setEditorError(e instanceof Error ? e.message : 'Save failed. সংরক্ষণ ব্যর্থ হয়েছে।');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (row: TierRow) => {
    try {
      const res = await fetch(`/api/admin/spin-tiers?id=${encodeURIComponent(row.id)}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        notify('Tier deleted. টিয়ার মুছে ফেলা হয়েছে।');
        refresh();
      } else {
        setError(`${data?.message ?? data?.code ?? 'Delete failed'} (Delete failed. ডিলিট ব্যর্থ হয়েছে।)`);
      }
    } catch {
      setError('Delete failed: network error. ডিলিট ব্যর্থ হয়েছে: নেটওয়ার্ক সমস্যা।');
    }
  };

  const toggle = async (row: TierRow) => {
    try {
      const res = await fetch('/api/admin/spin-tiers', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id: row.id, isActive: !row.isActive }),
      });
      if (!res.ok) {
        setError('Failed to update status. স্ট্যাটাস আপডেট ব্যর্থ হয়েছে।');
        return;
      }
      refresh();
    } catch {
      setError('Failed to update status: network error. স্ট্যাটাস আপডেট ব্যর্থ হয়েছে: নেটওয়ার্ক সমস্যা।');
    }
  };

  return (
    <>
      <PageHeader
        title="Spin Wheel Tiers"
        subtitle="Each tier is a separate wheel on /rewards with its own coin cost and free-spin allowance. Manage segment wedges under Spin Segments using the tier filter."
        icon={<Disc3 className="h-5 w-5" />}
        action={
          <div className="flex gap-2">
            <Button variant="ghost" leftIcon={<Sparkles className="h-4 w-4" />} loading={seedBusy} onClick={seed}>
              Seed default tiers
            </Button>
            <Button leftIcon={<Plus className="h-4 w-4" />} onClick={() => setEditor({ ...BLANK, position: rows.length })}>
              New Tier
            </Button>
          </div>
        }
      />

      {error ? <Card padding="md" className="mb-4"><p className="text-sm text-signal-danger">{error}</p></Card> : null}
      {info ? <Card padding="md" className="mb-4"><p className="text-sm text-signal-ok">{info}</p></Card> : null}

      <div className="space-y-3">
        {loading ? (
          <Card padding="lg">Loading...</Card>
        ) : rows.length === 0 ? (
          <Card padding="lg">
            <EmptyState
              title="No tiers configured"
              description={'Click "Seed default tiers" to materialise the 30 / 100 / 500-coin ladder (Lucky / Grand / Supreme) with their default segment wedges, or create a custom tier with "New Tier".'}
            />
          </Card>
        ) : (
          rows.map((row) => (
            <Card key={row.id} padding="lg" className="flex flex-col gap-4 md:flex-row md:items-center">
              <div
                className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl text-white"
                style={{ backgroundColor: row.color }}
              >
                <span className="text-xl font-bold">{row.costPerSpin}</span>
              </div>
              <div className="flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold text-ink-hi">{row.nameEn}</p>
                  <Chip tone="info">{row.key}</Chip>
                  <Chip tone={row.isActive ? 'ok' : 'neutral'}>{row.isActive ? 'active' : 'hidden'}</Chip>
                  <span className="text-[11px] text-ink-lo">position {row.position}</span>
                </div>
                {row.nameBn ? <p className="text-sm text-ink-mid">{row.nameBn}</p> : null}
                {row.descriptionEn ? <p className="text-xs text-ink-lo">{row.descriptionEn}</p> : null}
                <p className="text-[11px] text-ink-lo">
                  {row.costPerSpin} coins per spin . {row.freeSpinsPerDay} free spins per day . {row.segmentCount} segment(s) . {row.resultCount} historical spin(s)
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={row.isActive} onChange={() => toggle(row)} />
                <Link
                  className="inline-flex h-8 items-center justify-center rounded-md border border-brand-divider bg-brand-paper px-3 text-xs font-bold text-brand-ink hover:bg-brand-surface"
                  href={`/admin/spin-segments?tierId=${row.id}`}
                >
                  Segments
                </Link>
                <Button
                  size="sm"
                  variant="neon"
                  leftIcon={<Pencil className="h-3.5 w-3.5" />}
                  onClick={() => setEditor({
                    ...row,
                    nameBn: row.nameBn ?? '',
                    descriptionEn: row.descriptionEn ?? '',
                    descriptionBn: row.descriptionBn ?? '',
                    iconUrl: row.iconUrl ?? '',
                  })}
                >
                  Edit
                </Button>
                <Button size="sm" variant="danger" leftIcon={<Trash2 className="h-3.5 w-3.5" />} onClick={() => setDeleteTarget(row)}>
                  Delete
                </Button>
              </div>
            </Card>
          ))
        )}
      </div>

      <Modal open={!!editor} onOpenChange={(v) => { if (!v) { setEditor(null); setEditorError(null); } }} title={editor?.id ? 'Edit Tier' : 'New Tier'} size="lg">
        {editor ? (
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              void save();
            }}
          >
            <div className="grid gap-3 md:grid-cols-2">
              <FormField label="Key" required hint="Stable lowercase identifier used by the engine (lucky, grand, supreme...).">
                <Input
                  value={editor.key}
                  onChange={(e) => setEditor({ ...editor, key: e.target.value })}
                  disabled={!!editor.id}
                  placeholder="grand"
                />
              </FormField>
              <FormField label="Position">
                <Input type="number" value={editor.position} onChange={(e) => setEditor({ ...editor, position: Number(e.target.value) })} />
              </FormField>
              <FormField label="Name (English)" required>
                <Input value={editor.nameEn} onChange={(e) => setEditor({ ...editor, nameEn: e.target.value })} placeholder="Wheel of Grand Fortune" />
              </FormField>
              <FormField label="Name (Bangla)">
                <Input value={editor.nameBn ?? ''} onChange={(e) => setEditor({ ...editor, nameBn: e.target.value })} />
              </FormField>
              <FormField label="Cost per spin (coins)" required>
                <Input type="number" min="0" value={editor.costPerSpin} onChange={(e) => setEditor({ ...editor, costPerSpin: Number(e.target.value) })} />
              </FormField>
              <FormField label="Free spins per day">
                <Input type="number" min="0" value={editor.freeSpinsPerDay} onChange={(e) => setEditor({ ...editor, freeSpinsPerDay: Number(e.target.value) })} />
              </FormField>
              <FormField label="Accent colour">
                <Input value={editor.color} onChange={(e) => setEditor({ ...editor, color: e.target.value })} placeholder="#FFCC00" />
              </FormField>
              <FormField label="Icon URL (optional)">
                <Input value={editor.iconUrl ?? ''} onChange={(e) => setEditor({ ...editor, iconUrl: e.target.value })} placeholder="/uploads/banners/wheel.png" />
              </FormField>
            </div>
            <FormField label="Description (English)">
              <Textarea rows={2} value={editor.descriptionEn ?? ''} onChange={(e) => setEditor({ ...editor, descriptionEn: e.target.value })} />
            </FormField>
            <FormField label="Description (Bangla)">
              <Textarea rows={2} value={editor.descriptionBn ?? ''} onChange={(e) => setEditor({ ...editor, descriptionBn: e.target.value })} />
            </FormField>
            <label className="flex items-center gap-2 text-sm text-ink-mid">
              <Switch checked={editor.isActive} onChange={(v) => setEditor({ ...editor, isActive: Boolean(v) })} />
              Active
            </label>
            {editorError ? <p className="text-sm text-signal-danger">{editorError}</p> : null}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" type="button" onClick={() => { setEditor(null); setEditorError(null); }}>Cancel</Button>
              <Button type="submit" loading={busy}>Save</Button>
            </div>
          </form>
        ) : null}
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(v) => !v && setDeleteTarget(null)}
        title="Delete tier"
        message={deleteTarget ? `Delete tier "${deleteTarget.nameEn}"? Segments stay attached to no tier and stop appearing on the public wheel.` : ''}
        messageBn={deleteTarget ? `"${deleteTarget.nameBn || deleteTarget.nameEn}" টিয়ারটি মুছে ফেলবেন? সেগমেন্টগুলো কোনো টিয়ারে থাকবে না এবং পাবলিক হুইলে আর দেখা যাবে না।` : ''}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onConfirm={async () => { if (deleteTarget) await remove(deleteTarget); }}
      />
    </>
  );
}
