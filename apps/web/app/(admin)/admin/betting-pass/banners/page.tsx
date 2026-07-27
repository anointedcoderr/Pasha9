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
import { Sparkles, Plus, Pencil, Trash2, ArrowUp, ArrowDown } from 'lucide-react';

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
  showOverlay: boolean;
  overlayPosition: string;
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
  showOverlay: true,
  overlayPosition: 'left',
};

export default function AdminBettingPassBannersPage() {
  const [banners, setBanners] = useState<BannerRow[]>([]);
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
      const res = await fetch('/api/admin/betting-pass/banners', { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? data.code ?? 'Failed');
      setBanners(data.banners ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load banners');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const save = async () => {
    if (!editor) return;
    setBusy(true);
    setEditorError(null);
    const isNew = !editor.id;
    const payload = {
      titleEn: editor.titleEn,
      titleBn: editor.titleBn || null,
      subtitleEn: editor.subtitleEn || null,
      subtitleBn: editor.subtitleBn || null,
      imageUrl: editor.imageUrl || null,
      ctaUrl: editor.ctaUrl || null,
      sortOrder: editor.sortOrder,
      isActive: editor.isActive,
      showOverlay: editor.showOverlay,
      overlayPosition: editor.overlayPosition,
    };
    try {
      const res = isNew
        ? await fetch('/api/admin/betting-pass/banners', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(payload),
          })
        : await fetch(`/api/admin/betting-pass/banners/${editor.id}`, {
            method: 'PATCH',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(payload),
          });
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
      const res = await fetch(`/api/admin/betting-pass/banners/${b.id}`, { method: 'DELETE' });
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
      const res = await fetch(`/api/admin/betting-pass/banners/${b.id}`, {
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
    const idx = banners.findIndex((x) => x.id === b.id);
    if (idx < 0) return;
    const swapIdx = idx + dir;
    if (swapIdx < 0 || swapIdx >= banners.length) return;
    const ids = banners.map((x) => x.id);
    [ids[idx], ids[swapIdx]] = [ids[swapIdx], ids[idx]];
    try {
      const res = await fetch('/api/admin/betting-pass/banners', {
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
        title="Betting Pass Banners"
        subtitle="Slider banners shown above the Betting Pass page"
        icon={<Sparkles className="h-5 w-5" />}
        action={
          <Button
            leftIcon={<Plus className="h-4 w-4" />}
            onClick={() => setEditor({ ...NEW_BANNER, sortOrder: (banners.length + 1) * 10 })}
          >
            New Banner
          </Button>
        }
      />

      {toast ? (
        <Card padding="md" className="mb-4">
          <p className="text-sm text-signal-ok">{toast}</p>
        </Card>
      ) : null}
      {error ? (
        <Card padding="md" className="mb-4">
          <p className="text-sm text-signal-danger">{error}</p>
        </Card>
      ) : null}

      <div className="space-y-3">
        {loading ? (
          <Card padding="lg">Loading...</Card>
        ) : banners.length === 0 ? (
          <Card padding="lg">
            <EmptyState
              title="No banners yet"
              description="When empty, the public page renders the built-in Betting Pass hero. Add at least one banner to take over the slider."
            />
          </Card>
        ) : (
          banners.map((b, idx) => (
            <Card key={b.id} padding="lg" className="flex flex-col gap-4 md:flex-row md:items-center">
              <div className="relative h-24 w-full max-w-[200px] overflow-hidden rounded-lg border border-brand-divider bg-base-deep md:shrink-0">
                {b.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={b.imageUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center text-[11px] text-ink-lo">No image</div>
                )}
              </div>
              <div className="flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold text-ink-hi">{b.titleEn}</p>
                  <Chip tone={b.isActive ? 'ok' : 'neutral'}>{b.isActive ? 'active' : 'hidden'}</Chip>
                  <span className="text-[11px] text-ink-lo">sort {b.sortOrder}</span>
                </div>
                {b.titleBn ? <p className="text-sm text-ink-mid">{b.titleBn}</p> : null}
                {b.subtitleEn ? <p className="text-xs text-ink-lo">{b.subtitleEn}</p> : null}
                <p className="text-[11px] text-ink-lo">CTA: {b.ctaUrl || '(none)'}</p>
              </div>
              <div className="flex flex-row items-center gap-2 md:flex-col">
                <Button size="icon" variant="ghost" disabled={idx === 0} onClick={() => move(b, -1)}>
                  <ArrowUp className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="ghost" disabled={idx === banners.length - 1} onClick={() => move(b, 1)}>
                  <ArrowDown className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={b.isActive} onChange={() => toggle(b)} />
                <Button size="sm" variant="neon" leftIcon={<Pencil className="h-3.5 w-3.5" />} onClick={() => setEditor(b)}>
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

      <Modal
        open={!!editor}
        onOpenChange={(v) => { if (!v) { setEditor(null); setEditorError(null); } }}
        title={editor?.id ? 'Edit Banner' : 'New Banner'}
        size="lg"
      >
        {editor ? (
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              void save();
            }}
          >
            <div className="grid gap-3 md:grid-cols-2">
              <FormField label="Title (English)" hint="Optional. Leave blank for image-only banners.">
                <Input value={editor.titleEn} onChange={(e) => setEditor({ ...editor, titleEn: e.target.value })} />
              </FormField>
              <FormField label="Title (Bangla)">
                <Input value={editor.titleBn ?? ''} onChange={(e) => setEditor({ ...editor, titleBn: e.target.value })} />
              </FormField>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <FormField label="Subtitle (English)">
                <Textarea
                  rows={2}
                  value={editor.subtitleEn ?? ''}
                  onChange={(e) => setEditor({ ...editor, subtitleEn: e.target.value })}
                />
              </FormField>
              <FormField label="Subtitle (Bangla)">
                <Textarea
                  rows={2}
                  value={editor.subtitleBn ?? ''}
                  onChange={(e) => setEditor({ ...editor, subtitleBn: e.target.value })}
                />
              </FormField>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <FormField label="CTA URL" hint="Optional. Wrap the slide in a link to this destination.">
                <Input
                  value={editor.ctaUrl ?? ''}
                  onChange={(e) => setEditor({ ...editor, ctaUrl: e.target.value })}
                  placeholder="/betting-pass"
                />
              </FormField>
              <FormField label="Sort order">
                <Input
                  type="number"
                  value={editor.sortOrder}
                  onChange={(e) => setEditor({ ...editor, sortOrder: Number(e.target.value) })}
                />
              </FormField>
            </div>
            <AdminMediaUpload
              label="Banner image"
              hint="Background image for the slide. Recommended 1200x420."
              value={editor.imageUrl}
              category="banners"
              constraintHint="PNG / JPG / WEBP, ~1200x420, max 4 MB"
              onChange={(url) => setEditor({ ...editor, imageUrl: url ?? '' })}
            />
            <div className="grid gap-3 md:grid-cols-2">
              <label className="flex items-center gap-2 text-sm text-ink-mid">
                <Switch checked={editor.showOverlay} onChange={(v) => setEditor({ ...editor, showOverlay: Boolean(v) })} />
                Show text overlay (badge, title, subtitle)
              </label>
              <FormField label="Overlay position" hint="Where the text sits. Turn the overlay off to show the uploaded image clean.">
                <Select value={editor.overlayPosition} onChange={(e) => setEditor({ ...editor, overlayPosition: e.target.value })} disabled={!editor.showOverlay}>
                  <option value="left">Left</option>
                  <option value="center">Center</option>
                  <option value="right">Right</option>
                </Select>
              </FormField>
            </div>
            <label className="flex items-center gap-2 text-sm text-ink-mid">
              <Switch checked={editor.isActive} onChange={(v) => setEditor({ ...editor, isActive: Boolean(v) })} />
              Active
            </label>
            {editorError ? <p className="text-sm text-signal-danger">{editorError}</p> : null}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" type="button" onClick={() => { setEditor(null); setEditorError(null); }}>
                Cancel
              </Button>
              <Button type="submit" loading={busy}>
                Save
              </Button>
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
