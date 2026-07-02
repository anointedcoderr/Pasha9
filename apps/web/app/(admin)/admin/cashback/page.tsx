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
import { ConfirmDialog } from '@/components/admin/ConfirmDialog';
import { TrendingUp, Plus, Pencil, Trash2, Play, AlertCircle, CheckCircle2 } from 'lucide-react';

type ScopeType = 'all' | 'match';

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
  scopeType: ScopeType;
  scopeKeys: string[];
  bonusRuleId: string | null;
  payoutCount: number;
}

// Predefined scope keys the operator can pick from. The list maps to
// the meta.scope values the bet/win writers stamp on Transaction rows.
// Native games stamp 'casino'; sports/live providers stamp their own
// keys when integrated. The free-form chip input below lets the
// operator add provider-specific keys ahead of integration.
const PREDEFINED_SCOPES = [
  { key: 'casino', labelEn: 'Casino', labelBn: 'ক্যাসিনো' },
  { key: 'live_casino', labelEn: 'Live Casino', labelBn: 'লাইভ ক্যাসিনো' },
  { key: 'sports', labelEn: 'Sports Betting', labelBn: 'স্পোর্টস বেটিং' },
  { key: 'slots', labelEn: 'Slots', labelBn: 'স্লট' },
  { key: 'fish', labelEn: 'Fishing', labelBn: 'ফিশিং' },
] as const;

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
  // True when the engine ran in preview mode: nothing was written and
  // paidUsers/totalCashback describe what WOULD be paid.
  dryRun?: boolean;
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
  scopeType: 'all',
  scopeKeys: [],
  bonusRuleId: null,
  payoutCount: 0,
};

// Formats an ISO timestamp for a datetime-local input in the
// OPERATOR'S LOCAL TIME. The previous toISOString().slice(0, 16)
// produced UTC, so every edit prefilled 6 hours behind Dhaka time and
// re-saving silently shifted the campaign window.
function toLocalInput(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function AdminCashbackPage() {
  const [list, setList] = useState<CampaignRow[]>([]);
  const [rules, setRules] = useState<BonusRuleOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [editor, setEditor] = useState<CampaignRow | null>(null);
  // Save failures render INSIDE the editor modal; the page error card
  // sits behind the open modal overlay.
  const [editorError, setEditorError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [runResult, setRunResult] = useState<{ campaign: CampaignRow; result: RunResult } | null>(null);
  const [runTarget, setRunTarget] = useState<CampaignRow | null>(null);
  const [runBusy, setRunBusy] = useState(false);
  // Run failures render INSIDE the run modal. The page-level error card
  // sits behind the open modal, so a failed run looked like nothing
  // happened; this state keeps the failure visible to the operator.
  const [runError, setRunError] = useState<string | null>(null);
  // Delete confirmation lives in an in-page modal. The native
  // confirm() this page used before is silently suppressed inside
  // installed PWAs / in-app webviews, so the Delete button looked
  // dead: no dialog, no request, no error.
  const [deleteTarget, setDeleteTarget] = useState<CampaignRow | null>(null);

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
    setEditorError(null);
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
      scopeType: editor.scopeType,
      scopeKeys: editor.scopeType === 'match' ? editor.scopeKeys : [],
    };
    try {
      const isNew = !editor.id;
      const res = isNew
        ? await fetch('/api/admin/cashback', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) })
        : await fetch(`/api/admin/cashback/${editor.id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? data.code ?? 'Save failed');
      setEditor(null);
      setToast(`Campaign "${editor.nameEn}" saved. ক্যাম্পেইনটি সংরক্ষণ করা হয়েছে।`);
      setTimeout(() => setToast(null), 4000);
      await refresh();
    } catch (e) {
      setEditorError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setBusy(false);
    }
  };

  // Runs after the operator confirms in the ConfirmDialog. The server
  // hard deletes only when the campaign never paid out; otherwise it
  // deactivates the campaign and says so, keeping the payout history.
  const remove = async (id: string) => {
    setError(null); setToast(null);
    try {
      const res = await fetch(`/api/admin/cashback/${id}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(`${data?.message ?? data?.code ?? 'Delete failed'} (Delete failed. ডিলিট ব্যর্থ হয়েছে।)`);
        return;
      }
      setToast(data?.archived
        ? (data?.message ?? 'Campaign deactivated because payouts exist. পেআউট থাকায় ক্যাম্পেইনটি নিষ্ক্রিয় করা হয়েছে।')
        : 'Campaign deleted. ক্যাম্পেইনটি মুছে ফেলা হয়েছে।');
      refresh();
    } catch {
      setError('Delete failed: network error. ডিলিট ব্যর্থ হয়েছে: নেটওয়ার্ক সমস্যা।');
    }
  };

  // Active switch on a campaign that pays real money: the outcome must
  // be visible. On failure the switch position is refreshed from the
  // server so it never lies about whether the campaign still pays.
  const toggleActive = async (c: CampaignRow) => {
    setError(null); setToast(null);
    try {
      const res = await fetch(`/api/admin/cashback/${c.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ isActive: !c.isActive }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.message ?? data?.code ?? 'Toggle failed');
      setToast(!c.isActive
        ? `Campaign "${c.nameEn}" activated. ক্যাম্পেইনটি সক্রিয় করা হয়েছে।`
        : `Campaign "${c.nameEn}" deactivated. ক্যাম্পেইনটি নিষ্ক্রিয় করা হয়েছে।`);
      setTimeout(() => setToast(null), 4000);
    } catch (e) {
      setError(`${e instanceof Error ? e.message : 'Toggle failed'} (Status change failed. স্ট্যাটাস পরিবর্তন ব্যর্থ হয়েছে।)`);
    } finally {
      refresh();
    }
  };

  // Two run modes:
  //   'scheduled' - posts {} exactly like today; the engine picks the
  //                 campaign default window (daily = the whole of
  //                 yesterday UTC), same window and period key as the
  //                 nightly cron. This is the only mode that pays.
  //   'preview'   - posts periodStart = today 00:00 UTC, periodEnd = now,
  //                 dryRun: true. The engine runs the identical
  //                 eligibility scan and per-user math but writes
  //                 NOTHING: no payout, wallet, bonus, transaction or
  //                 notification row. It exists so an operator can book a
  //                 test loss today and immediately SEE it detected,
  //                 while tonight's scheduled run stays the one and only
  //                 payer. This replaces the old paying "today so far"
  //                 mode that double-paid once the nightly cron ran.
  const executeRun = async (c: CampaignRow, windowMode: 'scheduled' | 'preview') => {
    setError(null);
    setRunError(null);
    setToast(null);
    setRunBusy(true);
    try {
      let body: { periodStart?: string; periodEnd?: string; dryRun?: boolean } = {};
      if (windowMode === 'preview') {
        const now = new Date();
        const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
        body = { periodStart: start.toISOString(), periodEnd: now.toISOString(), dryRun: true };
      }
      const res = await fetch(`/api/admin/cashback/${c.id}/run`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? data.code ?? 'Run failed');
      setRunTarget(null);
      setRunResult({ campaign: c, result: data });
      if (data.dryRun) {
        setToast(`Preview only: ${data.paidUsers} of ${data.eligibleUsers} eligible users would be paid, total ${Number(data.totalCashback).toLocaleString()} BDT. Nothing was paid. শুধুই প্রিভিউ: কোনো পেমেন্ট হয়নি।`);
      } else {
        setToast(`Paid ${data.paidUsers} of ${data.eligibleUsers} eligible users. Total ${Number(data.totalCashback).toLocaleString()} BDT.`);
        refresh();
      }
    } catch (err) {
      // Surface the failure inside the still-open run modal; the page
      // level error card is hidden behind the modal overlay.
      setRunError(err instanceof Error ? err.message : 'Run failed');
    } finally {
      setRunBusy(false);
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
                  {c.percentage}% . Cap {c.maxCashback ? `${c.maxCashback.toLocaleString()} BDT` : 'unlimited'} . Turnover {c.turnoverX || 0}x . Scope {c.scopeType === 'all' ? 'all games' : (c.scopeKeys.length > 0 ? c.scopeKeys.join(', ') : 'NONE')}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={c.isActive} onChange={() => toggleActive(c)} />
                <Button size="sm" variant="ghost" leftIcon={<Play className="h-3.5 w-3.5" />} onClick={() => { setRunError(null); setRunTarget(c); }}>
                  Run now
                </Button>
                <Button size="sm" variant="neon" leftIcon={<Pencil className="h-3.5 w-3.5" />} onClick={() => setEditor(c)}>
                  Edit
                </Button>
                <Button size="sm" variant="danger" leftIcon={<Trash2 className="h-3.5 w-3.5" />} onClick={() => setDeleteTarget(c)}>
                  Delete
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal open={!!editor} onOpenChange={(v) => { if (!v) { setEditor(null); setEditorError(null); } }} title={editor?.id ? 'Edit Campaign' : 'New Campaign'} size="lg">
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
              <FormField label="Turnover (x)" hint="0 = no wager lock. Positive values lock the cashback in balance until wagered.">
                <Input type="number" min="0" step="0.5" value={String(editor.turnoverX)} onChange={(e) => setEditor({ ...editor, turnoverX: Number(e.target.value) || 0 })} />
              </FormField>
            </div>

            {/* Scope picker. 'All games' is the default and matches every
                completed bet/win Transaction in the period. 'Specific scopes'
                lets the operator restrict the cashback base to a subset of
                game categories or providers - the engine filters
                Transaction.meta.scope against the configured keys. */}
            <FormField
              label="Apply to"
              hint="Choose which losses count toward this campaign's cashback."
            >
              <div className="space-y-3 rounded-xl border border-brand-divider bg-brand-paper p-3">
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setEditor({ ...editor, scopeType: 'all', scopeKeys: [] })}
                    className={
                      'inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-xs font-bold uppercase tracking-wider transition ' +
                      (editor.scopeType === 'all'
                        ? 'border-brand-yellow-500 bg-brand-yellow-500/15 text-brand-ink'
                        : 'border-brand-divider text-brand-inkSoft hover:text-brand-ink')
                    }
                  >
                    All games
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditor({ ...editor, scopeType: 'match' })}
                    className={
                      'inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-xs font-bold uppercase tracking-wider transition ' +
                      (editor.scopeType === 'match'
                        ? 'border-brand-yellow-500 bg-brand-yellow-500/15 text-brand-ink'
                        : 'border-brand-divider text-brand-inkSoft hover:text-brand-ink')
                    }
                  >
                    Specific scopes
                  </button>
                </div>

                {editor.scopeType === 'match' ? (
                  <div className="space-y-2">
                    <div className="flex flex-wrap gap-2">
                      {PREDEFINED_SCOPES.map((s) => {
                        const checked = editor.scopeKeys.includes(s.key);
                        return (
                          <button
                            type="button"
                            key={s.key}
                            onClick={() => setEditor({
                              ...editor,
                              scopeKeys: checked
                                ? editor.scopeKeys.filter((k) => k !== s.key)
                                : [...editor.scopeKeys, s.key],
                            })}
                            className={
                              'inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[11px] font-semibold transition ' +
                              (checked
                                ? 'border-emerald-500 bg-emerald-500/15 text-emerald-200'
                                : 'border-brand-divider text-brand-inkSoft hover:text-brand-ink')
                            }
                          >
                            {checked ? <CheckCircle2 className="h-3.5 w-3.5" /> : null}
                            {s.labelEn}
                          </button>
                        );
                      })}
                    </div>

                    {/* Free-form provider/extra-key input. Operator types
                        a scope key (e.g. "jili", "pgsoft", "evolution")
                        and presses Enter to add it. */}
                    <FreeFormScopeInput
                      values={editor.scopeKeys.filter((k) => !PREDEFINED_SCOPES.some((p) => p.key === k))}
                      onAdd={(v) => {
                        if (editor.scopeKeys.includes(v)) return;
                        setEditor({ ...editor, scopeKeys: [...editor.scopeKeys, v] });
                      }}
                      onRemove={(v) => setEditor({ ...editor, scopeKeys: editor.scopeKeys.filter((k) => k !== v) })}
                    />

                    <p className="text-[11px] text-brand-inkMute">
                      Bet/win Transactions must stamp <code className="font-mono">meta.scope</code> for the
                      filter to match. Native games already stamp <code className="font-mono">casino</code>;
                      external providers stamp their own scope when integrated. Empty list = no cashback paid.
                    </p>
                  </div>
                ) : (
                  <p className="text-[11px] text-brand-inkMute">
                    Cashback base sums every completed bet/win Transaction in the period, regardless of game type.
                  </p>
                )}
              </div>
            </FormField>
            <div className="grid gap-3 md:grid-cols-2">
              <FormField label="Starts at">
                <Input type="datetime-local" value={toLocalInput(editor.startsAt)} onChange={(e) => setEditor({ ...editor, startsAt: e.target.value || null })} />
              </FormField>
              <FormField label="Ends at">
                <Input type="datetime-local" value={toLocalInput(editor.endsAt)} onChange={(e) => setEditor({ ...editor, endsAt: e.target.value || null })} />
              </FormField>
            </div>
            {editorError ? (
              <p className="text-sm text-signal-danger">Save failed: {editorError} (সংরক্ষণ ব্যর্থ হয়েছে: {editorError})</p>
            ) : null}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" type="button" onClick={() => { setEditor(null); setEditorError(null); }}>Cancel</Button>
              <Button type="submit" loading={busy}>Save</Button>
            </div>
          </form>
        ) : null}
      </Modal>

      {/* Run-window picker. 'Scheduled period' sends {} (engine default
          window, identical to the nightly cron) and PAYS. 'Preview today
          so far' sends today-00:00-UTC..now with dryRun: true so an
          operator can verify a loss booked today is detected without
          paying anyone; tonight's cron stays the only payer. */}
      <Modal open={!!runTarget} onOpenChange={(v) => { if (!v && !runBusy) { setRunTarget(null); setRunError(null); } }} title={runTarget ? `Run cashback . ${runTarget.nameEn}` : ''} size="md">
        {runTarget ? (
          <div className="space-y-3">
            <p className="text-xs text-ink-mid">
              Choose the period window. Each player is paid at most once per period key; duplicates are skipped automatically.
              {' '}<span className="text-ink-lo">সময়কাল নির্বাচন করুন। প্রতি পিরিয়ড কী-তে একজন খেলোয়াড় সর্বোচ্চ একবার পেমেন্ট পাবেন; ডুপ্লিকেট স্বয়ংক্রিয়ভাবে বাদ যাবে।</span>
            </p>
            {runError ? (
              <div className="rounded-xl border border-signal-danger/50 bg-brand-paper p-3">
                <p className="text-xs text-signal-danger">
                  <AlertCircle className="mr-1 inline h-3.5 w-3.5" />
                  Run failed: {runError} (রান ব্যর্থ হয়েছে: {runError})
                </p>
              </div>
            ) : null}
            <button
              type="button"
              disabled={runBusy}
              onClick={() => executeRun(runTarget, 'scheduled')}
              className="w-full rounded-xl border border-brand-divider bg-brand-paper p-3 text-left transition hover:border-brand-yellow-500 disabled:opacity-50"
            >
              <p className="text-sm font-semibold text-ink-hi">Scheduled period (নির্ধারিত সময়কাল)</p>
              <p className="mt-1 text-[11px] text-ink-lo">
                {runTarget.cadence === 'daily'
                  ? 'Pays for the whole of YESTERDAY, 00:00 to 00:00 UTC. Same window and period key the nightly cron uses; losses booked today are not included yet. আগের দিনের পুরো সময়ের (UTC) জন্য পেমেন্ট হবে, রাতের স্বয়ংক্রিয় রানের মতোই; আজকের ক্ষতি এখনো অন্তর্ভুক্ত নয়।'
                  : `Pays for the previous ${runTarget.cadence === 'monthly' ? 'month' : '7 days'} ending now, same as the scheduled run. নির্ধারিত রানের মতো একই সময়কালের জন্য পেমেন্ট হবে।`}
              </p>
            </button>
            <button
              type="button"
              disabled={runBusy}
              onClick={() => executeRun(runTarget, 'preview')}
              className="w-full rounded-xl border border-sky-500/60 bg-brand-paper p-3 text-left transition hover:border-sky-400 disabled:opacity-50"
            >
              <p className="text-sm font-semibold text-ink-hi">Preview today so far, no payment (আজ এখন পর্যন্ত প্রিভিউ, কোনো পেমেন্ট হবে না)</p>
              <p className="mt-1 text-[11px] text-sky-500">
                Only SHOWS who would be paid for losses from today 00:00 UTC until now. Nothing is written and no player receives money; the nightly scheduled run makes the real payment. শুধুমাত্র দেখায় আজ ০০:০০ UTC থেকে এখন পর্যন্ত ক্ষতির জন্য কে পেমেন্ট পেতেন। কিছুই লেখা হয় না, কোনো খেলোয়াড় টাকা পান না; আসল পেমেন্ট রাতের নির্ধারিত রানেই হবে।
              </p>
            </button>
            {runBusy ? <p className="text-xs text-ink-lo">Running... চলছে...</p> : null}
          </div>
        ) : null}
      </Modal>

      <Modal open={!!runResult} onOpenChange={(v) => !v && setRunResult(null)} title={runResult ? (runResult.result.dryRun ? `Preview result . ${runResult.campaign.nameEn}` : `Run result . ${runResult.campaign.nameEn}`) : ''} size="lg">
        {runResult ? (
          <div className="space-y-3">
            {runResult.result.dryRun ? (
              <div className="rounded-xl border border-sky-500/60 bg-sky-500/10 p-3">
                <p className="text-xs font-semibold text-sky-400">
                  Preview only, nothing was paid. The nightly scheduled run makes the real payment.
                  {' '}শুধুই প্রিভিউ, কোনো পেমেন্ট হয়নি। আসল পেমেন্ট রাতের নির্ধারিত রানেই হবে।
                </p>
              </div>
            ) : null}
            <p className="text-xs text-ink-mid">
              Period: <code>{runResult.result.periodKey}</code> ({new Date(runResult.result.periodStart).toLocaleString()} to {new Date(runResult.result.periodEnd).toLocaleString()}).
              {' '}{runResult.result.dryRun
                ? <>Would pay {runResult.result.paidUsers}/{runResult.result.eligibleUsers} eligible users, total {Number(runResult.result.totalCashback).toLocaleString()} BDT. পেমেন্ট হলে {runResult.result.paidUsers} জন খেলোয়াড় পেতেন।</>
                : <>Paid {runResult.result.paidUsers}/{runResult.result.eligibleUsers} eligible users. Total {Number(runResult.result.totalCashback).toLocaleString()} BDT.</>}
            </p>
            <div className="max-h-[50vh] space-y-1 overflow-y-auto">
              {runResult.result.lines.map((line) => (
                <div key={line.userId} className="flex items-center justify-between gap-2 rounded border border-brand-divider bg-brand-paper px-3 py-1.5 text-xs">
                  <code className="font-mono text-ink-lo">{line.userId}</code>
                  <div className="flex items-center gap-2">
                    <span className="text-ink-lo">base {Number(line.baseAmount).toLocaleString()}</span>
                    <Chip tone={line.status === 'granted' ? 'ok' : line.status === 'failed' ? 'warn' : 'neutral'}>
                      {runResult.result.dryRun && line.status === 'granted'
                        ? 'would pay (পেমেন্ট হতো)'
                        : runResult.result.dryRun && line.status === 'skipped_duplicate' && runResult.campaign.cadence === 'daily'
                          ? 'paid earlier today; tonight can still pay (আজ আগে পেমেন্ট হয়েছে; রাতের রানে আবার হতে পারে)'
                          : line.status.replace('_', ' ')}
                    </Chip>
                    {line.cashbackAmount > 0 ? <span className="font-bold text-brand-yellow-700">+{Number(line.cashbackAmount).toLocaleString()}</span> : null}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(v) => !v && setDeleteTarget(null)}
        title="Delete cashback campaign"
        message={deleteTarget ? `Delete campaign "${deleteTarget.nameEn}"? If payouts were already issued, the campaign will be deactivated instead so the money history stays intact.` : ''}
        messageBn={deleteTarget ? `"${deleteTarget.nameBn || deleteTarget.nameEn}" ক্যাম্পেইনটি মুছে ফেলবেন? ইতিমধ্যে পেআউট হয়ে থাকলে টাকার হিসাব রক্ষা করতে এটি মুছে না ফেলে নিষ্ক্রিয় করা হবে।` : ''}
        confirmLabel="Delete"
        onConfirm={async () => {
          if (deleteTarget) await remove(deleteTarget.id);
          setDeleteTarget(null);
        }}
      />
    </>
  );
}

function FreeFormScopeInput({ values, onAdd, onRemove }: { values: string[]; onAdd: (v: string) => void; onRemove: (v: string) => void }) {
  const [draft, setDraft] = useState('');
  const commit = () => {
    const v = draft.trim().toLowerCase().replace(/[^a-z0-9:_\-]/g, '');
    if (!v) return;
    onAdd(v);
    setDraft('');
  };
  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-center gap-1.5">
        {values.map((v) => (
          <span key={v} className="inline-flex h-7 items-center gap-1 rounded-full border border-brand-divider bg-brand-surface px-2 text-[10px] font-bold uppercase tracking-wider text-brand-ink">
            {v}
            <button type="button" onClick={() => onRemove(v)} className="text-rose-400 hover:text-rose-300">
              x
            </button>
          </span>
        ))}
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              commit();
            }
          }}
          onBlur={commit}
          placeholder="Add provider key (e.g. jili) and press Enter"
          className="h-7 min-w-[180px] flex-1 rounded-md border border-brand-divider bg-brand-paper px-2 text-[11px] text-brand-ink placeholder:text-brand-inkMute focus:border-brand-yellow-500 focus:outline-none"
        />
      </div>
    </div>
  );
}
