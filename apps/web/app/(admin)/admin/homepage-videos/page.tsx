// Built by Anointed Coder.
'use client';

import { useCallback, useEffect, useState } from 'react';
import { PageHeader } from '@/components/site/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { FormField, Input, Textarea } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Modal } from '@/components/ui/Modal';
import { Switch } from '@/components/ui/Switch';
import { Chip } from '@/components/ui/Chip';
import { EmptyState } from '@/components/ui/EmptyState';
import { AdminMediaUpload } from '@/components/admin/AdminMediaUpload';
import { ConfirmDialog } from '@/components/admin/ConfirmDialog';
import { PlaySquare, Plus, Pencil, Trash2, ArrowUp, ArrowDown } from 'lucide-react';

interface VideoRow {
  id: string;
  titleEn: string;
  titleBn: string | null;
  subtitleEn: string | null;
  subtitleBn: string | null;
  sourceType: 'youtube' | 'upload';
  youtubeUrl: string | null;
  youtubeVideoId: string | null;
  videoUrl: string | null;
  thumbnailUrl: string | null;
  ctaUrl: string | null;
  sortOrder: number;
  isActive: boolean;
}

const BLANK: VideoRow = {
  id: '',
  titleEn: '',
  titleBn: '',
  subtitleEn: '',
  subtitleBn: '',
  sourceType: 'youtube',
  youtubeUrl: '',
  youtubeVideoId: null,
  videoUrl: '',
  thumbnailUrl: '',
  ctaUrl: '',
  sortOrder: 0,
  isActive: true,
};

export default function AdminHomepageVideosPage() {
  const [videos, setVideos] = useState<VideoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editor, setEditor] = useState<VideoRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  // In-page confirm dialog instead of native confirm(), which
  // installed PWAs suppress silently.
  const [deleteTarget, setDeleteTarget] = useState<VideoRow | null>(null);

  const notify = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  };

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch('/api/admin/homepage-videos', { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? data.code ?? 'Failed');
      setVideos(data.videos ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load videos');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const save = async () => {
    if (!editor) return;
    setBusy(true);
    setError(null);
    const payload = {
      titleEn: editor.titleEn,
      titleBn: editor.titleBn || null,
      subtitleEn: editor.subtitleEn || null,
      subtitleBn: editor.subtitleBn || null,
      sourceType: editor.sourceType,
      youtubeUrl: editor.sourceType === 'youtube' ? editor.youtubeUrl || null : null,
      videoUrl: editor.sourceType === 'upload' ? editor.videoUrl || null : null,
      thumbnailUrl: editor.thumbnailUrl || null,
      ctaUrl: editor.ctaUrl || null,
      sortOrder: editor.sortOrder,
      isActive: editor.isActive,
    };
    try {
      const isNew = !editor.id;
      const res = isNew
        ? await fetch('/api/admin/homepage-videos', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) })
        : await fetch(`/api/admin/homepage-videos/${editor.id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
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

  const remove = async (v: VideoRow) => {
    try {
      const res = await fetch(`/api/admin/homepage-videos/${v.id}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        notify('Video deleted. ভিডিও মুছে ফেলা হয়েছে।');
        refresh();
      } else {
        setError(`${data?.message ?? data?.code ?? 'Delete failed'} (Delete failed. ডিলিট ব্যর্থ হয়েছে।)`);
      }
    } catch {
      setError('Delete failed: network error. ডিলিট ব্যর্থ হয়েছে: নেটওয়ার্ক সমস্যা।');
    }
  };

  const toggle = async (v: VideoRow) => {
    try {
      const res = await fetch(`/api/admin/homepage-videos/${v.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ isActive: !v.isActive }),
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

  const move = async (v: VideoRow, dir: -1 | 1) => {
    const idx = videos.findIndex((x) => x.id === v.id);
    if (idx < 0) return;
    const swapIdx = idx + dir;
    if (swapIdx < 0 || swapIdx >= videos.length) return;
    const ids = videos.map((x) => x.id);
    [ids[idx], ids[swapIdx]] = [ids[swapIdx], ids[idx]];
    try {
      const res = await fetch('/api/admin/homepage-videos', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ids }),
      });
      if (!res.ok) {
        setError('Failed to reorder video. ভিডিওর ক্রম পরিবর্তন ব্যর্থ হয়েছে।');
        return;
      }
      refresh();
    } catch {
      setError('Failed to reorder video: network error. ক্রম পরিবর্তন ব্যর্থ হয়েছে: নেটওয়ার্ক সমস্যা।');
    }
  };

  return (
    <>
      <PageHeader
        title="Homepage Videos"
        subtitle="Brand ambassador and promo videos shown in the homepage carousel"
        icon={<PlaySquare className="h-5 w-5" />}
        action={
          <Button leftIcon={<Plus className="h-4 w-4" />} onClick={() => setEditor({ ...BLANK, sortOrder: (videos.length + 1) * 10 })}>
            New Video
          </Button>
        }
      />

      {toast ? <Card padding="md" className="mb-4"><p className="text-sm text-signal-ok">{toast}</p></Card> : null}
      {error ? <Card padding="md" className="mb-4"><p className="text-sm text-signal-danger">{error}</p></Card> : null}

      <div className="space-y-3">
        {loading ? (
          <Card padding="lg">Loading...</Card>
        ) : videos.length === 0 ? (
          <Card padding="lg">
            <EmptyState
              title="No videos yet"
              description="With no rows, the homepage falls back to the existing ambassador placeholder. Add one to take over with a real carousel."
            />
          </Card>
        ) : (
          videos.map((v, idx) => (
            <Card key={v.id} padding="lg" className="flex flex-col gap-4 md:flex-row md:items-center">
              <div className="relative h-24 w-full max-w-[160px] overflow-hidden rounded-lg border border-brand-divider bg-base-deep md:shrink-0">
                {v.thumbnailUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={v.thumbnailUrl} alt="" className="h-full w-full object-cover" />
                ) : v.sourceType === 'youtube' && v.youtubeVideoId ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={`https://img.youtube.com/vi/${v.youtubeVideoId}/hqdefault.jpg`} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center text-[11px] text-ink-lo">No preview</div>
                )}
              </div>
              <div className="flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold text-ink-hi">{v.titleEn}</p>
                  <Chip tone="info">{v.sourceType}</Chip>
                  <Chip tone={v.isActive ? 'ok' : 'neutral'}>{v.isActive ? 'active' : 'hidden'}</Chip>
                  <span className="text-[11px] text-ink-lo">sort {v.sortOrder}</span>
                </div>
                {v.titleBn ? <p className="text-sm text-ink-mid">{v.titleBn}</p> : null}
                {v.subtitleEn ? <p className="text-xs text-ink-lo">{v.subtitleEn}</p> : null}
                <p className="break-all text-[11px] text-ink-lo">
                  {v.sourceType === 'youtube' ? v.youtubeUrl : v.videoUrl}
                </p>
              </div>
              <div className="flex flex-row items-center gap-2 md:flex-col">
                <Button size="icon" variant="ghost" disabled={idx === 0} onClick={() => move(v, -1)}>
                  <ArrowUp className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="ghost" disabled={idx === videos.length - 1} onClick={() => move(v, 1)}>
                  <ArrowDown className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={v.isActive} onChange={() => toggle(v)} />
                <Button size="sm" variant="neon" leftIcon={<Pencil className="h-3.5 w-3.5" />} onClick={() => setEditor({ ...v, titleBn: v.titleBn ?? '', subtitleEn: v.subtitleEn ?? '', subtitleBn: v.subtitleBn ?? '', youtubeUrl: v.youtubeUrl ?? '', videoUrl: v.videoUrl ?? '', thumbnailUrl: v.thumbnailUrl ?? '', ctaUrl: v.ctaUrl ?? '' })}>
                  Edit
                </Button>
                <Button size="sm" variant="danger" leftIcon={<Trash2 className="h-3.5 w-3.5" />} onClick={() => setDeleteTarget(v)}>
                  Delete
                </Button>
              </div>
            </Card>
          ))
        )}
      </div>

      <Modal open={!!editor} onOpenChange={(v) => !v && setEditor(null)} title={editor?.id ? 'Edit Video' : 'New Video'} size="lg">
        {editor ? (
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              void save();
            }}
          >
            <div className="grid gap-3 md:grid-cols-2">
              <FormField label="Title (English)" required>
                <Input value={editor.titleEn} onChange={(e) => setEditor({ ...editor, titleEn: e.target.value })} />
              </FormField>
              <FormField label="Title (Bangla)">
                <Input value={editor.titleBn ?? ''} onChange={(e) => setEditor({ ...editor, titleBn: e.target.value })} />
              </FormField>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <FormField label="Subtitle (English)">
                <Textarea rows={2} value={editor.subtitleEn ?? ''} onChange={(e) => setEditor({ ...editor, subtitleEn: e.target.value })} />
              </FormField>
              <FormField label="Subtitle (Bangla)">
                <Textarea rows={2} value={editor.subtitleBn ?? ''} onChange={(e) => setEditor({ ...editor, subtitleBn: e.target.value })} />
              </FormField>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <FormField label="Source" required>
                <Select value={editor.sourceType} onChange={(e) => setEditor({ ...editor, sourceType: e.target.value as VideoRow['sourceType'] })}>
                  <option value="youtube">YouTube URL</option>
                  <option value="upload">Direct upload</option>
                </Select>
              </FormField>
              <FormField label="Sort order">
                <Input type="number" value={editor.sortOrder} onChange={(e) => setEditor({ ...editor, sortOrder: Number(e.target.value) })} />
              </FormField>
            </div>
            {editor.sourceType === 'youtube' ? (
              <FormField label="YouTube URL" required hint="Accepts youtu.be/<id>, /watch?v=<id>, /embed/<id>, /shorts/<id>.">
                <Input
                  value={editor.youtubeUrl ?? ''}
                  onChange={(e) => setEditor({ ...editor, youtubeUrl: e.target.value })}
                  placeholder="https://www.youtube.com/watch?v=..."
                />
              </FormField>
            ) : (
              <FormField label="Direct video URL" required hint="mp4 or webm served from /uploads/videos/...">
                <Input
                  value={editor.videoUrl ?? ''}
                  onChange={(e) => setEditor({ ...editor, videoUrl: e.target.value })}
                  placeholder="/uploads/videos/promo.mp4"
                />
              </FormField>
            )}
            <AdminMediaUpload
              label="Thumbnail override (optional)"
              hint="When empty, the carousel uses the YouTube hq thumbnail or the video first frame."
              value={editor.thumbnailUrl || null}
              category="banners"
              constraintHint="PNG / JPG / WEBP, 16/9, max 2 MB"
              onChange={(url) => setEditor({ ...editor, thumbnailUrl: url ?? '' })}
            />
            <FormField label="Click target URL (optional)" hint="When set, the carousel renders a 'Learn more' button.">
              <Input value={editor.ctaUrl ?? ''} onChange={(e) => setEditor({ ...editor, ctaUrl: e.target.value })} placeholder="/promotions" />
            </FormField>
            <label className="flex items-center gap-2 text-sm text-ink-mid">
              <Switch checked={editor.isActive} onChange={(v) => setEditor({ ...editor, isActive: Boolean(v) })} />
              Active
            </label>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" type="button" onClick={() => setEditor(null)}>Cancel</Button>
              <Button type="submit" loading={busy}>Save</Button>
            </div>
          </form>
        ) : null}
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(v) => !v && setDeleteTarget(null)}
        title="Delete video"
        message={deleteTarget ? `Delete video "${deleteTarget.titleEn || deleteTarget.titleBn || 'Untitled'}"? This cannot be undone.` : ''}
        messageBn={deleteTarget ? `"${deleteTarget.titleEn || deleteTarget.titleBn || 'Untitled'}" ভিডিওটি মুছে ফেলবেন? এটি আর ফেরানো যাবে না।` : ''}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onConfirm={async () => { if (deleteTarget) await remove(deleteTarget); }}
      />
    </>
  );
}
