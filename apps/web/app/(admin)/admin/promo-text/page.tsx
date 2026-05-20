'use client';

import { useState } from 'react';
import { PageHeader } from '@/components/site/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { FormField, Input } from '@/components/ui/Input';
import { Switch } from '@/components/ui/Switch';
import { mockPromoTexts } from '@/lib/mock/banners';
import { Type, Plus, ArrowUp, ArrowDown, Trash2 } from 'lucide-react';

export default function AdminPromoTextPage() {
  const [items, setItems] = useState(mockPromoTexts);
  const [draft, setDraft] = useState('');

  const addNew = () => {
    if (!draft) return;
    setItems((list) => [...list, { id: `pt_${list.length + 1}`, message: draft, status: 'active', position: list.length + 1 }]);
    setDraft('');
  };

  return (
    <>
      <PageHeader title="Promo Text" subtitle="Scrolling marquee shown above the homepage sections" icon={<Type className="h-5 w-5" />} />

      <Card padding="lg" className="mb-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-end">
          <FormField label="New message" hint="Bangla or English, emoji friendly">
            <Input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="🎁 New welcome bonus is live" />
          </FormField>
          <Button onClick={addNew} leftIcon={<Plus className="h-4 w-4" />}>Add</Button>
        </div>
      </Card>

      <Card padding="none" className="overflow-hidden">
        <ul className="divide-y divide-neon/10">
          {items.map((it, idx) => (
            <li key={it.id} className="flex items-center gap-3 p-4">
              <span className="text-xs text-ink-lo">{idx + 1}</span>
              <p className="flex-1 text-sm text-ink-hi">{it.message}</p>
              <Switch checked={it.status === 'active'} onChange={() => setItems((list) => list.map((x) => x.id === it.id ? { ...x, status: x.status === 'active' ? 'hidden' : 'active' } : x))} />
              <Button size="icon" variant="ghost"><ArrowUp className="h-4 w-4" /></Button>
              <Button size="icon" variant="ghost"><ArrowDown className="h-4 w-4" /></Button>
              <Button size="sm" variant="danger" leftIcon={<Trash2 className="h-3.5 w-3.5" />}>Delete</Button>
            </li>
          ))}
        </ul>
      </Card>
    </>
  );
}
