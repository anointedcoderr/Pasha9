'use client';

import { useState } from 'react';
import { PageHeader } from '@/components/site/PageHeader';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { FormField, Input, Textarea } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Modal } from '@/components/ui/Modal';
import { Switch } from '@/components/ui/Switch';
import { mockBanners } from '@/lib/mock/banners';
import { Image as ImageIcon, Plus, Pencil, Trash2, ArrowUp, ArrowDown } from 'lucide-react';
import { Chip } from '@/components/ui/Chip';
import type { Banner } from '@/types';

export default function AdminBannersPage() {
  const [banners, setBanners] = useState(mockBanners);
  const [editor, setEditor] = useState<Banner | null>(null);

  const reorder = (id: string, dir: -1 | 1) => {
    setBanners((list) => {
      const idx = list.findIndex((b) => b.id === id);
      if (idx < 0) return list;
      const swap = idx + dir;
      if (swap < 0 || swap >= list.length) return list;
      const next = [...list];
      [next[idx], next[swap]] = [next[swap], next[idx]];
      return next;
    });
  };

  return (
    <>
      <PageHeader
        title="Banners and Sliders"
        subtitle="Hero slider content for the homepage"
        icon={<ImageIcon className="h-5 w-5" />}
        action={<Button leftIcon={<Plus className="h-4 w-4" />} onClick={() => setEditor({ id: 'new', title: '', subtitle: '', ctaLabel: '', ctaHref: '', accent: 'gold', position: banners.length + 1, status: 'active' })}>New Banner</Button>}
      />

      <div className="space-y-4">
        {banners.map((b) => (
          <Card key={b.id} padding="lg" className="flex flex-col gap-4 md:flex-row md:items-center">
            <BannerPreview accent={b.accent} title={b.title} subtitle={b.subtitle} ctaLabel={b.ctaLabel} />
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold text-ink-hi">{b.title}</p>
                <Chip tone={b.status === 'active' ? 'ok' : 'neutral'}>{b.status}</Chip>
              </div>
              <p className="text-sm text-ink-mid">{b.subtitle}</p>
              <p className="text-xs text-ink-lo">CTA: {b.ctaLabel} → {b.ctaHref}</p>
            </div>
            <div className="flex flex-row items-center gap-2 md:flex-col">
              <Button size="icon" variant="ghost" onClick={() => reorder(b.id, -1)}><ArrowUp className="h-4 w-4" /></Button>
              <Button size="icon" variant="ghost" onClick={() => reorder(b.id, 1)}><ArrowDown className="h-4 w-4" /></Button>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={b.status === 'active'} onChange={() => setBanners((list) => list.map((x) => x.id === b.id ? { ...x, status: x.status === 'active' ? 'hidden' : 'active' } : x))} />
              <Button size="sm" variant="neon" leftIcon={<Pencil className="h-3.5 w-3.5" />} onClick={() => setEditor(b)}>Edit</Button>
              <Button size="sm" variant="danger" leftIcon={<Trash2 className="h-3.5 w-3.5" />}>Delete</Button>
            </div>
          </Card>
        ))}
      </div>

      <Modal open={!!editor} onOpenChange={(v) => !v && setEditor(null)} title={editor?.id === 'new' ? 'New Banner' : 'Edit Banner'} size="lg">
        {editor ? (
          <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); setEditor(null); }}>
            <FormField label="Title" required>
              <Input defaultValue={editor.title} />
            </FormField>
            <FormField label="Subtitle">
              <Textarea defaultValue={editor.subtitle} rows={2} />
            </FormField>
            <div className="grid gap-3 md:grid-cols-2">
              <FormField label="CTA Label">
                <Input defaultValue={editor.ctaLabel} />
              </FormField>
              <FormField label="CTA Href">
                <Input defaultValue={editor.ctaHref} placeholder="/promotions" />
              </FormField>
              <FormField label="Accent">
                <Select defaultValue={editor.accent}>
                  <option value="gold">Gold</option>
                  <option value="neon">Neon</option>
                  <option value="mixed">Mixed</option>
                </Select>
              </FormField>
              <FormField label="Position">
                <Input type="number" defaultValue={editor.position} />
              </FormField>
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

function BannerPreview({ accent, title, subtitle, ctaLabel }: { accent: Banner['accent']; title: string; subtitle: string; ctaLabel: string }) {
  const accentMap = {
    gold: 'from-gold-300/30 to-gold-700/10 border-gold-500/40',
    neon: 'from-neon/30 to-emerald-700/10 border-neon/40',
    mixed: 'from-gold-300/20 via-neon/20 to-transparent border-neon/30',
  } as const;
  return (
    <div className={`relative w-full max-w-[260px] overflow-hidden rounded-xl border bg-gradient-to-br ${accentMap[accent]} p-3 md:shrink-0`}>
      <p className="text-xs font-semibold text-ink-hi line-clamp-2">{title}</p>
      <p className="mt-1 text-[10px] text-ink-mid line-clamp-2">{subtitle}</p>
      <span className="mt-2 inline-block rounded-md bg-base-deep/60 px-2 py-0.5 text-[10px] text-gold-300">{ctaLabel}</span>
    </div>
  );
}
