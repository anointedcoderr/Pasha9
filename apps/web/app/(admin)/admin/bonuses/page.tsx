// Built by Anointed Coder.
//
// M2D admin console for the bonus + turnover engine. Two tabs:
//   Rules:  CRUD over BonusRule. Each rule defines the payout
//           shape (percent / flat / max), the turnover multiplier
//           that locks the credit, and which trigger (first_deposit,
//           reload, promo with meta.trigger=deposit, etc).
//   Grants: live ledger of every issued UserBonus. Admin can cancel
//           an active grant, manually credit turnover, or kick the
//           expiry sweep.

'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { PageHeader } from '@/components/site/PageHeader';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { FormField, Input, Textarea } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Switch } from '@/components/ui/Switch';
import { Modal } from '@/components/ui/Modal';
import { Chip } from '@/components/ui/Chip';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs';
import { Gift, Plus, Pencil, Trash2, RefreshCw, AlertCircle, Settings2, BadgePlus, Ban, ListChecks, Filter } from 'lucide-react';
import { formatBDT } from '@/lib/utils/format';
import { cn } from '@/lib/utils/cn';

interface RuleRow {
  id: string;
  name: string;
  type: string;
  code: string | null;
  amount: number;
  percentage: number;
  minDeposit: number;
  maxBonus: number;
  turnoverX: number;
  validityDays: number;
  priority: number;
  status: string;
  description: string | null;
  startsAt: string | null;
  endsAt: string | null;
  meta: unknown;
}

interface GrantRow {
  id: string;
  userId: string;
  username: string;
  phone: string | null;
  rule: { id: string; name: string; type: string; turnoverX: number };
  amount: number;
  turnoverRequired: number;
  turnoverProgress: number;
  status: string;
  sourceType: string | null;
  sourceId: string | null;
  note: string | null;
  claimedAt: string;
  expiresAt: string | null;
  releasedAt: string | null;
  cancelledAt: string | null;
}

const BONUS_TYPES = ['first_deposit', 'daily', 'weekly', 'referral', 'vip', 'invite', 'reload', 'manual', 'promo'] as const;
const GRANT_STATUSES = ['', 'active', 'completed', 'expired', 'cancelled'] as const;

const EMPTY_RULE: Omit<RuleRow, 'id'> & { id: string } = {
  id: 'new',
  name: '',
  type: 'promo',
  code: '',
  amount: 0,
  percentage: 0,
  minDeposit: 0,
  maxBonus: 0,
  turnoverX: 10,
  validityDays: 30,
  priority: 0,
  status: 'active',
  description: '',
  startsAt: null,
  endsAt: null,
  meta: null,
};

function ruleStatusTone(s: string): 'ok' | 'warn' | 'neutral' {
  if (s === 'active') return 'ok';
  if (s === 'paused') return 'warn';
  return 'neutral';
}

function grantStatusTone(s: string): 'ok' | 'warn' | 'neutral' | 'danger' | 'info' {
  if (s === 'active') return 'info';
  if (s === 'completed') return 'ok';
  if (s === 'expired') return 'warn';
  if (s === 'cancelled') return 'danger';
  return 'neutral';
}

export default function AdminBonusesPage() {
  const [tab, setTab] = useState<'rules' | 'grants'>('rules');

  // Rules state
  const [rules, setRules] = useState<RuleRow[]>([]);
  const [rulesLoading, setRulesLoading] = useState(true);
  const [editor, setEditor] = useState<(Omit<RuleRow, 'id'> & { id: string }) | null>(null);
  const [savingRule, setSavingRule] = useState(false);
  const [ruleError, setRuleError] = useState<string | null>(null);

  // Grants state
  const [grants, setGrants] = useState<GrantRow[]>([]);
  const [grantsLoading, setGrantsLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [grantQuery, setGrantQuery] = useState('');
  const [manualOpen, setManualOpen] = useState(false);
  const [sweeping, setSweeping] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // ----- Loaders -----

  const loadRules = useCallback(async () => {
    setRulesLoading(true);
    setRuleError(null);
    try {
      const res = await fetch('/api/admin/bonus-rules', { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message ?? data?.code ?? 'Failed to load');
      setRules(data.rules as RuleRow[]);
    } catch (e) {
      setRuleError(e instanceof Error ? e.message : 'Failed to load rules');
    } finally {
      setRulesLoading(false);
    }
  }, []);

  const loadGrants = useCallback(async () => {
    setGrantsLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set('status', statusFilter);
      if (grantQuery.trim()) params.set('q', grantQuery.trim());
      const res = await fetch(`/api/admin/bonus-grants?${params.toString()}`, { cache: 'no-store' });
      const data = await res.json();
      if (res.ok) setGrants(data.grants as GrantRow[]);
    } finally {
      setGrantsLoading(false);
    }
  }, [statusFilter, grantQuery]);

  useEffect(() => { loadRules(); }, [loadRules]);
  useEffect(() => { if (tab === 'grants') loadGrants(); }, [tab, loadGrants]);

  // ----- Rule save / delete -----

  const saveRule = async (form: Omit<RuleRow, 'id'> & { id: string }) => {
    setSavingRule(true);
    setRuleError(null);
    try {
      const isNew = form.id === 'new';
      const url = isNew ? '/api/admin/bonus-rules' : `/api/admin/bonus-rules/${form.id}`;
      const method = isNew ? 'POST' : 'PATCH';
      const payload = {
        name: form.name,
        type: form.type,
        code: form.code?.trim() ? form.code.trim() : null,
        amount: Number(form.amount),
        percentage: Number(form.percentage),
        minDeposit: Number(form.minDeposit),
        maxBonus: Number(form.maxBonus),
        turnoverX: Number(form.turnoverX),
        validityDays: Number(form.validityDays),
        priority: Number(form.priority),
        status: form.status,
        description: form.description ?? '',
        startsAt: form.startsAt ?? null,
        endsAt: form.endsAt ?? null,
      };
      const res = await fetch(url, {
        method,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message ?? data?.code ?? 'Save failed');
      setEditor(null);
      setToast(isNew ? `Rule "${form.name}" created.` : `Rule "${form.name}" updated.`);
      setTimeout(() => setToast(null), 4000);
      loadRules();
    } catch (e) {
      setRuleError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSavingRule(false);
    }
  };

  const deleteRule = async (id: string, name: string) => {
    if (!confirm(`Delete rule "${name}"? Grants already issued under this rule will block deletion.`)) return;
    const res = await fetch(`/api/admin/bonus-rules/${id}`, { method: 'DELETE' });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      setToast(`Rule "${name}" deleted.`);
      setTimeout(() => setToast(null), 4000);
      loadRules();
    } else {
      setRuleError(data?.message ?? data?.code ?? 'Delete failed');
    }
  };

  // ----- Grants actions -----

  const cancelGrantAction = async (g: GrantRow) => {
    const note = prompt(`Cancel grant for ${g.username}? Optional note:`);
    if (note === null) return;
    const res = await fetch(`/api/admin/bonus-grants/${g.id}/cancel`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ note }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      setToast(`Grant cancelled for ${g.username}.`);
      setTimeout(() => setToast(null), 4000);
      loadGrants();
    } else {
      alert(data?.message ?? data?.code ?? 'Cancel failed');
    }
  };

  const addTurnoverAction = async (g: GrantRow) => {
    const raw = prompt(`Credit turnover to ${g.username} (BDT):`);
    if (!raw) return;
    const amount = Number(raw);
    if (!Number.isFinite(amount) || amount <= 0) {
      alert('Invalid amount.');
      return;
    }
    const note = prompt('Reason / note (optional):') ?? undefined;
    const res = await fetch(`/api/admin/bonus-grants/${g.id}/turnover`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ amount, note }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      setToast(`Turnover +${amount.toLocaleString()} for ${g.username}.`);
      setTimeout(() => setToast(null), 4000);
      loadGrants();
    } else {
      alert(data?.message ?? data?.code ?? 'Adjust failed');
    }
  };

  const runSweep = async () => {
    setSweeping(true);
    try {
      const res = await fetch('/api/admin/bonus-grants/sweep', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        setToast(`Sweep done. Expired ${data.expired ?? 0} grants.`);
        setTimeout(() => setToast(null), 5000);
        loadGrants();
      }
    } finally {
      setSweeping(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Bonus Engine"
        subtitle="Configure rules and audit issued grants. Engine fires on deposit approve + manual admin grant."
        icon={<Gift className="h-5 w-5" />}
        action={
          <div className="flex gap-2">
            <Button variant="ghost" leftIcon={<RefreshCw className={cn('h-3.5 w-3.5', (rulesLoading || grantsLoading) && 'animate-spin')} />} onClick={() => (tab === 'rules' ? loadRules() : loadGrants())}>
              Reload
            </Button>
            {tab === 'rules' ? (
              <Button leftIcon={<Plus className="h-4 w-4" />} onClick={() => setEditor({ ...EMPTY_RULE })}>New Rule</Button>
            ) : (
              <>
                <Button variant="neon" leftIcon={<BadgePlus className="h-4 w-4" />} onClick={() => setManualOpen(true)}>Manual Grant</Button>
                <Button variant="ghost" leftIcon={<AlertCircle className="h-3.5 w-3.5" />} loading={sweeping} onClick={runSweep}>
                  Expire sweep
                </Button>
              </>
            )}
          </div>
        }
      />

      {toast ? <Card padding="md" className="mb-4"><p className="text-sm text-signal-ok">{toast}</p></Card> : null}
      {ruleError ? <Card padding="md" className="mb-4"><p className="text-sm text-signal-danger">{ruleError}</p></Card> : null}

      <Tabs value={tab} onValueChange={(v) => setTab(v as 'rules' | 'grants')}>
        <TabsList>
          <TabsTrigger value="rules"><Settings2 className="mr-1.5 h-3.5 w-3.5" /> Rules</TabsTrigger>
          <TabsTrigger value="grants"><ListChecks className="mr-1.5 h-3.5 w-3.5" /> Grants</TabsTrigger>
        </TabsList>

        <TabsContent value="rules">
          {rulesLoading ? (
            <p className="text-sm text-ink-mid">Loading rules...</p>
          ) : rules.length === 0 ? (
            <Card padding="lg"><p className="text-sm text-ink-mid">No bonus rules yet. Click &quot;New Rule&quot; to create the first one.</p></Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {rules.map((r) => (
                <Card key={r.id} padding="lg">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs uppercase tracking-wider text-gold-300">{r.type.replace('_', ' ')}{r.code ? ` . ${r.code}` : ''}</p>
                      <h3 className="mt-1 text-base font-semibold text-ink-hi">{r.name}</h3>
                      {r.description ? <p className="mt-1 text-sm text-ink-mid">{r.description}</p> : null}
                    </div>
                    <Chip tone={ruleStatusTone(r.status)}>{r.status}</Chip>
                  </div>
                  <dl className="mt-4 grid grid-cols-3 gap-2 text-xs">
                    <Field label="Rate" value={r.percentage > 0 ? `${r.percentage}%${r.amount > 0 ? ` + ${formatBDT(r.amount)}` : ''}` : (r.amount > 0 ? formatBDT(r.amount) : '-')} />
                    <Field label="Cap" value={r.maxBonus > 0 ? formatBDT(r.maxBonus) : 'None'} />
                    <Field label="Min Dep" value={r.minDeposit > 0 ? formatBDT(r.minDeposit) : '-'} />
                    <Field label="Turnover" value={r.turnoverX > 0 ? `${r.turnoverX}x` : 'None'} />
                    <Field label="Validity" value={r.validityDays > 0 ? `${r.validityDays} d` : 'No expiry'} />
                    <Field label="Priority" value={String(r.priority)} />
                  </dl>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button size="sm" variant="neon" leftIcon={<Pencil className="h-3.5 w-3.5" />} onClick={() => setEditor({ ...r, code: r.code ?? '', description: r.description ?? '' })}>Edit</Button>
                    <Button size="sm" variant="ghost" leftIcon={<Trash2 className="h-3.5 w-3.5" />} onClick={() => deleteRule(r.id, r.name)}>Delete</Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="grants">
          <Card padding="md" className="mb-3">
            <div className="flex flex-wrap items-end gap-3">
              <FormField label="Status">
                <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                  {GRANT_STATUSES.map((s) => (
                    <option key={s} value={s}>{s ? s : 'All'}</option>
                  ))}
                </Select>
              </FormField>
              <FormField label="Search user (username / phone)">
                <Input value={grantQuery} onChange={(e) => setGrantQuery(e.target.value)} placeholder="e.g. tariq or 0171..." />
              </FormField>
              <Button leftIcon={<Filter className="h-3.5 w-3.5" />} onClick={loadGrants}>Apply</Button>
            </div>
          </Card>

          {grantsLoading ? (
            <p className="text-sm text-ink-mid">Loading grants...</p>
          ) : grants.length === 0 ? (
            <Card padding="lg"><p className="text-sm text-ink-mid">No grants match the current filter.</p></Card>
          ) : (
            <Card padding="md" className="overflow-x-auto">
              <table className="w-full min-w-[920px] text-sm">
                <thead className="text-xs uppercase tracking-wider text-ink-lo">
                  <tr>
                    <th className="px-2 py-2 text-left">User</th>
                    <th className="px-2 py-2 text-left">Rule</th>
                    <th className="px-2 py-2 text-right">Amount</th>
                    <th className="px-2 py-2 text-left">Status</th>
                    <th className="px-2 py-2 text-left">Turnover</th>
                    <th className="px-2 py-2 text-left">Source</th>
                    <th className="px-2 py-2 text-left">Claimed</th>
                    <th className="px-2 py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {grants.map((g) => {
                    const pct = g.turnoverRequired > 0 ? Math.min(100, Math.round((g.turnoverProgress / g.turnoverRequired) * 100)) : 100;
                    return (
                      <tr key={g.id} className="border-t border-neon/10 align-top">
                        <td className="px-2 py-2">
                          <p className="font-semibold text-ink-hi">{g.username}</p>
                          {g.phone ? <p className="text-xs text-ink-lo">{g.phone}</p> : null}
                        </td>
                        <td className="px-2 py-2">
                          <p className="font-medium text-ink-mid">{g.rule.name}</p>
                          <p className="text-xs text-ink-lo">{g.rule.type}{g.rule.turnoverX > 0 ? ` . ${g.rule.turnoverX}x` : ''}</p>
                        </td>
                        <td className="px-2 py-2 text-right font-mono">{formatBDT(g.amount)}</td>
                        <td className="px-2 py-2"><Chip tone={grantStatusTone(g.status)}>{g.status}</Chip></td>
                        <td className="px-2 py-2 min-w-[160px]">
                          <div className="flex items-center justify-between text-xs text-ink-mid">
                            <span>{formatBDT(g.turnoverProgress)}</span>
                            <span>{formatBDT(g.turnoverRequired)}</span>
                          </div>
                          <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-base-deep">
                            <div className={cn('h-full rounded-full', g.status === 'completed' ? 'bg-grad-gold' : 'bg-neon/70')} style={{ width: `${pct}%` }} />
                          </div>
                        </td>
                        <td className="px-2 py-2 text-xs text-ink-mid">{g.sourceType ?? '-'}</td>
                        <td className="px-2 py-2 text-xs text-ink-lo">{new Date(g.claimedAt).toLocaleString()}</td>
                        <td className="px-2 py-2 text-right">
                          {g.status === 'active' ? (
                            <div className="inline-flex gap-1">
                              <Button size="sm" variant="ghost" onClick={() => addTurnoverAction(g)}>+ Turnover</Button>
                              <Button size="sm" variant="ghost" leftIcon={<Ban className="h-3.5 w-3.5" />} onClick={() => cancelGrantAction(g)}>Cancel</Button>
                            </div>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      <Modal open={!!editor} onOpenChange={(v) => !v && setEditor(null)} title={editor?.id === 'new' ? 'New Bonus Rule' : 'Edit Bonus Rule'} size="lg">
        {editor ? (
          <RuleEditor
            value={editor}
            onChange={setEditor}
            onSave={() => saveRule(editor)}
            saving={savingRule}
            onCancel={() => setEditor(null)}
          />
        ) : null}
      </Modal>

      <Modal open={manualOpen} onOpenChange={setManualOpen} title="Manual Bonus Grant" size="md">
        <ManualGrantForm
          rules={rules.filter((r) => r.status === 'active')}
          onDone={(msg) => {
            setManualOpen(false);
            setToast(msg);
            setTimeout(() => setToast(null), 4000);
            loadGrants();
          }}
        />
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

function RuleEditor({
  value,
  onChange,
  onSave,
  saving,
  onCancel,
}: {
  value: Omit<RuleRow, 'id'> & { id: string };
  onChange: (v: Omit<RuleRow, 'id'> & { id: string }) => void;
  onSave: () => void;
  saving: boolean;
  onCancel: () => void;
}) {
  const set = <K extends keyof typeof value>(k: K, v: typeof value[K]) => onChange({ ...value, [k]: v });
  return (
    <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); onSave(); }}>
      <div className="grid gap-3 md:grid-cols-2">
        <FormField label="Name" required>
          <Input value={value.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Welcome 100% match" />
        </FormField>
        <FormField label="Type" required hint="first_deposit fires on the user's first approved deposit. reload + promo (meta.trigger=deposit) fire on every deposit.">
          <Select value={value.type} onChange={(e) => set('type', e.target.value)}>
            {BONUS_TYPES.map((tp) => <option key={tp} value={tp}>{tp.replace('_', ' ')}</option>)}
          </Select>
        </FormField>
        <FormField label="Code (optional)" hint="Stable lookup key. Letters / digits / underscore.">
          <Input value={value.code ?? ''} onChange={(e) => set('code', e.target.value)} placeholder="welcome" />
        </FormField>
        <FormField label="Status">
          <Select value={value.status} onChange={(e) => set('status', e.target.value)}>
            <option value="active">active</option>
            <option value="hidden">hidden</option>
            <option value="paused">paused</option>
          </Select>
        </FormField>
        <FormField label="Percent of deposit" hint="0 - 1000. Combined with flat amount.">
          <Input type="number" min={0} value={value.percentage} onChange={(e) => set('percentage', Number(e.target.value))} />
        </FormField>
        <FormField label="Flat amount (BDT)">
          <Input type="number" min={0} value={value.amount} onChange={(e) => set('amount', Number(e.target.value))} />
        </FormField>
        <FormField label="Max bonus cap (BDT)" hint="0 = unlimited.">
          <Input type="number" min={0} value={value.maxBonus} onChange={(e) => set('maxBonus', Number(e.target.value))} />
        </FormField>
        <FormField label="Min deposit to trigger (BDT)">
          <Input type="number" min={0} value={value.minDeposit} onChange={(e) => set('minDeposit', Number(e.target.value))} />
        </FormField>
        <FormField label="Turnover multiplier (Nx)" hint="0 = no wagering required. Bonus releases immediately.">
          <Input type="number" min={0} value={value.turnoverX} onChange={(e) => set('turnoverX', Number(e.target.value))} />
        </FormField>
        <FormField label="Validity (days)" hint="0 = never expires.">
          <Input type="number" min={0} value={value.validityDays} onChange={(e) => set('validityDays', Number(e.target.value))} />
        </FormField>
        <FormField label="Priority" hint="Higher wins when multiple rules of the same trigger type are eligible.">
          <Input type="number" min={0} value={value.priority} onChange={(e) => set('priority', Number(e.target.value))} />
        </FormField>
      </div>
      <FormField label="Description (shown on /promotions)">
        <Textarea rows={3} value={value.description ?? ''} onChange={(e) => set('description', e.target.value)} placeholder="Plain text shown to users." />
      </FormField>
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="ghost" type="button" onClick={onCancel}>Cancel</Button>
        <Button type="submit" loading={saving}>Save</Button>
      </div>
    </form>
  );
}

function ManualGrantForm({ rules, onDone }: { rules: RuleRow[]; onDone: (msg: string) => void }) {
  const [userId, setUserId] = useState('');
  const [ruleId, setRuleId] = useState(rules[0]?.id ?? '');
  const [amount, setAmount] = useState(0);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      const res = await fetch('/api/admin/bonus-grants/manual', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ userId: userId.trim(), ruleId, amount: Number(amount), note: note.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message ?? data?.code ?? 'Grant failed');
      onDone(`Granted ${formatBDT(Number(amount))} to user ${userId.trim()}.`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Grant failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="space-y-4" onSubmit={submit}>
      <FormField label="User id" required hint="Open /admin/users to copy the id of the recipient.">
        <Input value={userId} onChange={(e) => setUserId(e.target.value)} placeholder="cuid..." />
      </FormField>
      <FormField label="Rule" required hint="Only active rules are listed.">
        <Select value={ruleId} onChange={(e) => setRuleId(e.target.value)} disabled={rules.length === 0}>
          {rules.length === 0 ? <option value="">No active rules</option> : null}
          {rules.map((r) => (
            <option key={r.id} value={r.id}>{r.name} . {r.type}{r.turnoverX > 0 ? ` . ${r.turnoverX}x` : ''}</option>
          ))}
        </Select>
      </FormField>
      <FormField label="Bonus amount (BDT)" required hint="Engine locks this in lockedBalance until turnover is met.">
        <Input type="number" min={1} value={amount} onChange={(e) => setAmount(Number(e.target.value))} />
      </FormField>
      <FormField label="Note (optional)">
        <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Internal context only." />
      </FormField>
      {err ? <p className="text-sm text-signal-danger">{err}</p> : null}
      <div className="flex justify-end gap-2 pt-2">
        <Button type="submit" loading={busy} disabled={!userId.trim() || !ruleId || amount <= 0}>Grant</Button>
      </div>
    </form>
  );
}
