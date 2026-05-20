'use client';

import { useState } from 'react';
import { PageHeader } from '@/components/site/PageHeader';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { FormField, Input, Textarea } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Switch } from '@/components/ui/Switch';
import { Modal } from '@/components/ui/Modal';
import { mockBonusRules } from '@/lib/mock/bonuses';
import { Gift, Plus, Pencil } from 'lucide-react';
import { Chip } from '@/components/ui/Chip';
import { formatBDT } from '@/lib/utils/format';
import type { BonusRule } from '@/types';

export default function AdminBonusesPage() {
  const [items] = useState(mockBonusRules);
  const [editor, setEditor] = useState<BonusRule | null>(null);

  return (
    <>
      <PageHeader
        title="Bonus Management"
        subtitle="Configure rules, eligibility, and limits"
        icon={<Gift className="h-5 w-5" />}
        action={<Button leftIcon={<Plus className="h-4 w-4" />} onClick={() => setEditor({ id: 'new', name: '', type: 'daily', amount: 0, percentage: 0, minDeposit: 0, maxBonus: 0, status: 'active', description: '' })}>New Rule</Button>}
      />

      <div className="grid gap-4 md:grid-cols-2">
        {items.map((rule) => (
          <Card key={rule.id} padding="lg">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs uppercase tracking-wider text-gold-300">{rule.type.replace('_', ' ')}</p>
                <h3 className="mt-1 text-base font-semibold text-ink-hi">{rule.name}</h3>
                <p className="mt-1 text-sm text-ink-mid">{rule.description}</p>
              </div>
              <Chip tone={rule.status === 'active' ? 'ok' : 'warn'}>{rule.status}</Chip>
            </div>
            <dl className="mt-4 grid grid-cols-3 gap-2 text-xs">
              <Field label="Rate" value={rule.percentage > 0 ? `${rule.percentage}%` : formatBDT(rule.amount)} />
              <Field label="Min Dep" value={formatBDT(rule.minDeposit)} />
              <Field label="Max Bonus" value={rule.maxBonus ? formatBDT(rule.maxBonus) : 'None'} />
            </dl>
            <div className="mt-4 flex gap-2">
              <Button size="sm" variant="neon" leftIcon={<Pencil className="h-3.5 w-3.5" />} onClick={() => setEditor(rule)}>Edit</Button>
              <Switch checked={rule.status === 'active'} onChange={() => {}} label="Toggle" />
            </div>
          </Card>
        ))}
      </div>

      <Modal open={!!editor} onOpenChange={(v) => !v && setEditor(null)} title={editor?.id === 'new' ? 'New Bonus Rule' : 'Edit Bonus Rule'} size="lg">
        {editor ? (
          <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); setEditor(null); }}>
            <div className="grid gap-3 md:grid-cols-2">
              <FormField label="Name" required>
                <Input defaultValue={editor.name} placeholder="e.g., Weekend Reload Bonus" />
              </FormField>
              <FormField label="Type" required>
                <Select defaultValue={editor.type}>
                  {['first_deposit', 'daily', 'weekly', 'referral', 'vip', 'invite'].map((tp) => <option key={tp} value={tp}>{tp.replace('_', ' ')}</option>)}
                </Select>
              </FormField>
              <FormField label="Flat amount (BDT)">
                <Input type="number" defaultValue={editor.amount} />
              </FormField>
              <FormField label="Percentage">
                <Input type="number" defaultValue={editor.percentage} placeholder="0 - 100" />
              </FormField>
              <FormField label="Min deposit">
                <Input type="number" defaultValue={editor.minDeposit} />
              </FormField>
              <FormField label="Max bonus">
                <Input type="number" defaultValue={editor.maxBonus} />
              </FormField>
            </div>
            <FormField label="Description">
              <Textarea rows={3} defaultValue={editor.description} placeholder="Visible on promotion page" />
            </FormField>
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

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-neon/10 bg-base-deep/40 p-2.5">
      <dt className="text-[10px] uppercase tracking-wider text-ink-lo">{label}</dt>
      <dd className="mt-0.5 font-medium text-ink-hi">{value}</dd>
    </div>
  );
}
