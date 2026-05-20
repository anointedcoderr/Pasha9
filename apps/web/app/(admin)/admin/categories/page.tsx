'use client';

import { useState } from 'react';
import { PageHeader } from '@/components/site/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { FormField, Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { mockCategories } from '@/lib/mock/categories';
import { Layers, Plus, Pencil, Trash2 } from 'lucide-react';
import { Chip } from '@/components/ui/Chip';
import { Switch } from '@/components/ui/Switch';
import type { GameCategory } from '@/types';

export default function AdminCategoriesPage() {
  const [items, setItems] = useState(mockCategories);
  const [editor, setEditor] = useState<GameCategory | null>(null);

  return (
    <>
      <PageHeader
        title="Game Categories"
        subtitle="Top level groupings shown across the site"
        icon={<Layers className="h-5 w-5" />}
        action={<Button leftIcon={<Plus className="h-4 w-4" />} onClick={() => setEditor({ id: 'new', slug: '', nameBn: '', nameEn: '', iconKey: 'flame', status: 'active' })}>New Category</Button>}
      />

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {items.map((c) => (
          <Card key={c.id} padding="md">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-ink-hi">{c.nameEn}</p>
                <p className="mt-0.5 text-xs text-ink-lo">{c.nameBn} · /games/{c.slug}</p>
              </div>
              <Chip tone={c.status === 'active' ? 'ok' : 'neutral'}>{c.status}</Chip>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <Switch checked={c.status === 'active'} onChange={() => setItems((list) => list.map((x) => x.id === c.id ? { ...x, status: x.status === 'active' ? 'hidden' : 'active' } : x))} />
              <Button size="sm" variant="neon" leftIcon={<Pencil className="h-3.5 w-3.5" />} onClick={() => setEditor(c)}>Edit</Button>
              <Button size="sm" variant="danger" leftIcon={<Trash2 className="h-3.5 w-3.5" />}>Delete</Button>
            </div>
          </Card>
        ))}
      </div>

      <Modal open={!!editor} onOpenChange={(v) => !v && setEditor(null)} title={editor?.id === 'new' ? 'New Category' : 'Edit Category'} size="md">
        {editor ? (
          <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); setEditor(null); }}>
            <FormField label="Slug"><Input defaultValue={editor.slug} placeholder="slots" /></FormField>
            <FormField label="Name (English)"><Input defaultValue={editor.nameEn} /></FormField>
            <FormField label="Name (Bangla)"><Input defaultValue={editor.nameBn} /></FormField>
            <FormField label="Icon key"><Input defaultValue={editor.iconKey} /></FormField>
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
