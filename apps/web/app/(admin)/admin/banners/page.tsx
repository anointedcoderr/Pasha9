// Built by Anointed Coder.
'use client';

import { useEffect, useState, useCallback } from 'react';
import { PageHeader } from '@/components/site/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { FormField, Input, Textarea } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Modal } from '@/components/ui/Modal';
import { Switch } from '@/components/ui/Switch';
import { Image as ImageIcon, Plus, Pencil, Trash2, ArrowUp, ArrowDown } from 'lucide-react';
import { Chip } from '@/components/ui/Chip';
import { AdminMediaUpload } from '@/components/admin/AdminMediaUpload';
import { EmptyState } from '@/components/ui/EmptyState';

type Accent = 'gold' | 'neon' | 'mixed' | 'royal' | 'red';
type Status = 'active' | 'hidden' | 'paused';
type MediaType = 'image' | 'video';

interface BannerRow {
  id: string;
  title: string;
  titleEn?: string | null;
  subtitle?: string | null;
  subtitleEn?: string | null;
  ctaLabel?: string | null;
  link?: string | null;
  mediaType: MediaType;
  imageUrl?: string | null;
  videoUrl?: string | null;
  posterUrl?: string | null;
  accent: Accent;
  position: number;
  status: Status;
}

const NEW_BANNER: BannerRow = {
  id: '',
  title: '',
  titleEn: '',
  subtitle: '',
  subtitleEn: '',
  ctaLabel: '',
  link: '',
  mediaType: 'image',
  imageUrl: '',
  videoUrl: '',
  posterUrl: '',
  accent: 'gold',
  position: 0,
  status: 'active',
};

export default function AdminBannersPage() {
  const [banners, setBanners] = useState<BannerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editor, setEditor] = useState<BannerRow | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch('/api/admin/banners', { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? data.code ?? 'Failed');
      setBanners(data.banners ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load banners');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const save = async () => {
    if (!editor) return;
    setBusy(true);
    setError(null);
    const isNew = !editor.id;
    const payload = {
      title: editor.title,
      titleEn: editor.titleEn || undefined,
      subtitle: editor.subtitle || undefined,
      subtitleEn: editor.subtitleEn || undefined,
      ctaLabel: editor.ctaLabel || undefined,
      link: editor.link || undefined,
      mediaType: editor.mediaType,
      imageUrl: editor.imageUrl || undefined,
      videoUrl: editor.videoUrl || undefined,
      posterUrl: editor.posterUrl || undefined,
      accent: editor.accent,
      position: editor.position,
      status: editor.status,
    };
    try {
      const res = isNew
        ? await fetch('/api/admin/banners', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) })
        : await fetch(`/api/admin/banners/${editor.id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? data.code ?? 'Save failed');
      setEditor(null);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm('Delete this banner?')) return;
    const res = await fetch(`/api/admin/banners/${id}`, { method: 'DELETE' });
    if (res.ok) refresh();
  };

  const toggle = async (b: BannerRow) => {
    await fetch(`/api/admin/banners/${b.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status: b.status === 'active' ? 'hidden' : 'active' }),
    });
    refresh();
  };

  const move = async (b: BannerRow, dir: -1 | 1) => {
    await fetch(`/api/admin/banners/${b.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ position: Math.max(0, b.position + dir) }),
    });
    refresh();
  };

  return (
    <>
      <PageHeader
        title="Banners and Sliders"
        subtitle="Hero slider content for the homepage"
        icon={<ImageIcon className="h-5 w-5" />}
        action={
          <Button leftIcon={<Plus className="h-4 w-4" />} onClick={() => setEditor({ ...NEW_BANNER, position: banners.length + 1 })}>
            New Banner
          </Button>
        }
      />

      {error ? <Card padding="md" className="mb-4"><p className="text-sm text-signal-danger">{error}</p></Card> : null}

      <div className="space-y-4">
        {loading ? (
          <Card padding="lg">Loading...</Card>
        ) : banners.length === 0 ? (
          <Card padding="lg"><EmptyState title="No banners yet" description="Create the first banner to populate the homepage hero." /></Card>
        ) : (
          banners.map((b) => (
            <Card key={b.id} padding="lg" className="flex flex-col gap-4 md:flex-row md:items-center">
              <BannerPreview accent={b.accent} title={b.title} subtitle={b.subtitle ?? ''} ctaLabel={b.ctaLabel ?? ''} />
              <div className="flex-1 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold text-ink-hi">{b.title}</p>
                  <Chip tone={b.status === 'active' ? 'ok' : 'neutral'}>{b.status}</Chip>
                  <Chip tone={b.mediaType === 'video' ? 'warn' : 'neutral'}>{b.mediaType ?? 'image'}</Chip>
                  <span className="text-[11px] text-ink-lo">position {b.position}</span>
                </div>
                <p className="text-sm text-ink-mid">{b.subtitle}</p>
                <p className="text-xs text-ink-lo">CTA: {b.ctaLabel} | {b.link}</p>
                {b.mediaType === 'video' ? (
                  <p className="text-[11px] text-ink-lo">Video: {b.videoUrl} | Poster: {b.posterUrl || '(none)'}</p>
                ) : (
                  <p className="text-[11px] text-ink-lo">Image: {b.imageUrl || '(none)'}</p>
                )}
              </div>
              <div className="flex flex-row items-center gap-2 md:flex-col">
                <Button size="icon" variant="ghost" onClick={() => move(b, -1)}><ArrowUp className="h-4 w-4" /></Button>
                <Button size="icon" variant="ghost" onClick={() => move(b, 1)}><ArrowDown className="h-4 w-4" /></Button>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={b.status === 'active'} onChange={() => toggle(b)} />
                <Button size="sm" variant="neon" leftIcon={<Pencil className="h-3.5 w-3.5" />} onClick={() => setEditor(b)}>Edit</Button>
                <Button size="sm" variant="danger" leftIcon={<Trash2 className="h-3.5 w-3.5" />} onClick={() => remove(b.id)}>Delete</Button>
              </div>
            </Card>
          ))
        )}
      </div>

      <Modal open={!!editor} onOpenChange={(v) => !v && setEditor(null)} title={editor?.id ? 'Edit Banner' : 'New Banner'} size="lg">
        {editor ? (
          <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); void save(); }}>
            <div className="grid gap-3 md:grid-cols-2">
              <FormField label="Title (Bangla)" required>
                <Input value={editor.title} onChange={(e) => setEditor({ ...editor, title: e.target.value })} />
              </FormField>
              <FormField label="Title (English)">
                <Input value={editor.titleEn ?? ''} onChange={(e) => setEditor({ ...editor, titleEn: e.target.value })} />
              </FormField>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <FormField label="Subtitle (Bangla)">
                <Textarea rows={2} value={editor.subtitle ?? ''} onChange={(e) => setEditor({ ...editor, subtitle: e.target.value })} />
              </FormField>
              <FormField label="Subtitle (English)">
                <Textarea rows={2} value={editor.subtitleEn ?? ''} onChange={(e) => setEditor({ ...editor, subtitleEn: e.target.value })} />
              </FormField>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <FormField label="CTA Label">
                <Input value={editor.ctaLabel ?? ''} onChange={(e) => setEditor({ ...editor, ctaLabel: e.target.value })} />
              </FormField>
              <FormField label="CTA Href">
                <Input value={editor.link ?? ''} onChange={(e) => setEditor({ ...editor, link: e.target.value })} placeholder="/promotions" />
              </FormField>
              <FormField label="Media Type">
                <Select value={editor.mediaType} onChange={(e) => setEditor({ ...editor, mediaType: e.target.value as MediaType })}>
                  <option value="image">Image</option>
                  <option value="video">Video</option>
                </Select>
              </FormField>
              <FormField label="Accent">
                <Select value={editor.accent} onChange={(e) => setEditor({ ...editor, accent: e.target.value as Accent })}>
                  <option value="gold">Gold</option>
                  <option value="neon">Neon</option>
                  <option value="mixed">Mixed</option>
                  <option value="royal">Royal</option>
                  <option value="red">Red</option>
                </Select>
              </FormField>
              {editor.mediaType === 'image' ? (
                <AdminMediaUpload
                  label="Banner image"
                  hint="Recommended 1600x600 JPG / PNG / WEBP."
                  value={editor.imageUrl}
                  category="banners"
                  constraintHint="PNG / JPG / WEBP, ~1920x720, max 4 MB"
                  onChange={(url) => setEditor({ ...editor, imageUrl: url ?? '' })}
                />
              ) : (
                <>
                  <FormField label="Video URL" hint="MP4 / WebM. Autoplay-muted on the public slider. Use absolute or /uploads/... path.">
                    <Input value={editor.videoUrl ?? ''} onChange={(e) => setEditor({ ...editor, videoUrl: e.target.value })} placeholder="/uploads/banners/promo.mp4" />
                  </FormField>
                  <AdminMediaUpload
                    label="Video poster"
                    hint="Still frame shown while the video loads."
                    value={editor.posterUrl}
                    category="banners"
                    constraintHint="PNG / JPG / WEBP, ~1920x720, max 4 MB"
                    onChange={(url) => setEditor({ ...editor, posterUrl: url ?? '' })}
                  />
                </>
              )}
              <FormField label="Position">
                <Input type="number" value={editor.position} onChange={(e) => setEditor({ ...editor, position: Number(e.target.value) })} />
              </FormField>
              <FormField label="Status">
                <Select value={editor.status} onChange={(e) => setEditor({ ...editor, status: e.target.value as Status })}>
                  <option value="active">Active</option>
                  <option value="hidden">Hidden</option>
                  <option value="paused">Paused</option>
                </Select>
              </FormField>
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

function BannerPreview({ accent, title, subtitle, ctaLabel }: { accent: Accent; title: string; subtitle: string; ctaLabel: string }) {
  const accentMap: Record<Accent, string> = {
    gold: 'from-gold-300/30 to-gold-700/10 border-gold-500/40',
    neon: 'from-neon/30 to-emerald-700/10 border-neon/40',
    mixed: 'from-gold-300/20 via-neon/20 to-transparent border-neon/30',
    royal: 'from-fuchsia-500/20 to-indigo-700/10 border-fuchsia-400/40',
    red: 'from-rose-500/20 to-orange-700/10 border-rose-400/40',
  };
  return (
    <div className={`relative w-full max-w-[260px] overflow-hidden rounded-xl border bg-gradient-to-br ${accentMap[accent]} p-3 md:shrink-0`}>
      <p className="text-xs font-semibold text-ink-hi line-clamp-2">{title}</p>
      <p className="mt-1 text-[10px] text-ink-mid line-clamp-2">{subtitle}</p>
      {ctaLabel ? <span className="mt-2 inline-block rounded-md bg-base-deep/60 px-2 py-0.5 text-[10px] text-gold-300">{ctaLabel}</span> : null}
    </div>
  );
}
