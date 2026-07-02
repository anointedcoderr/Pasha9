// Built by Anointed Coder.
//
// /admin/lotto-banners
//
// Operator-facing manager for the carousel that sits at the top of
// /lotto. Each row is either an image OR a video; the editor switches
// between modes based on the kind dropdown. Image uploads use the
// shared AdminMediaUpload (banners category, ~1200x600); videos use
// the same uploader with the banner_videos category (the URL input
// stays as a fallback for externally hosted files) and an optional
// poster image is the thumbnail shown before play starts.

'use client';

import { useCallback, useEffect, useState } from 'react';
import { PageHeader } from '@/components/site/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { FormField, Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Modal } from '@/components/ui/Modal';
import { Switch } from '@/components/ui/Switch';
import { Chip } from '@/components/ui/Chip';
import { EmptyState } from '@/components/ui/EmptyState';
import { AdminMediaUpload } from '@/components/admin/AdminMediaUpload';
import { ConfirmDialog } from '@/components/admin/ConfirmDialog';
import { GalleryHorizontalEnd, Plus, Pencil, Trash2, ArrowUp, ArrowDown } from 'lucide-react';

interface BannerRow {
  id: string;
  kind: 'image' | 'video';
  imageUrl: string | null;
  videoUrl: string | null;
  posterUrl: string | null;
  titleEn: string | null;
  titleBn: string | null;
  ctaUrl: string | null;
  autoplay: boolean;
  muted: boolean;
  loop: boolean;
  sortOrder: number;
  isActive: boolean;
}

const BLANK: BannerRow = {
  id: '',
  kind: 'image',
  imageUrl: '',
  videoUrl: '',
  posterUrl: '',
  titleEn: '',
  titleBn: '',
  ctaUrl: '',
  autoplay: true,
  muted: true,
  loop: true,
  sortOrder: 0,
  isActive: true,
};

export default function AdminLottoBannersPage() {
  const [rows, setRows] = useState<BannerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editor, setEditor] = useState<BannerRow | null>(null);
  const [editorError, setEditorError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  // In-page confirm dialog instead of native confirm(), which
  // installed PWAs suppress silently.
  const [deleteTarget, setDeleteTarget] = useState<BannerRow | null>(null);

  const notify = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  };

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch('/api/admin/lotto-banners', { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? data.code ?? 'Failed');
      setRows((data.banners ?? []) as BannerRow[]);
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
    setEditorError(null);
    const payload = {
      kind: editor.kind,
      imageUrl: editor.kind === 'image' ? editor.imageUrl || null : null,
      videoUrl: editor.kind === 'video' ? editor.videoUrl || null : null,
      posterUrl: editor.posterUrl || null,
      titleEn: editor.titleEn || null,
      titleBn: editor.titleBn || null,
      ctaUrl: editor.ctaUrl || null,
      autoplay: editor.autoplay,
      muted: editor.muted,
      loop: editor.loop,
      sortOrder: editor.sortOrder,
      isActive: editor.isActive,
    };
    try {
      const isNew = !editor.id;
      const res = isNew
        ? await fetch('/api/admin/lotto-banners', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) })
        : await fetch(`/api/admin/lotto-banners/${editor.id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? data.code ?? 'Save failed');
      setEditor(null);
      notify(isNew ? 'Banner created. ব্যানার তৈরি হয়েছে।' : 'Banner updated. ব্যানার আপডেট হয়েছে।');
      await refresh();
    } catch (e) {
      setEditorError(e instanceof Error ? e.message : 'Save failed. সংরক্ষণ ব্যর্থ হয়েছে।');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (b: BannerRow) => {
    try {
      const res = await fetch(`/api/admin/lotto-banners/${b.id}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        notify('Banner deleted. ব্যানার মুছে ফেলা হয়েছে।');
        refresh();
      } else {
        setError(`${data?.message ?? data?.code ?? 'Delete failed'} (Delete failed. ডিলিট ব্যর্থ হয়েছে।)`);
      }
    } catch {
      setError('Delete failed: network error. ডিলিট ব্যর্থ হয়েছে: নেটওয়ার্ক সমস্যা।');
    }
  };

  const toggle = async (b: BannerRow) => {
    try {
      const res = await fetch(`/api/admin/lotto-banners/${b.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ isActive: !b.isActive }),
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

  const move = async (b: BannerRow, dir: -1 | 1) => {
    const idx = rows.findIndex((x) => x.id === b.id);
    if (idx < 0) return;
    const swapIdx = idx + dir;
    if (swapIdx < 0 || swapIdx >= rows.length) return;
    const ids = rows.map((x) => x.id);
    [ids[idx], ids[swapIdx]] = [ids[swapIdx], ids[idx]];
    try {
      const res = await fetch('/api/admin/lotto-banners', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ids }),
      });
      if (!res.ok) {
        setError('Failed to reorder banner. ব্যানারের ক্রম পরিবর্তন ব্যর্থ হয়েছে।');
        return;
      }
      refresh();
    } catch {
      setError('Failed to reorder banner: network error. ক্রম পরিবর্তন ব্যর্থ হয়েছে: নেটওয়ার্ক সমস্যা।');
    }
  };

  return (
    <>
      <PageHeader
        title="Lotto Banners"
        subtitle="Image or video banners shown in the carousel at the top of /lotto. Use video banners to explain iBox logic, prize math, or run a promo loop."
        icon={<GalleryHorizontalEnd className="h-5 w-5" />}
        action={
          <Button leftIcon={<Plus className="h-4 w-4" />} onClick={() => setEditor({ ...BLANK, sortOrder: (rows.length + 1) * 10 })}>
            New Banner
          </Button>
        }
      />

      {toast ? <Card padding="md" className="mb-4"><p className="text-sm text-signal-ok">{toast}</p></Card> : null}
      {error ? <Card padding="md" className="mb-4"><p className="text-sm text-signal-danger">{error}</p></Card> : null}

      <div className="space-y-3">
        {loading ? (
          <Card padding="lg">Loading...</Card>
        ) : rows.length === 0 ? (
          <Card padding="lg">
            <EmptyState
              title="No banners yet"
              description="Add an image banner (recommended ~1200x600 PNG/JPG/WEBP) or a video banner (MP4) to take over the slot at the top of /lotto."
            />
          </Card>
        ) : (
          rows.map((b, idx) => (
            <Card key={b.id} padding="lg" className="flex flex-col gap-4 md:flex-row md:items-center">
              <div className="relative h-24 w-full max-w-[200px] overflow-hidden rounded-lg border border-brand-divider bg-base-deep md:shrink-0">
                {b.kind === 'image' && b.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={b.imageUrl} alt="" className="h-full w-full object-cover" />
                ) : b.kind === 'video' && (b.posterUrl || b.videoUrl) ? (
                  b.posterUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={b.posterUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <video src={b.videoUrl ?? ''} muted playsInline className="h-full w-full object-cover" />
                  )
                ) : (
                  <div className="flex h-full items-center justify-center text-[11px] text-ink-lo">No preview</div>
                )}
              </div>
              <div className="flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold text-ink-hi">{b.titleEn || '(untitled)'}</p>
                  <Chip tone="info">{b.kind}</Chip>
                  <Chip tone={b.isActive ? 'ok' : 'neutral'}>{b.isActive ? 'active' : 'hidden'}</Chip>
                  <span className="text-[11px] text-ink-lo">sort {b.sortOrder}</span>
                </div>
                {b.titleBn ? <p className="text-sm text-ink-mid">{b.titleBn}</p> : null}
                <p className="break-all text-[11px] text-ink-lo">
                  {b.kind === 'image' ? b.imageUrl : b.videoUrl}
                </p>
              </div>
              <div className="flex flex-row items-center gap-2 md:flex-col">
                <Button size="icon" variant="ghost" disabled={idx === 0} onClick={() => move(b, -1)}>
                  <ArrowUp className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="ghost" disabled={idx === rows.length - 1} onClick={() => move(b, 1)}>
                  <ArrowDown className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={b.isActive} onChange={() => toggle(b)} />
                <Button
                  size="sm"
                  variant="neon"
                  leftIcon={<Pencil className="h-3.5 w-3.5" />}
                  onClick={() => setEditor({
                    ...b,
                    imageUrl: b.imageUrl ?? '',
                    videoUrl: b.videoUrl ?? '',
                    posterUrl: b.posterUrl ?? '',
                    titleEn: b.titleEn ?? '',
                    titleBn: b.titleBn ?? '',
                    ctaUrl: b.ctaUrl ?? '',
                  })}
                >
                  Edit
                </Button>
                <Button size="sm" variant="danger" leftIcon={<Trash2 className="h-3.5 w-3.5" />} onClick={() => setDeleteTarget(b)}>
                  Delete
                </Button>
              </div>
            </Card>
          ))
        )}
      </div>

      <Modal open={!!editor} onOpenChange={(v) => { if (!v) { setEditor(null); setEditorError(null); } }} title={editor?.id ? 'Edit Banner' : 'New Banner'} size="lg">
        {editor ? (
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              void save();
            }}
          >
            <div className="grid gap-3 md:grid-cols-2">
              <FormField label="Kind" required>
                <Select value={editor.kind} onChange={(e) => setEditor({ ...editor, kind: e.target.value as 'image' | 'video' })}>
                  <option value="image">Image</option>
                  <option value="video">Video (MP4)</option>
                </Select>
              </FormField>
              <FormField label="Sort order">
                <Input type="number" value={editor.sortOrder} onChange={(e) => setEditor({ ...editor, sortOrder: Number(e.target.value) })} />
              </FormField>
            </div>

            {editor.kind === 'image' ? (
              <AdminMediaUpload
                label="Banner image"
                hint="Recommended ~1200x600. PNG / JPG / WEBP, max 3 MB."
                value={editor.imageUrl || null}
                category="banners"
                constraintHint="PNG / JPG / WEBP, ~1200x600, max 3 MB"
                onChange={(url) => setEditor({ ...editor, imageUrl: url ?? '' })}
              />
            ) : (
              <>
                <AdminMediaUpload
                  label="Upload video / ভিডিও আপলোড"
                  hint="Upload an MP4 / WebM file, or paste a URL below."
                  value={editor.videoUrl || null}
                  category="banner_videos"
                  constraintHint="MP4 / WebM, max 20 MB"
                  onChange={(url) => setEditor({ ...editor, videoUrl: url ?? '' })}
                />
                <FormField label="Video URL" hint="Filled automatically after upload, or paste an MP4 / WebM link (absolute or /uploads/... path).">
                  <Input
                    value={editor.videoUrl ?? ''}
                    onChange={(e) => setEditor({ ...editor, videoUrl: e.target.value })}
                    placeholder="/uploads/banner_videos/lotto-explainer.mp4"
                  />
                </FormField>
                <AdminMediaUpload
                  label="Poster image (optional)"
                  hint="Shown before the video starts playing."
                  value={editor.posterUrl || null}
                  category="banners"
                  constraintHint="PNG / JPG / WEBP, 16/9, max 2 MB"
                  onChange={(url) => setEditor({ ...editor, posterUrl: url ?? '' })}
                />
                <div className="grid grid-cols-3 gap-3">
                  <label className="flex items-center gap-2 text-sm text-ink-mid">
                    <Switch checked={editor.autoplay} onChange={(v) => setEditor({ ...editor, autoplay: Boolean(v) })} />
                    Autoplay
                  </label>
                  <label className="flex items-center gap-2 text-sm text-ink-mid">
                    <Switch checked={editor.muted} onChange={(v) => setEditor({ ...editor, muted: Boolean(v) })} />
                    Muted
                  </label>
                  <label className="flex items-center gap-2 text-sm text-ink-mid">
                    <Switch checked={editor.loop} onChange={(v) => setEditor({ ...editor, loop: Boolean(v) })} />
                    Loop
                  </label>
                </div>
              </>
            )}

            <div className="grid gap-3 md:grid-cols-2">
              <FormField label="Title (English)">
                <Input value={editor.titleEn ?? ''} onChange={(e) => setEditor({ ...editor, titleEn: e.target.value })} placeholder="iBox explained" />
              </FormField>
              <FormField label="Title (Bangla)">
                <Input value={editor.titleBn ?? ''} onChange={(e) => setEditor({ ...editor, titleBn: e.target.value })} placeholder="iBox ব্যাখ্যা" />
              </FormField>
            </div>
            <FormField label="Click target URL (optional)" hint="When set, the carousel renders the banner as a link.">
              <Input value={editor.ctaUrl ?? ''} onChange={(e) => setEditor({ ...editor, ctaUrl: e.target.value })} placeholder="/lotto/rules" />
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
        title="Delete banner"
        message={deleteTarget ? `Delete banner "${deleteTarget.titleEn || deleteTarget.titleBn || 'Untitled'}"? This cannot be undone.` : ''}
        messageBn={deleteTarget ? `"${deleteTarget.titleEn || deleteTarget.titleBn || 'Untitled'}" ব্যানারটি মুছে ফেলবেন? এটি আর ফেরানো যাবে না।` : ''}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onConfirm={async () => { if (deleteTarget) await remove(deleteTarget); }}
      />
    </>
  );
}
