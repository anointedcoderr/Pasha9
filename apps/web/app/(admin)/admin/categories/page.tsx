// Built by Anointed Coder.
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { PageHeader } from '@/components/site/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { FormField, Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Modal } from '@/components/ui/Modal';
import { Chip } from '@/components/ui/Chip';
import { Switch } from '@/components/ui/Switch';
import { Layers, Plus, Pencil, Trash2, Upload, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { ConfirmDialog } from '@/components/admin/ConfirmDialog';

type Status = 'active' | 'hidden' | 'paused';

interface CategoryRow {
  id: string;
  slug: string;
  nameBn: string;
  nameEn: string;
  iconKey: string;
  iconImageUrl?: string | null;
  position: number;
  status: Status;
}

const BLANK: CategoryRow = {
  id: '',
  slug: '',
  nameBn: '',
  nameEn: '',
  iconKey: 'flame',
  iconImageUrl: '',
  position: 0,
  status: 'active',
};

export default function AdminCategoriesPage() {
  const [items, setItems] = useState<CategoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editor, setEditor] = useState<CategoryRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  // In-page confirm dialog instead of native confirm(), which
  // installed PWAs suppress silently.
  const [deleteTarget, setDeleteTarget] = useState<CategoryRow | null>(null);

  const notify = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  };

  const refresh = useCallback(async () => {
    setError(null);
    setRefreshing(true);
    try {
      const res = await fetch('/api/admin/categories', { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message ?? data?.code ?? 'Failed');
      setItems(data.categories as CategoryRow[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setRefreshing(false);
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
      slug: editor.slug,
      nameEn: editor.nameEn,
      nameBn: editor.nameBn,
      iconKey: editor.iconKey,
      iconImageUrl: editor.iconImageUrl || undefined,
      position: Number(editor.position) || 0,
      status: editor.status,
    };
    try {
      const res = isNew
        ? await fetch('/api/admin/categories', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) })
        : await fetch(`/api/admin/categories/${editor.id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message ?? data?.code ?? 'Save failed');
      setEditor(null);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (c: CategoryRow) => {
    try {
      const res = await fetch(`/api/admin/categories/${c.id}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        notify('Category deleted. ক্যাটাগরি মুছে ফেলা হয়েছে।');
        refresh();
      } else {
        setError(`${data?.message ?? data?.code ?? 'Delete failed'} (Delete failed. ডিলিট ব্যর্থ হয়েছে।)`);
      }
    } catch {
      setError('Delete failed: network error. ডিলিট ব্যর্থ হয়েছে: নেটওয়ার্ক সমস্যা।');
    }
  };

  const toggleStatus = async (c: CategoryRow) => {
    try {
      const res = await fetch(`/api/admin/categories/${c.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ status: c.status === 'active' ? 'hidden' : 'active' }),
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
        title="Game Categories"
        subtitle={loading ? 'Loading...' : `${items.length} categories`}
        icon={<Layers className="h-5 w-5" />}
        action={
          <div className="flex items-center gap-2">
            <Button variant="ghost" leftIcon={<RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} />} onClick={refresh}>
              Refresh
            </Button>
            <Button leftIcon={<Plus className="h-4 w-4" />} onClick={() => setEditor({ ...BLANK, position: items.length + 1 })}>
              New Category
            </Button>
          </div>
        }
      />

      {toast ? <Card padding="md" className="mb-4"><p className="text-sm text-signal-ok">{toast}</p></Card> : null}
      {error ? <Card padding="md" className="mb-4"><p className="text-sm text-signal-danger">{error}</p></Card> : null}

      {loading ? (
        <Card padding="lg">Loading...</Card>
      ) : items.length === 0 ? (
        <Card padding="lg"><p className="text-sm text-ink-mid">No categories yet. Create the first one to populate the public site.</p></Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {items.map((c) => (
            <Card key={c.id} padding="md">
              <div className="flex items-start gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-neon/15 bg-base-deep/40 overflow-hidden">
                  {c.iconImageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={c.iconImageUrl} alt="" className="h-full w-full object-contain" />
                  ) : (
                    <span className="text-[10px] font-bold uppercase text-ink-lo">{c.iconKey}</span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-ink-hi truncate">{c.nameEn}</p>
                  <p className="mt-0.5 text-xs text-ink-lo truncate">{c.nameBn} · /games/{c.slug}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px]">
                    <Chip tone={c.status === 'active' ? 'ok' : 'neutral'}>{c.status}</Chip>
                    <span className="text-ink-lo">pos {c.position}</span>
                    {c.iconImageUrl ? <Chip tone="info">image</Chip> : <Chip>icon-key</Chip>}
                  </div>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <Switch checked={c.status === 'active'} onChange={() => toggleStatus(c)} />
                <Button size="sm" variant="neon" leftIcon={<Pencil className="h-3.5 w-3.5" />} onClick={() => setEditor({ ...c, iconImageUrl: c.iconImageUrl ?? '' })}>Edit</Button>
                <Button size="sm" variant="danger" leftIcon={<Trash2 className="h-3.5 w-3.5" />} onClick={() => setDeleteTarget(c)}>Delete</Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal open={!!editor} onOpenChange={(v) => !v && setEditor(null)} title={editor?.id ? 'Edit Category' : 'New Category'} size="md">
        {editor ? (
          <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); void save(); }}>
            <div className="grid gap-3 md:grid-cols-2">
              <FormField label="Slug" required hint="Lowercase letters, digits, dashes.">
                <Input value={editor.slug} onChange={(e) => setEditor({ ...editor, slug: e.target.value.toLowerCase() })} placeholder="slots" />
              </FormField>
              <FormField label="Status">
                <Select value={editor.status} onChange={(e) => setEditor({ ...editor, status: e.target.value as Status })}>
                  <option value="active">Active</option>
                  <option value="hidden">Hidden</option>
                  <option value="paused">Paused</option>
                </Select>
              </FormField>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <FormField label="Name (English)" required>
                <Input value={editor.nameEn} onChange={(e) => setEditor({ ...editor, nameEn: e.target.value })} />
              </FormField>
              <FormField label="Name (Bangla)" required>
                <Input value={editor.nameBn} onChange={(e) => setEditor({ ...editor, nameBn: e.target.value })} />
              </FormField>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <FormField label="Icon key (fallback)" hint="Used when no icon image is uploaded.">
                <Input value={editor.iconKey} onChange={(e) => setEditor({ ...editor, iconKey: e.target.value })} placeholder="flame" />
              </FormField>
              <FormField label="Position">
                <Input type="number" min="0" value={String(editor.position)} onChange={(e) => setEditor({ ...editor, position: Number(e.target.value) || 0 })} />
              </FormField>
            </div>

            <CategoryIconUploader
              value={editor.iconImageUrl ?? ''}
              onChange={(v) => setEditor({ ...editor, iconImageUrl: v })}
            />

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
        title="Delete category"
        message={deleteTarget ? `Delete category "${deleteTarget.nameEn}"? Games linked to it will lose their group.` : ''}
        messageBn={deleteTarget ? `"${deleteTarget.nameBn || deleteTarget.nameEn}" ক্যাটাগরিটি মুছে ফেলবেন? এর সাথে যুক্ত গেমগুলো গ্রুপ হারাবে।` : ''}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onConfirm={async () => { if (deleteTarget) await remove(deleteTarget); }}
      />
    </>
  );
}

function CategoryIconUploader({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const upload = async (file: File) => {
    setBusy(true);
    setErr(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('category', 'categories');
      const res = await fetch('/api/admin/uploads', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message ?? data?.code ?? 'Upload failed');
      onChange(data.url as string);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <FormField label="Icon image (optional)" hint="PNG, SVG or WebP. Up to 1 MB. The public site uses this image first, then falls back to the icon key.">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-stretch">
        <div className="flex h-[88px] w-full items-center justify-center rounded-xl border border-neon/15 bg-base-deep/40 sm:w-[100px]">
          {value ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={value} alt="" className="h-14 w-14 object-contain" />
          ) : (
            <p className="text-[11px] text-ink-lo">No image</p>
          )}
        </div>
        <div className="flex flex-1 flex-col gap-2">
          <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder="/uploads/categories/..." />
          <div className="flex flex-wrap gap-2">
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) upload(f);
              }}
            />
            <Button size="sm" type="button" variant="neon" leftIcon={<Upload className="h-3.5 w-3.5" />} loading={busy} onClick={() => fileRef.current?.click()}>
              {value ? 'Replace' : 'Upload'}
            </Button>
            {value ? (
              <Button size="sm" type="button" variant="danger" leftIcon={<Trash2 className="h-3.5 w-3.5" />} onClick={() => onChange('')}>
                Remove
              </Button>
            ) : null}
          </div>
          {err ? <p className="text-xs text-signal-danger">{err}</p> : null}
        </div>
      </div>
    </FormField>
  );
}
