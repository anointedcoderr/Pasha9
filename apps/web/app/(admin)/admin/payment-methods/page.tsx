// Built by Anointed Coder.
//
// Payment Methods CRUD. Each row carries: deposit on/off, payout
// on/off, per-method min/max for deposit + withdrawal, account
// number / instruction copy. /deposit and /withdraw forms consume
// /api/content/payment-methods to pick which methods to render.

'use client';

import { useCallback, useEffect, useState } from 'react';
import { PageHeader } from '@/components/site/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { FormField, Input, Textarea } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Modal } from '@/components/ui/Modal';
import { Chip } from '@/components/ui/Chip';
import { Switch } from '@/components/ui/Switch';
import { Banknote, Plus, Pencil, Trash2, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

type Status = 'active' | 'hidden' | 'paused';
type MethodType = 'mobile' | 'bank' | 'crypto';

interface MethodRow {
  id: string;
  name: string;
  type: MethodType;
  status: Status;
  number: string;
  instruction: string;
  instructionBn: string | null;
  payoutInstruction: string | null;
  payoutInstructionBn: string | null;
  iconUrl: string | null;
  bannerUrl: string | null;
  position: number;
  depositEnabled: boolean;
  payoutEnabled: boolean;
  minDeposit: number | null;
  maxDeposit: number | null;
  minWithdrawal: number | null;
  maxWithdrawal: number | null;
}

const BLANK: MethodRow = {
  id: '',
  name: '',
  type: 'mobile',
  status: 'active',
  number: '',
  instruction: '',
  instructionBn: '',
  payoutInstruction: '',
  payoutInstructionBn: '',
  iconUrl: '',
  bannerUrl: '',
  position: 0,
  depositEnabled: true,
  payoutEnabled: false,
  minDeposit: null,
  maxDeposit: null,
  minWithdrawal: null,
  maxWithdrawal: null,
};

export default function AdminPaymentMethodsPage() {
  const [items, setItems] = useState<MethodRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editor, setEditor] = useState<MethodRow | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    setError(null);
    setRefreshing(true);
    try {
      const res = await fetch('/api/admin/payment-methods', { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message ?? data?.code ?? 'Failed');
      setItems(data.methods as MethodRow[]);
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
    const payload = {
      name: editor.name,
      type: editor.type,
      status: editor.status,
      number: editor.number,
      instruction: editor.instruction,
      instructionBn: editor.instructionBn || undefined,
      payoutInstruction: editor.payoutInstruction || undefined,
      payoutInstructionBn: editor.payoutInstructionBn || undefined,
      iconUrl: editor.iconUrl || undefined,
      bannerUrl: editor.bannerUrl || undefined,
      position: Number(editor.position) || 0,
      depositEnabled: editor.depositEnabled,
      payoutEnabled: editor.payoutEnabled,
      minDeposit: editor.minDeposit,
      maxDeposit: editor.maxDeposit,
      minWithdrawal: editor.minWithdrawal,
      maxWithdrawal: editor.maxWithdrawal,
    };
    try {
      const res = editor.id
        ? await fetch(`/api/admin/payment-methods/${editor.id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) })
        : await fetch('/api/admin/payment-methods', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
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

  const remove = async (id: string) => {
    if (!confirm('Delete this payment method? Pending deposit/withdrawal rows referencing it stay intact.')) return;
    const res = await fetch(`/api/admin/payment-methods/${id}`, { method: 'DELETE' });
    if (res.ok) refresh();
  };

  return (
    <>
      <PageHeader
        title="Payment Methods"
        subtitle={loading ? 'Loading...' : `${items.length} methods, ${items.filter((m) => m.depositEnabled && m.status === 'active').length} deposit, ${items.filter((m) => m.payoutEnabled && m.status === 'active').length} payout`}
        icon={<Banknote className="h-5 w-5" />}
        action={
          <div className="flex items-center gap-2">
            <Button variant="ghost" leftIcon={<RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} />} onClick={refresh}>
              Refresh
            </Button>
            <Button leftIcon={<Plus className="h-4 w-4" />} onClick={() => setEditor({ ...BLANK, position: items.length + 1 })}>
              New Method
            </Button>
          </div>
        }
      />

      {error ? <Card padding="md" className="mb-4"><p className="text-sm text-signal-danger">{error}</p></Card> : null}

      {loading ? (
        <Card padding="lg">Loading...</Card>
      ) : items.length === 0 ? (
        <Card padding="lg"><p className="text-sm text-ink-mid">No methods yet. Create one to populate the public deposit / withdraw forms.</p></Card>
      ) : (
        <div className="space-y-3">
          {items.map((m) => (
            <Card key={m.id} padding="lg" className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-base font-extrabold text-ink-hi">{m.name}</p>
                  <Chip tone={m.status === 'active' ? 'ok' : 'neutral'}>{m.status}</Chip>
                  <Chip tone="info">{m.type}</Chip>
                  {m.depositEnabled ? <Chip tone="ok">deposit</Chip> : <Chip>deposit off</Chip>}
                  {m.payoutEnabled ? <Chip tone="ok">payout</Chip> : <Chip>payout off</Chip>}
                  <span className="text-[11px] text-ink-lo">pos {m.position}</span>
                </div>
                <p className="mt-1 font-mono text-xs text-ink-mid">{m.number}</p>
                <p className="mt-1 text-xs text-ink-mid">{m.instruction}</p>
                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-ink-lo">
                  {m.depositEnabled ? <span>Deposit: {m.minDeposit ?? 0} - {m.maxDeposit ?? '-'} BDT</span> : null}
                  {m.payoutEnabled ? <span>Withdrawal: {m.minWithdrawal ?? 0} - {m.maxWithdrawal ?? '-'} BDT</span> : null}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="neon" leftIcon={<Pencil className="h-3.5 w-3.5" />} onClick={() => setEditor({ ...m, payoutInstruction: m.payoutInstruction ?? '', instructionBn: m.instructionBn ?? '', payoutInstructionBn: m.payoutInstructionBn ?? '', iconUrl: m.iconUrl ?? '', bannerUrl: m.bannerUrl ?? '' })}>Edit</Button>
                <Button size="sm" variant="danger" leftIcon={<Trash2 className="h-3.5 w-3.5" />} onClick={() => remove(m.id)}>Delete</Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal open={!!editor} onOpenChange={(v) => !v && setEditor(null)} title={editor?.id ? 'Edit Payment Method' : 'New Payment Method'} size="lg">
        {editor ? (
          <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); void save(); }}>
            <div className="grid gap-3 md:grid-cols-2">
              <FormField label="Name" required><Input value={editor.name} onChange={(e) => setEditor({ ...editor, name: e.target.value })} placeholder="bKash" /></FormField>
              <FormField label="Type">
                <Select value={editor.type} onChange={(e) => setEditor({ ...editor, type: e.target.value as MethodType })}>
                  <option value="mobile">Mobile</option>
                  <option value="bank">Bank</option>
                  <option value="crypto">Crypto</option>
                </Select>
              </FormField>
              <FormField label="Account / Number" required><Input value={editor.number} onChange={(e) => setEditor({ ...editor, number: e.target.value })} placeholder="01700000001" /></FormField>
              <FormField label="Status">
                <Select value={editor.status} onChange={(e) => setEditor({ ...editor, status: e.target.value as Status })}>
                  <option value="active">Active</option>
                  <option value="hidden">Hidden</option>
                  <option value="paused">Paused</option>
                </Select>
              </FormField>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <FormField label="Icon URL (square logo, ~64px)" hint="Shown on the public /deposit + /withdraw method tiles."><Input value={editor.iconUrl ?? ''} onChange={(e) => setEditor({ ...editor, iconUrl: e.target.value })} placeholder="https://..." /></FormField>
              <FormField label="Banner URL (wide, ~1200x300)" hint="Shown on the selected-method detail panel header."><Input value={editor.bannerUrl ?? ''} onChange={(e) => setEditor({ ...editor, bannerUrl: e.target.value })} placeholder="https://..." /></FormField>
            </div>
            <FormField label="Deposit instructions (EN)" required><Textarea rows={2} value={editor.instruction} onChange={(e) => setEditor({ ...editor, instruction: e.target.value })} /></FormField>
            <FormField label="Deposit instructions (BN, optional)"><Textarea rows={2} value={editor.instructionBn ?? ''} onChange={(e) => setEditor({ ...editor, instructionBn: e.target.value })} /></FormField>
            <FormField label="Payout instructions (EN, optional)" hint="Shown to admin when paying the user out of band."><Textarea rows={2} value={editor.payoutInstruction ?? ''} onChange={(e) => setEditor({ ...editor, payoutInstruction: e.target.value })} /></FormField>
            <FormField label="Payout instructions (BN, optional)"><Textarea rows={2} value={editor.payoutInstructionBn ?? ''} onChange={(e) => setEditor({ ...editor, payoutInstructionBn: e.target.value })} /></FormField>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-xl border border-neon/10 bg-base-deep/40 p-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-ink-hi">Deposit channel</p>
                  <Switch checked={editor.depositEnabled} onChange={(v) => setEditor({ ...editor, depositEnabled: v })} />
                </div>
                <div className="mt-3 grid gap-2 md:grid-cols-2">
                  <FormField label="Min (BDT)"><Input type="number" min="0" value={editor.minDeposit ?? ''} onChange={(e) => setEditor({ ...editor, minDeposit: e.target.value === '' ? null : Number(e.target.value) })} placeholder="100" /></FormField>
                  <FormField label="Max (BDT)"><Input type="number" min="0" value={editor.maxDeposit ?? ''} onChange={(e) => setEditor({ ...editor, maxDeposit: e.target.value === '' ? null : Number(e.target.value) })} placeholder="500000" /></FormField>
                </div>
              </div>
              <div className="rounded-xl border border-neon/10 bg-base-deep/40 p-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-ink-hi">Payout channel</p>
                  <Switch checked={editor.payoutEnabled} onChange={(v) => setEditor({ ...editor, payoutEnabled: v })} />
                </div>
                <div className="mt-3 grid gap-2 md:grid-cols-2">
                  <FormField label="Min (BDT)"><Input type="number" min="0" value={editor.minWithdrawal ?? ''} onChange={(e) => setEditor({ ...editor, minWithdrawal: e.target.value === '' ? null : Number(e.target.value) })} placeholder="500" /></FormField>
                  <FormField label="Max (BDT)"><Input type="number" min="0" value={editor.maxWithdrawal ?? ''} onChange={(e) => setEditor({ ...editor, maxWithdrawal: e.target.value === '' ? null : Number(e.target.value) })} placeholder="200000" /></FormField>
                </div>
              </div>
            </div>

            <FormField label="Position"><Input type="number" min="0" value={String(editor.position)} onChange={(e) => setEditor({ ...editor, position: Number(e.target.value) || 0 })} /></FormField>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" type="button" onClick={() => setEditor(null)}>Cancel</Button>
              <Button type="submit" loading={busy}>Save</Button>
            </div>
          </form>
        ) : null}
      </Modal>
    </>
  );
}
