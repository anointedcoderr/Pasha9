'use client';

import { useState } from 'react';
import { PageHeader } from '@/components/site/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { FormField, Input, PasswordInput, Textarea } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Switch } from '@/components/ui/Switch';
import { Chip } from '@/components/ui/Chip';
import { mockProviders } from '@/lib/mock/categories';
import { mockGames } from '@/lib/mock/games';
import { Boxes, Plus, Pencil, KeyRound, Trash2 } from 'lucide-react';
import type { GameProvider } from '@/types';

export default function AdminProvidersPage() {
  const [providers, setProviders] = useState(mockProviders);
  const [editor, setEditor] = useState<GameProvider | null>(null);
  const [secrets, setSecrets] = useState<GameProvider | null>(null);

  return (
    <>
      <PageHeader
        title="Game Providers"
        subtitle="Manage provider connections and API keys"
        icon={<Boxes className="h-5 w-5" />}
        action={<Button leftIcon={<Plus className="h-4 w-4" />} onClick={() => setEditor({ id: 'new', name: '', status: 'active' })}>New Provider</Button>}
      />

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {providers.map((p) => {
          const count = mockGames.filter((g) => g.providerId === p.id).length;
          return (
            <Card key={p.id} padding="md">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-semibold text-ink-hi">{p.name}</p>
                  <p className="mt-0.5 text-xs text-ink-lo">{count} games</p>
                </div>
                <Chip tone={p.status === 'active' ? 'ok' : 'warn'}>{p.status}</Chip>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <Switch
                  checked={p.status === 'active'}
                  onChange={() => setProviders((list) => list.map((x) => x.id === p.id ? { ...x, status: x.status === 'active' ? 'maintenance' : 'active' } : x))}
                />
                <Button size="sm" variant="neon" leftIcon={<Pencil className="h-3.5 w-3.5" />} onClick={() => setEditor(p)}>Edit</Button>
                <Button size="sm" variant="ghost" leftIcon={<KeyRound className="h-3.5 w-3.5" />} onClick={() => setSecrets(p)}>API Keys</Button>
                <Button size="sm" variant="danger" leftIcon={<Trash2 className="h-3.5 w-3.5" />}>Delete</Button>
              </div>
            </Card>
          );
        })}
      </div>

      <Modal open={!!editor} onOpenChange={(v) => !v && setEditor(null)} title={editor?.id === 'new' ? 'New Provider' : 'Edit Provider'} size="md">
        {editor ? (
          <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); setEditor(null); }}>
            <FormField label="Provider name"><Input defaultValue={editor.name} /></FormField>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" type="button" onClick={() => setEditor(null)}>Cancel</Button>
              <Button type="submit">Save</Button>
            </div>
          </form>
        ) : null}
      </Modal>

      <Modal open={!!secrets} onOpenChange={(v) => !v && setSecrets(null)} title={`API keys: ${secrets?.name ?? ''}`} description="Configuration placeholder. Real keys are added in Milestone 3." size="md">
        {secrets ? (
          <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); setSecrets(null); }}>
            <FormField label="Base URL"><Input placeholder="https://api.provider.com/v1" /></FormField>
            <FormField label="Public key"><Input placeholder="pk_xxxx" /></FormField>
            <FormField label="Secret key"><PasswordInput placeholder="sk_xxxx" showLabel="Show secret" hideLabel="Hide secret" /></FormField>
            <FormField label="Notes"><Textarea rows={3} placeholder="Integration notes" /></FormField>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" type="button" onClick={() => setSecrets(null)}>Cancel</Button>
              <Button type="submit">Save Keys</Button>
            </div>
          </form>
        ) : null}
      </Modal>
    </>
  );
}
