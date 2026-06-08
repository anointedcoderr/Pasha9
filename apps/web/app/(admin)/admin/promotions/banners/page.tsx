// Built by Anointed Coder.

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
import { AdminMediaUpload } from '@/components/admin/AdminMediaUpload';
import { Gift, Plus, Pencil, Trash2, ArrowUp, ArrowDown } from 'lucide-react';

interface BannerRow {
  id: string;
  titleEn: string;
  titleBn: string | null;
  subtitleEn: string | null;
  subtitleBn: string | null;
  imageUrl: string | null;
  ctaUrl: string | null;
  sortOrder: number;
  isActive: boolean;
}
const NEW_BANNER: BannerRow = {
  id: '',
  titleEn: '',
  titleBn: '',
  subtitleEn: '',
  subtitleBn: '',
  imageUrl: '',
  ctaUrl: '',
  sortOrder: 0,
  isActive: true,
};

export default function AdminPromotionBannersPage() {
  const [banners, setBanners] = useState<BannerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editor, setEditor] = useState<BannerRow | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const response = await fetch('/api/admin/promotions/banners', { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message ?? data.code ?? 'Failed to load banners');
      setBanners(data.banners ?? []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to load banners');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const save = async () => {
    if (!editor) return;
    setBusy(true);
    setError(null);
    const isNew = !editor.id;
    try {
      const response = await fetch(isNew ? '/api/admin/promotions/banners' : `/api/admin/promotions/banners/${editor.id}`, {
        method: isNew ? 'POST' : 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          titleEn: editor.titleEn,
          titleBn: editor.titleBn || null,
          subtitleEn: editor.subtitleEn || null,
          subtitleBn: editor.subtitleBn || null,
          imageUrl: editor.imageUrl || null,
          ctaUrl: editor.ctaUrl || null,
          sortOrder: editor.sortOrder,
          isActive: editor.isActive,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message ?? data.code ?? 'Save failed');
      setEditor(null);
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Save failed');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm('Delete this promotion banner?')) return;
    const response = await fetch(`/api/admin/promotions/banners/${id}`, { method: 'DELETE' });
    if (response.ok) await refresh();
  };

  const toggle = async (banner: BannerRow) => {
    await fetch(`/api/admin/promotions/banners/${banner.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ isActive: !banner.isActive }),
    });
    await refresh();
  };

  const move = async (banner: BannerRow, direction: -1 | 1) => {
    const index = banners.findIndex((row) => row.id === banner.id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= banners.length) return;
    const ids = banners.map((row) => row.id);
    [ids[index], ids[target]] = [ids[target], ids[index]];
    await fetch('/api/admin/promotions/banners', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ids }),
    });
    await refresh();
  };

  return (
    <>
      <PageHeader
        title="Promotion Banners"
        subtitle="Manage the public Promotions and Rewards hero slider"
        icon={<Gift className="h-5 w-5" />}
        action={<Button leftIcon={<Plus className="h-4 w-4" />} onClick={() => setEditor({ ...NEW_BANNER, sortOrder: (banners.length + 1) * 10 })}>New Banner</Button>}
      />

      {error ? <Card padding="md" className="mb-4"><p className="text-sm text-signal-danger">{error}</p></Card> : null}

      <div className="space-y-3">
        {loading ? (
          <Card padding="lg">Loading...</Card>
        ) : banners.length === 0 ? (
          <Card padding="lg">
            <EmptyState title="No promotion banners yet" description="The public page currently uses its built-in fallback hero." />
          </Card>
        ) : banners.map((banner, index) => (
          <Card key={banner.id} padding="lg" className="flex flex-col gap-4 md:flex-row md:items-center">
            <div className="h-24 w-full max-w-[200px] overflow-hidden rounded-lg border border-brand-divider bg-base-deep md:shrink-0">
              {banner.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={banner.imageUrl} alt="" className="h-full w-full object-cover" />
              ) : <div className="flex h-full items-center justify-center text-[11px] text-ink-lo">No image</div>}
            </div>
            <div className="flex-1 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold text-ink-hi">{banner.titleEn}</p>
                <Chip tone={banner.isActive ? 'ok' : 'neutral'}>{banner.isActive ? 'active' : 'hidden'}</Chip>
                <span className="text-[11px] text-ink-lo">sort {banner.sortOrder}</span>
              </div>
              {banner.titleBn ? <p className="text-sm text-ink-mid">{banner.titleBn}</p> : null}
              {banner.subtitleEn ? <p className="text-xs text-ink-lo">{banner.subtitleEn}</p> : null}
              <p className="text-[11px] text-ink-lo">CTA: {banner.ctaUrl || '(none)'}</p>
            </div>
            <div className="flex gap-2 md:flex-col">
              <Button size="icon" variant="ghost" disabled={index === 0} onClick={() => move(banner, -1)}><ArrowUp className="h-4 w-4" /></Button>
              <Button size="icon" variant="ghost" disabled={index === banners.length - 1} onClick={() => move(banner, 1)}><ArrowDown className="h-4 w-4" /></Button>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={banner.isActive} onChange={() => toggle(banner)} />
              <Button size="sm" variant="neon" leftIcon={<Pencil className="h-3.5 w-3.5" />} onClick={() => setEditor(banner)}>Edit</Button>
              <Button size="sm" variant="danger" leftIcon={<Trash2 className="h-3.5 w-3.5" />} onClick={() => remove(banner.id)}>Delete</Button>
            </div>
          </Card>
        ))}
      </div>

      <Modal open={!!editor} onOpenChange={(open) => !open && setEditor(null)} title={editor?.id ? 'Edit Promotion Banner' : 'New Promotion Banner'} size="lg">
        {editor ? (
          <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); void save(); }}>
            <div className="grid gap-3 md:grid-cols-2">
              <FormField label="Title (English)" hint="Optional. Leave blank for image-only banners."><Input value={editor.titleEn} onChange={(event) => setEditor({ ...editor, titleEn: event.target.value })} /></FormField>
              <FormField label="Title (Bangla)"><Input value={editor.titleBn ?? ''} onChange={(event) => setEditor({ ...editor, titleBn: event.target.value })} /></FormField>
              <FormField label="Subtitle (English)"><Textarea rows={2} value={editor.subtitleEn ?? ''} onChange={(event) => setEditor({ ...editor, subtitleEn: event.target.value })} /></FormField>
              <FormField label="Subtitle (Bangla)"><Textarea rows={2} value={editor.subtitleBn ?? ''} onChange={(event) => setEditor({ ...editor, subtitleBn: event.target.value })} /></FormField>
              <FormField label="CTA URL" hint="Optional click destination."><Input value={editor.ctaUrl ?? ''} onChange={(event) => setEditor({ ...editor, ctaUrl: event.target.value })} placeholder="/promotions" /></FormField>
              <FormField label="Sort order"><Input type="number" value={editor.sortOrder} onChange={(event) => setEditor({ ...editor, sortOrder: Number(event.target.value) })} /></FormField>
            </div>
            <AdminMediaUpload
              label="Banner image"
              hint="Premium hero background. Recommended 1200x420."
              value={editor.imageUrl}
              category="banners"
              onChange={(url) => setEditor({ ...editor, imageUrl: url ?? '' })}
            />
            <label className="flex items-center gap-2 text-sm text-ink-mid">
              <Switch checked={editor.isActive} onChange={(active) => setEditor({ ...editor, isActive: Boolean(active) })} />
              Active
            </label>
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
