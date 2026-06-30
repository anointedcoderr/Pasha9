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

import Link from 'next/link';
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
import { Gift, Plus, Pencil, Trash2, RefreshCw, AlertCircle, Settings2, BadgePlus, Ban, ListChecks, Filter, Stethoscope, CheckCircle2, XCircle, Layers } from 'lucide-react';
import { formatBDT } from '@/lib/utils/format';
import { cn } from '@/lib/utils/cn';
import { ImageUpload } from '@/components/admin/ImageUpload';
import { getPromotionConfig, mergePromotionMeta } from '@/lib/promotions/config';

interface RuleRow {
  id: string;
  name: string;
  nameBn: string | null;
  type: string;
  promotionType: string | null;
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
  descriptionBn: string | null;
  startsAt: string | null;
  endsAt: string | null;
  meta: unknown;
  // Per-user claim limit + free spins (unified bonus redesign).
  claimPeriod: string;
  claimLimit: number;
  freeSpinCount: number;
  freeSpinTierKey: string | null;
  configWarning?: string | null;
  // M4 Phase D presentation assets + terms.
  bannerDesktopUrl: string | null;
  bannerMobileUrl: string | null;
  thumbnailUrl: string | null;
  backgroundUrl: string | null;
  termsEn: string | null;
  termsBn: string | null;
  // M4 Phase D claim count (read-only summary).
  claimCount?: number;
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

const PROMOTION_TYPES = [
  { value: 'first_deposit_bonus', engineType: 'first_deposit', label: 'First Deposit Bonus' },
  { value: 'daily_bonus', engineType: 'daily', label: 'Daily Bonus' },
  { value: 'weekly_reward', engineType: 'weekly', label: 'Weekly Reward' },
  { value: 'referral_bonus', engineType: 'referral', label: 'Referral Bonus' },
  { value: 'vip_reward', engineType: 'vip', label: 'VIP Reward' },
  { value: 'invite_friend_offer', engineType: 'invite', label: 'Invite Friend Offer' },
  { value: 'other', engineType: 'promo', label: 'Other Future Promotions' },
] as const;
const GRANT_STATUSES = ['', 'active', 'completed', 'expired', 'cancelled'] as const;

// Claim-limit windows. Mirrors BonusRule.claimPeriod allowed values.
const CLAIM_PERIODS = [
  { value: 'unlimited', label: 'Unlimited' },
  { value: 'account', label: 'Once per account' },
  { value: 'day', label: 'Once per day' },
  { value: 'week', label: 'Once per week' },
  { value: 'month', label: 'Once per month' },
] as const;

interface SpinTierOption {
  key: string;
  label: string;
}

// Fallback wheel tiers used when the spin-tiers admin API is not
// reachable (e.g. the operator lacks rewards.write). Keeps the free
// spins dropdown usable in every case.
const FALLBACK_SPIN_TIERS: SpinTierOption[] = [
  { key: 'lucky', label: 'Lucky' },
  { key: 'grand', label: 'Grand' },
  { key: 'supreme', label: 'Supreme' },
];

const EMPTY_RULE: Omit<RuleRow, 'id'> & { id: string } = {
  id: 'new',
  name: '',
  nameBn: '',
  type: 'promo',
  promotionType: 'other',
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
  descriptionBn: '',
  startsAt: null,
  endsAt: null,
  meta: null,
  claimPeriod: 'unlimited',
  claimLimit: 0,
  freeSpinCount: 0,
  freeSpinTierKey: null,
  bannerDesktopUrl: null,
  bannerMobileUrl: null,
  thumbnailUrl: null,
  backgroundUrl: null,
  termsEn: '',
  termsBn: '',
};

// Tier-managed rules (meta.managedBy === 'deposit_bonus_tier') are
// edited from /admin/deposit-bonus-tiers. Hide them here so a tier
// never double-shows as a stray advanced rule.
function isTierManaged(meta: unknown): boolean {
  return Boolean(meta && typeof meta === 'object' && !Array.isArray(meta) && (meta as Record<string, unknown>).managedBy === 'deposit_bonus_tier');
}

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
  const [spinTiers, setSpinTiers] = useState<SpinTierOption[]>(FALLBACK_SPIN_TIERS);

  // Grants state
  const [grants, setGrants] = useState<GrantRow[]>([]);
  const [grantsLoading, setGrantsLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [grantQuery, setGrantQuery] = useState('');
  const [manualOpen, setManualOpen] = useState(false);
  const [diagnoseOpen, setDiagnoseOpen] = useState(false);
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

  // Populate the free-spins wheel dropdown from the spin-tiers admin
  // API. Falls back to the hardcoded tiers if the call fails so the
  // editor still works for operators without rewards.write.
  const loadSpinTiers = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/spin-tiers', { cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json();
      const tiers = (data?.tiers ?? []) as Array<{ key: string; nameEn?: string | null }>;
      if (Array.isArray(tiers) && tiers.length > 0) {
        setSpinTiers(tiers.map((t) => ({ key: t.key, label: t.nameEn?.trim() || t.key })));
      }
    } catch {
      // Keep the fallback tiers.
    }
  }, []);

  useEffect(() => { loadRules(); }, [loadRules]);
  useEffect(() => { loadSpinTiers(); }, [loadSpinTiers]);
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
        nameBn: form.nameBn ?? '',
        type: form.type,
        promotionType: form.promotionType,
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
        descriptionBn: form.descriptionBn ?? '',
        startsAt: form.startsAt ?? null,
        endsAt: form.endsAt ?? null,
        meta: form.meta,
        // Unified bonus redesign: claim limit + free spins.
        claimPeriod: form.claimPeriod || 'unlimited',
        claimLimit: Number(form.claimLimit) || 0,
        freeSpinCount: Number(form.freeSpinCount) || 0,
        freeSpinTierKey: form.freeSpinTierKey || null,
        // M4 Phase D presentation assets.
        bannerDesktopUrl: form.bannerDesktopUrl,
        bannerMobileUrl: form.bannerMobileUrl,
        thumbnailUrl: form.thumbnailUrl,
        backgroundUrl: form.backgroundUrl,
        termsEn: form.termsEn ?? '',
        termsBn: form.termsBn ?? '',
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

  // Hide deposit-tier managed rules from the advanced list. They are
  // owned by /admin/deposit-bonus-tiers and would otherwise appear here
  // as duplicate rows.
  const visibleRules = useMemo(() => rules.filter((r) => !isTierManaged(r.meta)), [rules]);

  return (
    <>
      <PageHeader
        title="Bonus Management"
        subtitle="Advanced mode: full rule control over payouts, eligibility, claim limits, and free spins. For the simple deposit ladder use Deposit Bonus Tiers."
        icon={<Gift className="h-5 w-5" />}
        action={
          <div className="flex gap-2">
            <Link href="/admin/deposit-bonus-tiers">
              <Button variant="ghost" leftIcon={<Layers className="h-3.5 w-3.5" />}>Deposit tiers</Button>
            </Link>
            <Button variant="ghost" leftIcon={<RefreshCw className={cn('h-3.5 w-3.5', (rulesLoading || grantsLoading) && 'animate-spin')} />} onClick={() => (tab === 'rules' ? loadRules() : loadGrants())}>
              Reload
            </Button>
            <Button variant="ghost" leftIcon={<Stethoscope className="h-3.5 w-3.5" />} onClick={() => setDiagnoseOpen(true)}>
              Diagnose
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
          ) : visibleRules.length === 0 ? (
            <Card padding="lg"><p className="text-sm text-ink-mid">No bonus rules yet. Click &quot;New Rule&quot; to create the first one. Deposit ladder tiers are managed on the Deposit Bonus Tiers page.</p></Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {visibleRules.map((r) => (
                <Card key={r.id} padding="lg">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs uppercase tracking-wider text-gold-300">{(r.promotionType ?? r.type).replaceAll('_', ' ')}{r.code ? ` . ${r.code}` : ''}</p>
                      <h3 className="mt-1 text-base font-semibold text-ink-hi">{r.name}</h3>
                      {r.description ? <p className="mt-1 text-sm text-ink-mid">{r.description}</p> : null}
                      {r.configWarning ? <p className="mt-2 text-xs text-signal-warn">Warning: {r.configWarning}</p> : null}
                    </div>
                    <Chip tone={ruleStatusTone(r.status)}>{r.status}</Chip>
                  </div>
                  {(r.bannerDesktopUrl || r.bannerMobileUrl || r.thumbnailUrl) ? (
                    <div className="mt-3 overflow-hidden rounded-lg border border-brand-divider bg-brand-surface">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={r.bannerDesktopUrl ?? r.thumbnailUrl ?? r.bannerMobileUrl ?? ''}
                        alt={r.name}
                        className="h-28 w-full object-cover"
                      />
                    </div>
                  ) : null}
                  <dl className="mt-4 grid grid-cols-3 gap-2 text-xs">
                    <Field label="Rate" value={r.percentage > 0 ? `${r.percentage}%${r.amount > 0 ? ` + ${formatBDT(r.amount)}` : ''}` : (r.amount > 0 ? formatBDT(r.amount) : '-')} />
                    <Field label="Cap" value={r.maxBonus > 0 ? formatBDT(r.maxBonus) : 'None'} />
                    <Field label="Min Dep" value={r.minDeposit > 0 ? formatBDT(r.minDeposit) : '-'} />
                    <Field label="Turnover" value={r.turnoverX > 0 ? `${r.turnoverX}x` : 'None'} />
                    <Field label="Validity" value={r.validityDays > 0 ? `${r.validityDays} d` : 'No expiry'} />
                    <Field label="Priority" value={String(r.priority)} />
                    <Field label="Claims" value={String(r.claimCount ?? 0)} />
                  </dl>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button size="sm" variant="neon" leftIcon={<Pencil className="h-3.5 w-3.5" />} onClick={() => setEditor({
                      ...r,
                      code: r.code ?? '',
                      nameBn: r.nameBn ?? '',
                      promotionType: r.promotionType ?? null,
                      description: r.description ?? '',
                      descriptionBn: r.descriptionBn ?? '',
                      termsEn: r.termsEn ?? '',
                      termsBn: r.termsBn ?? '',
                    })}>Edit</Button>
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
            spinTiers={spinTiers}
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

      <Modal open={diagnoseOpen} onOpenChange={setDiagnoseOpen} title="Bonus Engine Diagnose" size="lg">
        <DiagnoseForm />
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
  spinTiers,
}: {
  value: Omit<RuleRow, 'id'> & { id: string };
  onChange: (v: Omit<RuleRow, 'id'> & { id: string }) => void;
  onSave: () => void;
  saving: boolean;
  onCancel: () => void;
  spinTiers: SpinTierOption[];
}) {
  const set = <K extends keyof typeof value>(k: K, v: typeof value[K]) => onChange({ ...value, [k]: v });
  const promotion = getPromotionConfig(value.meta);
  const setPromotion = (patch: Parameters<typeof mergePromotionMeta>[1]) => set('meta', mergePromotionMeta(value.meta, patch));
  return (
    <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); onSave(); }}>
      <div className="grid gap-3 md:grid-cols-2">
        <FormField label="Name" required>
          <Input value={value.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Welcome 100% match" />
        </FormField>
        <FormField label="Name (Bangla)" hint="Shown first for Bangla users.">
          <Input value={value.nameBn ?? ''} onChange={(e) => set('nameBn', e.target.value)} placeholder="বাংলা প্রমোশন নাম" />
        </FormField>
        <FormField label="Promotion type" required hint="Controls the public category and default claim action.">
          <Select
            value={value.promotionType ?? ''}
            onChange={(e) => {
              const selected = PROMOTION_TYPES.find((item) => item.value === e.target.value);
              onChange({
                ...value,
                promotionType: selected?.value ?? null,
                type: selected?.engineType ?? value.type,
              });
            }}
          >
            {!value.promotionType ? <option value="">Legacy category: {value.type.replaceAll('_', ' ')}</option> : null}
            {PROMOTION_TYPES.map((tp) => <option key={tp.value} value={tp.value}>{tp.label}</option>)}
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
      <FormField label="Description (Bangla)" hint="Bangla-first copy. Leave blank to use the English description.">
        <Textarea rows={3} value={value.descriptionBn ?? ''} onChange={(e) => set('descriptionBn', e.target.value)} placeholder="বাংলা বিবরণ" />
      </FormField>

      <div className="space-y-4 rounded-xl border border-brand-divider bg-brand-surface p-3">
        <p className="text-[10px] font-bold uppercase tracking-wider text-brand-inkMute">Claim flow and eligibility</p>
        {value.configWarning ? <p className="text-xs text-signal-warn">Admin warning: {value.configWarning}</p> : null}
        <div className="grid gap-3 md:grid-cols-2">
          <FormField label="Claim button action" hint="Auto uses the safe default for the selected promotion type.">
            <Select value={promotion.claimBehavior} onChange={(e) => setPromotion({ claimBehavior: e.target.value as typeof promotion.claimBehavior })}>
              <option value="auto">Auto by promotion type</option>
              <option value="direct">Direct claim</option>
              <option value="deposit">Redirect to deposit</option>
              <option value="redirect">Redirect to URL</option>
              <option value="disabled">Disabled with safe message</option>
            </Select>
          </FormField>
          <FormField label="Target URL" hint="Used by redirect actions. Referral and VIP have safe defaults.">
            <Input value={promotion.targetUrl ?? ''} onChange={(e) => setPromotion({ targetUrl: e.target.value || null })} placeholder="/referral" />
          </FormField>
          <FormField label="Required or recommended deposit (BDT)" hint="Prefills the deposit page. Falls back to Min deposit.">
            <Input type="number" min={0} value={promotion.requiredDepositAmount} onChange={(e) => setPromotion({ requiredDepositAmount: Number(e.target.value) })} />
          </FormField>
          <FormField label="Minimum approved deposit count">
            <Input type="number" min={0} value={promotion.minApprovedDepositCount} onChange={(e) => setPromotion({ minApprovedDepositCount: Number(e.target.value) })} />
          </FormField>
          <FormField label="Minimum approved deposit total (BDT)">
            <Input type="number" min={0} value={promotion.minApprovedDepositTotal} onChange={(e) => setPromotion({ minApprovedDepositTotal: Number(e.target.value) })} />
          </FormField>
          <label className="flex items-center gap-2 self-end pb-2 text-sm text-ink-mid">
            <Switch checked={promotion.depositRequired} onChange={(v) => setPromotion({ depositRequired: Boolean(v) })} />
            Daily bonus requires deposit
          </label>
        </div>
      </div>

      <div className="space-y-4 rounded-xl border border-brand-divider bg-brand-surface p-3">
        <p className="text-[10px] font-bold uppercase tracking-wider text-brand-inkMute">Claim limit</p>
        <p className="text-xs text-ink-mid">How often a single user can claim this rule. The engine counts grants inside the rolling window and skips the rule once the limit is reached.</p>
        <div className="grid gap-3 md:grid-cols-2">
          <FormField label="Claim period">
            <Select value={value.claimPeriod || 'unlimited'} onChange={(e) => set('claimPeriod', e.target.value)}>
              {CLAIM_PERIODS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
            </Select>
          </FormField>
          <FormField label="Max grants per period" hint="Max grants per period, blank or 0 = 1.">
            <Input type="number" min={0} value={value.claimLimit} onChange={(e) => set('claimLimit', Number(e.target.value))} disabled={(value.claimPeriod || 'unlimited') === 'unlimited'} />
          </FormField>
        </div>
      </div>

      <div className="space-y-4 rounded-xl border border-brand-divider bg-brand-surface p-3">
        <p className="text-[10px] font-bold uppercase tracking-wider text-brand-inkMute">Free spins</p>
        <p className="text-xs text-ink-mid">Award wheel spins alongside this bonus. Set the count above 0 and pick the wheel the spins apply to.</p>
        <div className="grid gap-3 md:grid-cols-2">
          <FormField label="Free spin count" hint="0 = no free spins.">
            <Input type="number" min={0} value={value.freeSpinCount} onChange={(e) => set('freeSpinCount', Number(e.target.value))} />
          </FormField>
          <FormField label="Wheel" hint="Which spin wheel the free spins belong to.">
            <Select
              value={value.freeSpinTierKey ?? ''}
              onChange={(e) => set('freeSpinTierKey', e.target.value || null)}
              disabled={Number(value.freeSpinCount) <= 0}
            >
              <option value="">Select a wheel</option>
              {spinTiers.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
            </Select>
          </FormField>
        </div>
        {Number(value.freeSpinCount) > 0 && !value.freeSpinTierKey ? (
          <p className="text-xs text-signal-warn">Pick a wheel, otherwise the free spins will not be saved.</p>
        ) : null}
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <FormField label="Starts at" hint="Optional public visibility and claim window.">
          <Input type="datetime-local" value={value.startsAt ? value.startsAt.slice(0, 16) : ''} onChange={(e) => set('startsAt', e.target.value ? new Date(e.target.value).toISOString() : null)} />
        </FormField>
        <FormField label="Ends at" hint="Expired promotions stay visible to admin but disappear publicly.">
          <Input type="datetime-local" value={value.endsAt ? value.endsAt.slice(0, 16) : ''} onChange={(e) => set('endsAt', e.target.value ? new Date(e.target.value).toISOString() : null)} />
        </FormField>
      </div>

      <div className="space-y-4 rounded-xl border border-brand-divider bg-brand-surface p-3">
        <p className="text-[10px] font-bold uppercase tracking-wider text-brand-inkMute">Presentation assets</p>
        <ImageUpload
          categoryKey="promo_desktop"
          label="Desktop banner"
          value={value.bannerDesktopUrl}
          onChange={(url) => set('bannerDesktopUrl', url)}
        />
        <ImageUpload
          categoryKey="promo_mobile"
          label="Mobile banner"
          value={value.bannerMobileUrl}
          onChange={(url) => set('bannerMobileUrl', url)}
        />
        <ImageUpload
          categoryKey="promo_thumbnail"
          label="Thumbnail"
          value={value.thumbnailUrl}
          onChange={(url) => set('thumbnailUrl', url)}
        />
        <ImageUpload
          categoryKey="promo_background"
          label="Background"
          value={value.backgroundUrl}
          onChange={(url) => set('backgroundUrl', url)}
        />
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <FormField label="Terms (EN)" hint="Shown in the public promotion card's collapsible Terms section.">
          <Textarea rows={5} value={value.termsEn ?? ''} onChange={(e) => set('termsEn', e.target.value)} placeholder="Plain text. Line breaks are preserved." />
        </FormField>
        <FormField label="Terms (BN)" hint="Bangla version. Leave blank to show the English text in both languages.">
          <Textarea rows={5} value={value.termsBn ?? ''} onChange={(e) => set('termsBn', e.target.value)} placeholder="বাংলা শর্তাবলী।" />
        </FormField>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button variant="ghost" type="button" onClick={onCancel}>Cancel</Button>
        <Button type="submit" loading={saving}>Save</Button>
      </div>
    </form>
  );
}

interface DiagnoseResult {
  isFirstDeposit: boolean;
  candidateCount: number;
  walletExists: boolean;
  evaluated: Array<{
    ruleId: string;
    ruleName: string;
    ruleType: string;
    ruleCode: string | null;
    status: string;
    eligible: boolean;
    reason: string | null;
    payout: number;
    turnoverRequired: number;
  }>;
}

function DiagnoseForm() {
  const [userId, setUserId] = useState('');
  const [amount, setAmount] = useState(1000);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<DiagnoseResult | null>(null);

  const run = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch('/api/admin/bonus-grants/diagnose', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ userId: userId.trim(), amount: Number(amount) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message ?? data?.code ?? 'Diagnose failed');
      setResult(data);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Diagnose failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-xs text-ink-mid">Dry-run the bonus engine for a user + deposit amount. Nothing is granted. Useful to check why a rule fired or did not fire.</p>
      <form className="grid gap-3 md:grid-cols-2" onSubmit={run}>
        <FormField label="User id" required>
          <Input value={userId} onChange={(e) => setUserId(e.target.value)} placeholder="cuid..." />
        </FormField>
        <FormField label="Deposit amount (BDT)" required>
          <Input type="number" min={1} value={amount} onChange={(e) => setAmount(Number(e.target.value))} />
        </FormField>
        <div className="md:col-span-2 flex justify-end">
          <Button type="submit" loading={busy} disabled={!userId.trim() || amount <= 0}>Run diagnose</Button>
        </div>
      </form>

      {err ? <p className="text-sm text-signal-danger">{err}</p> : null}

      {result ? (
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-2 text-xs">
            <Field label="Wallet exists" value={result.walletExists ? 'yes' : 'no'} />
            <Field label="First deposit" value={result.isFirstDeposit ? 'yes' : 'no'} />
            <Field label="Candidate rules" value={String(result.candidateCount)} />
          </div>
          {result.evaluated.length === 0 ? (
            <Card padding="md"><p className="text-sm text-ink-mid">No active first_deposit / reload / promo rules in DB. Create one in the Rules tab.</p></Card>
          ) : (
            <ul className="space-y-2">
              {result.evaluated.map((e) => (
                <li key={e.ruleId} className={cn('rounded-lg border p-3', e.eligible ? 'border-signal-ok/30 bg-signal-ok/5' : 'border-neon/10 bg-base-deep/40')}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-ink-hi">{e.ruleName} <span className="text-xs text-ink-lo">({e.ruleType}{e.ruleCode ? ` / ${e.ruleCode}` : ''})</span></p>
                      {e.eligible ? (
                        <p className="mt-0.5 inline-flex items-center gap-1 text-xs text-signal-ok">
                          <CheckCircle2 className="h-3 w-3" /> Would grant {formatBDT(e.payout)} (turnover {formatBDT(e.turnoverRequired)})
                        </p>
                      ) : (
                        <p className="mt-0.5 inline-flex items-center gap-1 text-xs text-signal-warn">
                          <XCircle className="h-3 w-3" /> Skipped: {e.reason}
                        </p>
                      )}
                    </div>
                    <Chip tone={e.status === 'active' ? 'ok' : 'neutral'}>{e.status}</Chip>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
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
