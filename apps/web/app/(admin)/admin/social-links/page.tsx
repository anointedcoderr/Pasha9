// Built by Anointed Coder.
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
import { Share2, Plus, Pencil, Trash2, ArrowUp, ArrowDown } from 'lucide-react';

interface LinkRow {
  id: string;
  platform: string;
  label: string;
  labelBn: string | null;
  url: string;
  iconUrl: string | null;
  sortOrder: number;
  isActive: boolean;
}

const PLATFORMS: Array<{ value: string; label: string }> = [
  { value: 'telegram', label: 'Telegram' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'facebook', label: 'Facebook' },
  { value: 'youtube', label: 'YouTube' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'twitter', label: 'X / Twitter' },
  { value: 'tiktok', label: 'TikTok' },
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'discord', label: 'Discord' },
  { value: 'snapchat', label: 'Snapchat' },
  { value: 'pinterest', label: 'Pinterest' },
  { value: 'email', label: 'Email' },
  { value: 'custom', label: 'Custom' },
];

const NEW_LINK: LinkRow = {
  id: '',
  platform: 'telegram',
  label: 'Telegram',
  labelBn: '',
  url: '',
  iconUrl: '',
  sortOrder: 0,
  isActive: true,
};

export default function AdminSocialLinksPage() {
  const [links, setLinks] = useState<LinkRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editor, setEditor] = useState<LinkRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  // In-page confirm dialog instead of native confirm(), which
  // installed PWAs suppress silently.
  const [deleteTarget, setDeleteTarget] = useState<LinkRow | null>(null);

  const notify = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  };

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch('/api/admin/social-links', { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? data.code ?? 'Failed');
      setLinks(data.links ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load social links');
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
    setError(null);
    const isNew = !editor.id;
    const payload = {
      platform: editor.platform,
      label: editor.label,
      labelBn: editor.labelBn || null,
      url: editor.url,
      iconUrl: editor.iconUrl || null,
      sortOrder: editor.sortOrder,
      isActive: editor.isActive,
    };
    try {
      const res = isNew
        ? await fetch('/api/admin/social-links', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(payload),
          })
        : await fetch(`/api/admin/social-links/${editor.id}`, {
            method: 'PATCH',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(payload),
          });
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

  const remove = async (b: LinkRow) => {
    try {
      const res = await fetch(`/api/admin/social-links/${b.id}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        notify('Social link deleted. সোশ্যাল লিংক মুছে ফেলা হয়েছে।');
        refresh();
      } else {
        setError(`${data?.message ?? data?.code ?? 'Delete failed'} (Delete failed. ডিলিট ব্যর্থ হয়েছে।)`);
      }
    } catch {
      setError('Delete failed: network error. ডিলিট ব্যর্থ হয়েছে: নেটওয়ার্ক সমস্যা।');
    }
  };

  const toggle = async (b: LinkRow) => {
    try {
      const res = await fetch(`/api/admin/social-links/${b.id}`, {
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

  const move = async (b: LinkRow, dir: -1 | 1) => {
    const idx = links.findIndex((x) => x.id === b.id);
    if (idx < 0) return;
    const swapIdx = idx + dir;
    if (swapIdx < 0 || swapIdx >= links.length) return;
    const ids = links.map((x) => x.id);
    [ids[idx], ids[swapIdx]] = [ids[swapIdx], ids[idx]];
    try {
      const res = await fetch('/api/admin/social-links', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ids }),
      });
      if (!res.ok) {
        setError('Failed to reorder link. লিংকের ক্রম পরিবর্তন ব্যর্থ হয়েছে।');
        return;
      }
      refresh();
    } catch {
      setError('Failed to reorder link: network error. ক্রম পরিবর্তন ব্যর্থ হয়েছে: নেটওয়ার্ক সমস্যা।');
    }
  };

  return (
    <>
      <PageHeader
        title="Social Links"
        subtitle="Platforms and contact buttons shown in the public footer"
        icon={<Share2 className="h-5 w-5" />}
        action={
          <Button
            leftIcon={<Plus className="h-4 w-4" />}
            onClick={() => setEditor({ ...NEW_LINK, sortOrder: (links.length + 1) * 10 })}
          >
            New Link
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
        ) : links.length === 0 ? (
          <Card padding="lg">
            <EmptyState
              title="No social links yet"
              description="When empty, the footer falls back to the legacy Telegram, WhatsApp and email contact entries from System Settings. Add a row here to take over the social rail."
            />
          </Card>
        ) : (
          links.map((b, idx) => (
            <Card key={b.id} padding="lg" className="flex flex-col gap-4 md:flex-row md:items-center">
              <div className="relative h-12 w-12 overflow-hidden rounded-lg border border-brand-divider bg-base-deep md:shrink-0">
                {b.iconUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={b.iconUrl} alt="" className="h-full w-full object-contain p-1" />
                ) : (
                  <div className="flex h-full items-center justify-center text-[10px] uppercase tracking-wider text-ink-lo">
                    {b.platform.slice(0, 3)}
                  </div>
                )}
              </div>
              <div className="flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold text-ink-hi">{b.label}</p>
                  <Chip tone="neutral">{b.platform}</Chip>
                  <Chip tone={b.isActive ? 'ok' : 'neutral'}>{b.isActive ? 'active' : 'hidden'}</Chip>
                  <span className="text-[11px] text-ink-lo">sort {b.sortOrder}</span>
                </div>
                {b.labelBn ? <p className="text-sm text-ink-mid">{b.labelBn}</p> : null}
                <p className="break-all text-[11px] text-ink-lo">{b.url}</p>
              </div>
              <div className="flex flex-row items-center gap-2 md:flex-col">
                <Button size="icon" variant="ghost" disabled={idx === 0} onClick={() => move(b, -1)}>
                  <ArrowUp className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="ghost" disabled={idx === links.length - 1} onClick={() => move(b, 1)}>
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
        onOpenChange={(v) => !v && setEditor(null)}
        title={editor?.id ? 'Edit Link' : 'New Link'}
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
              <FormField label="Platform" required>
                <Select
                  value={editor.platform}
                  onChange={(e) => setEditor({ ...editor, platform: e.target.value })}
                >
                  {PLATFORMS.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                </Select>
              </FormField>
              <FormField label="Sort order">
                <Input
                  type="number"
                  value={editor.sortOrder}
                  onChange={(e) => setEditor({ ...editor, sortOrder: Number(e.target.value) })}
                />
              </FormField>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <FormField label="Label (English)" required>
                <Input value={editor.label} onChange={(e) => setEditor({ ...editor, label: e.target.value })} />
              </FormField>
              <FormField label="Label (Bangla)">
                <Input
                  value={editor.labelBn ?? ''}
                  onChange={(e) => setEditor({ ...editor, labelBn: e.target.value })}
                />
              </FormField>
            </div>
            <FormField label="URL" required hint="Use mailto: for email or wa.me/<phone> for WhatsApp.">
              <Input
                value={editor.url}
                onChange={(e) => setEditor({ ...editor, url: e.target.value })}
                placeholder="https://t.me/pasha9"
              />
            </FormField>
            <AdminMediaUpload
              label="Custom icon"
              hint="Optional. Falls back to the platform default when empty."
              value={editor.iconUrl}
              category="branding"
              constraintHint="SVG / PNG, square, max 1 MB"
              onChange={(url) => setEditor({ ...editor, iconUrl: url ?? '' })}
            />
            <label className="flex items-center gap-2 text-sm text-ink-mid">
              <Switch checked={editor.isActive} onChange={(v) => setEditor({ ...editor, isActive: Boolean(v) })} />
              Active
            </label>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" type="button" onClick={() => setEditor(null)}>
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
        title="Delete social link"
        message={deleteTarget ? `Delete link "${deleteTarget.label}"? This cannot be undone.` : ''}
        messageBn={deleteTarget ? `"${deleteTarget.labelBn || deleteTarget.label}" লিংকটি মুছে ফেলবেন? এটি আর ফেরানো যাবে না।` : ''}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onConfirm={async () => { if (deleteTarget) await remove(deleteTarget); }}
      />
    </>
  );
}
