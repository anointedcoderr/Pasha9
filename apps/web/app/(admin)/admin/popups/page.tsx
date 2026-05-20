'use client';

import { useState } from 'react';
import { PageHeader } from '@/components/site/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Switch } from '@/components/ui/Switch';
import { FormField, Input, Textarea } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { mockPopups } from '@/lib/mock/banners';
import { Megaphone, Plus, Pencil, Trash2 } from 'lucide-react';
import { Chip } from '@/components/ui/Chip';
import { formatDateTime } from '@/lib/utils/format';
import { useLang } from '@/lib/i18n/context';
import type { PopupAnnouncement } from '@/types';

export default function AdminPopupsPage() {
  const { lang } = useLang();
  const [items, setItems] = useState(mockPopups);
  const [editor, setEditor] = useState<PopupAnnouncement | null>(null);

  return (
    <>
      <PageHeader
        title="Popup Announcements"
        subtitle="Surfaces a modal to site visitors during the active window"
        icon={<Megaphone className="h-5 w-5" />}
        action={<Button leftIcon={<Plus className="h-4 w-4" />} onClick={() => setEditor({ id: 'new', title: '', body: '', startAt: new Date().toISOString(), endAt: new Date(Date.now() + 86400000 * 7).toISOString(), status: 'active' })}>New Popup</Button>}
      />

      <div className="grid gap-4 md:grid-cols-2">
        {items.map((p) => (
          <Card key={p.id} padding="lg">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold text-ink-hi">{p.title}</h3>
                <p className="mt-1 text-sm text-ink-mid line-clamp-3">{p.body}</p>
              </div>
              <Chip tone={p.status === 'active' ? 'ok' : 'neutral'}>{p.status}</Chip>
            </div>
            <p className="mt-3 text-xs text-ink-lo">
              {formatDateTime(p.startAt, lang)} → {formatDateTime(p.endAt, lang)}
            </p>
            <div className="mt-4 flex items-center gap-2">
              <Switch checked={p.status === 'active'} onChange={() => setItems((list) => list.map((x) => x.id === p.id ? { ...x, status: x.status === 'active' ? 'hidden' : 'active' } : x))} />
              <Button size="sm" variant="neon" leftIcon={<Pencil className="h-3.5 w-3.5" />} onClick={() => setEditor(p)}>Edit</Button>
              <Button size="sm" variant="danger" leftIcon={<Trash2 className="h-3.5 w-3.5" />}>Delete</Button>
            </div>
          </Card>
        ))}
      </div>

      <Modal open={!!editor} onOpenChange={(v) => !v && setEditor(null)} title={editor?.id === 'new' ? 'New Popup' : 'Edit Popup'} size="lg">
        {editor ? (
          <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); setEditor(null); }}>
            <FormField label="Title" required><Input defaultValue={editor.title} /></FormField>
            <FormField label="Body" required><Textarea rows={4} defaultValue={editor.body} /></FormField>
            <div className="grid gap-3 md:grid-cols-2">
              <FormField label="CTA Label"><Input defaultValue={editor.ctaLabel} /></FormField>
              <FormField label="CTA Href"><Input defaultValue={editor.ctaHref} /></FormField>
              <FormField label="Starts at"><Input type="datetime-local" defaultValue={editor.startAt.slice(0, 16)} /></FormField>
              <FormField label="Ends at"><Input type="datetime-local" defaultValue={editor.endAt.slice(0, 16)} /></FormField>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" type="button" onClick={() => setEditor(null)}>Cancel</Button>
              <Button type="submit">Save</Button>
            </div>
          </form>
        ) : null}
      </Modal>
    </>
  );
}
