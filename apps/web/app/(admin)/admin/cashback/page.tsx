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
import { TrendingUp, Plus, Pencil, Trash2, Play, AlertCircle, CheckCircle2 } from 'lucide-react';

interface CampaignRow {
  id: string;
  nameEn: string;
  nameBn: string | null;
  source: 'net_loss' | 'wager_amount';
  percentage: number;
  maxCashback: number;
  turnoverX: number;
  cadence: 'daily' | 'weekly' | 'monthly';
  startsAt: string | null;
  endsAt: string | null;
  isActive: boolean;
  bonusRuleId: string | null;
  payoutCount: number;
}

interface BonusRuleOption {
  id: string;
  name: string;
  type: string;
  turnoverX: number;
}

interface RunLine {
  userId: string;
  baseAmount: number;
  cashbackAmount: number;
  status: string;
  error?: string;
}

interface RunResult {
  periodKey: string;
  periodStart: string;
  periodEnd: string;
  eligibleUsers: number;
  paidUsers: number;
  totalCashback: number;
  lines: RunLine[];
}

const BLANK: CampaignRow = {
  id: '',
  nameEn: '',
  nameBn: '',
  source: 'net_loss',
  percentage: 10,
  maxCashback: 0,
  turnoverX: 0,
  cadence: 'weekly',
  startsAt: null,
  endsAt: null,
  isActive: true,
  bonusRuleId: null,
  payoutCount: 0,
};

function toLocalInput(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 16);
}

export default function AdminCashbackPage() {
  const [list, setList] = useState<CampaignRow[]>([]);
  const [rules, setRules] = useState<BonusRuleOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [editor, setEditor] = useState<CampaignRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [runResult, setRunResult] = useState<{ campaign: CampaignRow; result: RunResult } | null>(null);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const [campRes, rulesRes] = await Promise.all([
        fetch('/api/admin/cashback', { cache: 'no-store' }),
        fetch('/api/admin/bonus-rules', { cache: 'no-store' }),
      ]);
      const campData = await campRes.json();
      if (!campRes.ok) throw new Error(campData.message ?? campData.code ?? 'Failed');
      setList(campData.campaigns ?? []);
      if (rulesRes.ok) {
        const rulesData = await rulesRes.json();
        const all = Array.isArray(rulesData.rules) ? rulesData.rules : [];
        setRules(all.map((r: { id: string; name: string; type: string; turnoverX: number }) => ({ id: r.id, name: r.name, type: r.type, turnoverX: Number(r.turnoverX) })));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load campaigns');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const save = async () => {
    if (!editor) return;
    setBusy(true);
    setError(null);
    const payload = {
      nameEn: editor.nameEn,
      nameBn: editor.nameBn || null,
      source: editor.source,
      percentage: editor.percentage,
      maxCashback: editor.maxCashback,
      turnoverX: editor.turnoverX,
      cadence: editor.cadence,
      startsAt: editor.startsAt ? new Date(editor.startsAt).toISOString() : null,
      endsAt: editor.endsAt ? new Date(editor.endsAt).toISOString() : null,
      isActive: editor.isActive,
      bonusRuleId: editor.turnoverX > 0 ? editor.bonusRuleId : null,
    };
    try {
      const isNew = !editor.id;
      const res = isNew
        ? await fetch('/api/admin/cashback', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) })
        : await fetch(`/api/admin/cashback/${editor.id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
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

  const remove = async (id: string) => {
    if (!confirm('Delete this campaign? Only allowed when no payouts exist.')) return;
    const res = await fetch(`/api/admin/cashback/${id}`, { method: 'DELETE' });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) setError(data?.message ?? 'Delete failed');
    else refresh();
  };

  const toggleActive = async (c: CampaignRow) => {
    await fetch(`/api/admin/cashback/${c.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ isActive: !c.isActive }),
    });
    refresh();
  };

  const runNow = async (c: CampaignRow) => {
    if (!confirm(`Run cashback for "${c.nameEn}" now? Eligible players will be credited inside a single transaction each. Duplicate runs for the same period are blocked automatically.`)) return;
    setError(null);
    setToast(null);
    try {
      const res = await fetch(`/api/admin/cashback/${c.id}/run`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({}) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? data.code ?? 'Run failed');
      setRunResult({ campaign: c, result: data });
      setToast(`Paid ${data.paidUsers} of ${data.eligibleUsers} eligible users. Total ${Number(data.totalCashback).toLocaleString()} BDT.`);
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Run failed');
    }
  };

  return (
    <>
      <PageHeader
        title="Cashback Campaigns"
        subtitle="Periodic cashback over the player Transaction ledger. Credits run in a Prisma transaction with idempotency per (campaign, user, period)."
        icon={<TrendingUp className="h-5 w-5" />}
        action={<Button leftIcon={<Plus className="h-4 w-4" />} onClick={() => setEditor({ ...BLANK })}>New campaign</Button>}
      />

      {error ? <Card padding="md" className="mb-4"><p className="text-sm text-signal-danger"><AlertCircle className="mr-1 inline h-3.5 w-3.5" />{error}</p></Card> : null}
      {toast ? <Card padding="md" className="mb-4"><p className="text-sm text-emerald-700"><CheckCircle2 className="mr-1 inline h-3.5 w-3.5" />{toast}</p></Card> : null}

      {loading ? (
        <Card padding="lg">Loading...</Card>
      ) : list.length === 0 ? (
        <Card padding="lg">
          <EmptyState
            title="No cashback campaigns yet"
            description="Create one to credit a percentage of net loss or wager back to your players."
          />
        </Card>
      ) : (
        <div className="space-y-3">
          {list.map((c) => (
            <Card key={c.id} padding="lg" className="flex flex-col gap-4 md:flex-row md:items-center">
              <div className="flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold text-ink-hi">{c.nameEn}</p>
                  <Chip tone={c.isActive ? 'ok' : 'neutral'}>{c.isActive ? 'active' : 'hidden'}</Chip>
                  <Chip tone="info">{c.cadence}</Chip>
                  <Chip>{c.source.replace('_', ' ')}</Chip>
                  <span className="text-xs text-ink-lo">{c.payoutCount} payouts</span>
                </div>
                {c.nameBn ? <p className="text-sm text-ink-mid">{c.nameBn}</p> : null}
                <p className="text-[11px] text-ink-lo">
                  {c.percentage}% . Cap {c.maxCashback ? `${c.maxCashback.toLocaleString()} BDT` : 'unlimited'} . Turnover {c.turnoverX || 0}x
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={c.isActive} onChange={() => toggleActive(c)} />
                <Button size="sm" variant="ghost" leftIcon={<Play className="h-3.5 w-3.5" />} onClick={() => runNow(c)}>
                  Run now
                </Button>
                <Button size="sm" variant="neon" leftIcon={<Pencil className="h-3.5 w-3.5" />} onClick={() => setEditor(c)}>
                  Edit
                </Button>
                <Button size="sm" variant="danger" leftIcon={<Trash2 className="h-3.5 w-3.5" />} onClick={() => remove(c.id)}>
                  Delete
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal open={!!editor} onOpenChange={(v) => !v && setEditor(null)} title={editor?.id ? 'Edit Campaign' : 'New Campaign'} size="lg">
        {editor ? (
          <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); void save(); }}>
            <div className="grid gap-3 md:grid-cols-2">
              <FormField label="Name (English)" required>
                <Input value={editor.nameEn} onChange={(e) => setEditor({ ...editor, nameEn: e.target.value })} />
              </FormField>
              <FormField label="Name (Bangla)">
                <Input value={editor.nameBn ?? ''} onChange={(e) => setEditor({ ...editor, nameBn: e.target.value })} />
              </FormField>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <FormField label="Source" required>
                <Select value={editor.source} onChange={(e) => setEditor({ ...editor, source: e.target.value as CampaignRow['source'] })}>
                  <option value="net_loss">Net loss</option>
                  <option value="wager_amount">Wager amount</option>
                </Select>
              </FormField>
              <FormField label="Cadence" required>
                <Select value={editor.cadence} onChange={(e) => setEditor({ ...editor, cadence: e.target.value as CampaignRow['cadence'] })}>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </Select>
              </FormField>
              <FormField label="Active">
                <label className="inline-flex items-center gap-2 text-sm">
                  <Switch checked={editor.isActive} onChange={(v) => setEditor({ ...editor, isActive: Boolean(v) })} />
                  {editor.isActive ? 'Yes' : 'No'}
                </label>
              </FormField>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <FormField label="Percentage (%)" required>
                <Input type="number" min="0" max="100" step="0.1" value={String(editor.percentage)} onChange={(e) => setEditor({ ...editor, percentage: Number(e.target.value) || 0 })} />
              </FormField>
              <FormField label="Max cashback (BDT)" hint="0 disables the cap.">
                <Input type="number" min="0" step="1" value={String(editor.maxCashback)} onChange={(e) => setEditor({ ...editor, maxCashback: Number(e.target.value) || 0 })} />
              </FormField>
              <FormField label="Turnover (x)" hint="When > 0, the credit routes through a Bonus Rule.">
                <Input type="number" min="0" step="0.5" value={String(editor.turnoverX)} onChange={(e) => setEditor({ ...editor, turnoverX: Number(e.target.value) || 0 })} />
              </FormField>
            </div>
            {editor.turnoverX > 0 ? (
              <FormField label="Bonus Rule (carries turnover)" required>
                <Select value={editor.bonusRuleId ?? ''} onChange={(e) => setEditor({ ...editor, bonusRuleId: e.target.value || null })}>
                  <option value="">Select a rule</option>
                  {rules.map((r) => <option key={r.id} value={r.id}>{r.name} ({r.type}, {r.turnoverX}x)</option>)}
                </Select>
              </FormField>
            ) : null}
            <div className="grid gap-3 md:grid-cols-2">
              <FormField label="Starts at">
                <Input type="datetime-local" value={toLocalInput(editor.startsAt)} onChange={(e) => setEditor({ ...editor, startsAt: e.target.value || null })} />
              </FormField>
              <FormField label="Ends at">
                <Input type="datetime-local" value={toLocalInput(editor.endsAt)} onChange={(e) => setEditor({ ...editor, endsAt: e.target.value || null })} />
              </FormField>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" type="button" onClick={() => setEditor(null)}>Cancel</Button>
              <Button type="submit" loading={busy}>Save</Button>
            </div>
          </form>
        ) : null}
      </Modal>

      <Modal open={!!runResult} onOpenChange={(v) => !v && setRunResult(null)} title={runResult ? `Run result . ${runResult.campaign.nameEn}` : ''} size="lg">
        {runResult ? (
          <div className="space-y-3">
            <p className="text-xs text-ink-mid">
              Period: <code>{runResult.result.periodKey}</code> ({new Date(runResult.result.periodStart).toLocaleString()} to {new Date(runResult.result.periodEnd).toLocaleString()}).
              {' '}Paid {runResult.result.paidUsers}/{runResult.result.eligibleUsers} eligible users. Total {Number(runResult.result.totalCashback).toLocaleString()} BDT.
            </p>
            <div className="max-h-[50vh] space-y-1 overflow-y-auto">
              {runResult.result.lines.map((line) => (
                <div key={line.userId} className="flex items-center justify-between gap-2 rounded border border-brand-divider bg-brand-paper px-3 py-1.5 text-xs">
                  <code className="font-mono text-ink-lo">{line.userId}</code>
                  <div className="flex items-center gap-2">
                    <span className="text-ink-lo">base {Number(line.baseAmount).toLocaleString()}</span>
                    <Chip tone={line.status === 'granted' ? 'ok' : line.status === 'failed' ? 'warn' : 'neutral'}>{line.status.replace('_', ' ')}</Chip>
                    {line.cashbackAmount > 0 ? <span className="font-bold text-brand-yellow-700">+{Number(line.cashbackAmount).toLocaleString()}</span> : null}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </Modal>
    </>
  );
}
