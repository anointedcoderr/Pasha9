// Built by Anointed Coder.
//
// M2H Player Recovery CRM. Three tabs:
//   Tasks        live queue. Filters by status, ruleId, mine-only.
//                Per row: Claim (lock + lockedUntil), Release,
//                Record Attempt drawer (channel + outcome + notes,
//                optional close as won/lost/abandoned).
//                Duplicate-call lock prevents two staff working the
//                same row concurrently.
//   Rules        CRUD over RecoveryRule. Preview segment (dry-run)
//                + Materialize (idempotent task creation).
//   Performance  per-staff KPIs: attempts, unique tasks, won, lost,
//                conversion %, outcome breakdown.

'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { PageHeader } from '@/components/site/PageHeader';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { Modal, Drawer } from '@/components/ui/Modal';
import { FormField, Input, Textarea } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs';
import { HeartHandshake, Plus, RefreshCw, Pencil, Trash2, Stethoscope, Sparkles, Lock, Phone, MessageCircle, Mail, BarChart3, AlertCircle, CheckCircle2, XCircle, Ban, ListChecks, Settings2 } from 'lucide-react';
import { formatBDT } from '@/lib/utils/format';
import { cn } from '@/lib/utils/cn';

interface RuleRow {
  id: string;
  key: string | null;
  name: string;
  kind: string;
  threshold: number;
  segmentLabel: string | null;
  priority: number;
  status: string;
  autoCreateTasks: boolean;
  createdAt: string;
  updatedAt: string;
}

interface TaskRow {
  id: string;
  userId: string;
  username: string | null;
  phone: string | null;
  lastLoginAt: string | null;
  balance: number;
  lottoBalance: number;
  rule: { id: string; name: string; kind: string } | null;
  status: string;
  assignedToStaffId: string | null;
  assignedToStaffName: string | null;
  lockedByStaffId: string | null;
  lockedByStaffName: string | null;
  lockedUntil: string | null;
  lastAttemptAt: string | null;
  lastAttemptOutcome: string | null;
  attemptCount: number;
  closeReason: string | null;
  closedAt: string | null;
  closedByStaffName: string | null;
  createdAt: string;
}

interface PerformanceRow {
  staffId: string;
  staffUsername: string | null;
  totalAttempts: number;
  uniqueTasks: number;
  closedWon: number;
  closedLost: number;
  closedAbandoned: number;
  outcomeBreakdown: Record<string, number>;
  conversionRate: number;
}

interface AttemptRow {
  id: string;
  staffId: string;
  staffUsername: string | null;
  channel: string;
  outcome: string;
  notes: string | null;
  attemptedAt: string;
}

interface PreviewUser {
  id: string;
  username: string;
  phone: string | null;
  lastLoginAt: string | null;
  balance: number;
  totalApprovedDeposits: number;
  lastApprovedDepositAt: string | null;
}

const KINDS = [
  { key: 'no_login', label: 'No login since N days' },
  { key: 'no_deposit', label: 'No deposit since N days' },
  { key: 'no_bet', label: 'No bet/wager since N days' },
  { key: 'balance_below', label: 'Balance below N BDT' },
];

const CHANNELS = ['call', 'sms', 'whatsapp', 'email', 'other'] as const;
const OUTCOMES = ['no_answer', 'callback', 'not_interested', 'converted', 'wrong_number', 'other'] as const;

function statusTone(s: string): 'ok' | 'warn' | 'info' | 'danger' | 'neutral' {
  if (s === 'won') return 'ok';
  if (s === 'in_progress') return 'info';
  if (s === 'open') return 'warn';
  if (s === 'lost') return 'danger';
  if (s === 'abandoned') return 'neutral';
  return 'neutral';
}

function isLockedNow(t: TaskRow): boolean {
  if (!t.lockedByStaffId || !t.lockedUntil) return false;
  return new Date(t.lockedUntil).getTime() > Date.now();
}

export default function AdminRecoveryPage() {
  const [tab, setTab] = useState<'tasks' | 'rules' | 'performance'>('tasks');

  // Shared toast/error
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const flashToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 5000); };

  // Tasks state
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [tasksLoading, setTasksLoading] = useState(true);
  const [taskStatus, setTaskStatus] = useState<string>('open,in_progress');
  const [mineOnly, setMineOnly] = useState(false);
  const [taskRuleId, setTaskRuleId] = useState<string>('');
  const [taskQuery, setTaskQuery] = useState('');
  const [attemptTask, setAttemptTask] = useState<TaskRow | null>(null);
  const [sweepBusy, setSweepBusy] = useState(false);

  // Rules state
  const [rules, setRules] = useState<RuleRow[]>([]);
  const [rulesLoading, setRulesLoading] = useState(false);
  const [editor, setEditor] = useState<(Omit<RuleRow, 'id' | 'createdAt' | 'updatedAt'> & { id: string }) | null>(null);
  const [savingRule, setSavingRule] = useState(false);
  const [previewRule, setPreviewRule] = useState<RuleRow | null>(null);
  const [previewUsers, setPreviewUsers] = useState<PreviewUser[]>([]);
  const [previewBusy, setPreviewBusy] = useState(false);

  // Performance state
  const [perfRows, setPerfRows] = useState<PerformanceRow[]>([]);
  const [perfFrom, setPerfFrom] = useState('');
  const [perfTo, setPerfTo] = useState('');
  const [perfBusy, setPerfBusy] = useState(false);

  // Loaders
  const loadTasks = useCallback(async () => {
    setTasksLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (taskStatus) params.set('status', taskStatus);
      if (taskRuleId) params.set('ruleId', taskRuleId);
      if (mineOnly) params.set('assignedToMe', 'true');
      if (taskQuery.trim()) params.set('q', taskQuery.trim());
      const res = await fetch(`/api/admin/recovery/tasks?${params.toString()}`, { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message ?? data?.code ?? 'Failed to load tasks');
      setTasks(data.tasks as TaskRow[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load tasks');
    } finally {
      setTasksLoading(false);
    }
  }, [taskStatus, mineOnly, taskRuleId, taskQuery]);

  const loadRules = useCallback(async () => {
    setRulesLoading(true);
    try {
      const res = await fetch('/api/admin/recovery/rules', { cache: 'no-store' });
      const data = await res.json();
      if (res.ok) setRules(data.rules as RuleRow[]);
    } finally { setRulesLoading(false); }
  }, []);

  const loadPerformance = useCallback(async () => {
    setPerfBusy(true);
    try {
      const params = new URLSearchParams();
      if (perfFrom) params.set('from', new Date(perfFrom).toISOString());
      if (perfTo) params.set('to', new Date(perfTo).toISOString());
      const res = await fetch(`/api/admin/recovery/performance?${params.toString()}`, { cache: 'no-store' });
      const data = await res.json();
      if (res.ok) setPerfRows(data.rows as PerformanceRow[]);
    } finally { setPerfBusy(false); }
  }, [perfFrom, perfTo]);

  useEffect(() => { loadTasks(); loadRules(); }, [loadTasks, loadRules]);
  useEffect(() => { if (tab === 'performance') loadPerformance(); }, [tab, loadPerformance]);

  // Task actions
  const claim = async (t: TaskRow) => {
    const res = await fetch(`/api/admin/recovery/tasks/${t.id}/claim`, { method: 'POST' });
    const data = await res.json();
    if (res.ok) { flashToast(`Claimed task for ${t.username}.`); loadTasks(); }
    else if (data?.code === 'LOCKED_BY_OTHER') alert('Another staff is currently working this task.');
    else alert(data?.message ?? data?.code ?? 'Claim failed');
  };

  const release = async (t: TaskRow) => {
    const res = await fetch(`/api/admin/recovery/tasks/${t.id}/claim`, { method: 'DELETE' });
    if (res.ok) { flashToast(`Released ${t.username}.`); loadTasks(); }
  };

  const runSweep = async () => {
    setSweepBusy(true);
    try {
      const res = await fetch('/api/cron/recovery-sweep', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message ?? data?.code);
      flashToast(`Sweep: ${data.message}`);
      loadTasks();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Sweep failed');
    } finally { setSweepBusy(false); }
  };

  // Rule actions
  const saveRule = async () => {
    if (!editor) return;
    setSavingRule(true);
    setError(null);
    try {
      const isNew = editor.id === 'new';
      const url = isNew ? '/api/admin/recovery/rules' : `/api/admin/recovery/rules/${editor.id}`;
      const method = isNew ? 'POST' : 'PATCH';
      const res = await fetch(url, {
        method,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: editor.name,
          kind: editor.kind,
          threshold: Number(editor.threshold),
          key: editor.key?.trim() ? editor.key.trim() : null,
          segmentLabel: editor.segmentLabel?.trim() ? editor.segmentLabel.trim() : null,
          priority: Number(editor.priority),
          status: editor.status,
          autoCreateTasks: editor.autoCreateTasks,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message ?? data?.code ?? 'Save failed');
      setEditor(null);
      flashToast(isNew ? `Rule "${editor.name}" created.` : `Rule "${editor.name}" updated.`);
      loadRules();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally { setSavingRule(false); }
  };

  const deleteRule = async (r: RuleRow) => {
    if (!confirm(`Delete rule "${r.name}"? Open tasks for this rule must be closed first.`)) return;
    const res = await fetch(`/api/admin/recovery/rules/${r.id}`, { method: 'DELETE' });
    const data = await res.json().catch(() => ({}));
    if (res.ok) { flashToast(`Rule "${r.name}" deleted.`); loadRules(); }
    else alert(data?.message ?? data?.code ?? 'Delete failed');
  };

  const previewRuleSegment = async (r: RuleRow) => {
    setPreviewRule(r);
    setPreviewUsers([]);
    setPreviewBusy(true);
    try {
      const res = await fetch(`/api/admin/recovery/rules/${r.id}/preview?limit=200`, { cache: 'no-store' });
      const data = await res.json();
      if (res.ok) setPreviewUsers(data.users as PreviewUser[]);
    } finally { setPreviewBusy(false); }
  };

  const materializeRule = async (r: RuleRow) => {
    const res = await fetch(`/api/admin/recovery/rules/${r.id}/preview`, { method: 'POST' });
    const data = await res.json();
    if (res.ok) {
      flashToast(`Materialized: ${data.created} new task(s) (skipped ${data.skippedExisting} existing) from ${data.matched} matches.`);
      loadTasks();
    } else {
      alert(data?.message ?? data?.code ?? 'Materialize failed');
    }
  };

  // Memos
  const ruleFilterOptions = useMemo(() => [{ id: '', name: 'All rules' }, ...rules.map((r) => ({ id: r.id, name: r.name }))], [rules]);

  return (
    <>
      <PageHeader
        title="Player Recovery"
        subtitle="Inactivity rules, segments, recovery task queue with duplicate-call lock, staff performance"
        icon={<HeartHandshake className="h-5 w-5" />}
        action={
          <div className="flex gap-2">
            <Button variant="ghost" leftIcon={<RefreshCw className={cn('h-3.5 w-3.5', sweepBusy && 'animate-spin')} />} loading={sweepBusy} onClick={runSweep}>
              Run sweep
            </Button>
          </div>
        }
      />

      {toast ? <Card padding="md" className="mb-4"><p className="text-sm text-signal-ok">{toast}</p></Card> : null}
      {error ? <Card padding="md" className="mb-4"><p className="text-sm text-signal-danger">{error}</p></Card> : null}

      <Tabs value={tab} onValueChange={(v) => setTab(v as 'tasks' | 'rules' | 'performance')}>
        <TabsList>
          <TabsTrigger value="tasks"><ListChecks className="mr-1.5 h-3.5 w-3.5" /> Tasks</TabsTrigger>
          <TabsTrigger value="rules"><Settings2 className="mr-1.5 h-3.5 w-3.5" /> Rules</TabsTrigger>
          <TabsTrigger value="performance"><BarChart3 className="mr-1.5 h-3.5 w-3.5" /> Performance</TabsTrigger>
        </TabsList>

        <TabsContent value="tasks">
          <Card padding="md" className="mb-3">
            <div className="flex flex-wrap items-end gap-3">
              <FormField label="Status">
                <Select value={taskStatus} onChange={(e) => setTaskStatus(e.target.value)}>
                  <option value="open,in_progress">Open + In progress</option>
                  <option value="open">Open only</option>
                  <option value="in_progress">In progress only</option>
                  <option value="won">Won</option>
                  <option value="lost">Lost</option>
                  <option value="abandoned">Abandoned</option>
                  <option value="all">All</option>
                </Select>
              </FormField>
              <FormField label="Rule">
                <Select value={taskRuleId} onChange={(e) => setTaskRuleId(e.target.value)}>
                  {ruleFilterOptions.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                </Select>
              </FormField>
              <FormField label="Search user">
                <Input value={taskQuery} onChange={(e) => setTaskQuery(e.target.value)} placeholder="username or phone" />
              </FormField>
              <label className="mt-6 inline-flex items-center gap-2 text-xs text-ink-mid">
                <input type="checkbox" checked={mineOnly} onChange={(e) => setMineOnly(e.target.checked)} />
                Mine only
              </label>
              <Button leftIcon={<RefreshCw className="h-3.5 w-3.5" />} onClick={loadTasks}>Apply</Button>
            </div>
          </Card>

          {tasksLoading ? (
            <p className="text-sm text-ink-mid">Loading tasks...</p>
          ) : tasks.length === 0 ? (
            <Card padding="lg">
              <p className="text-sm text-ink-mid">No tasks match the current filter.</p>
              <p className="mt-2 text-xs text-ink-lo">Tasks appear here once a rule is materialized (Rules tab . Materialize) or the cron sweep fires for an auto-create rule.</p>
            </Card>
          ) : (
            <Card padding="md" className="overflow-x-auto">
              <table className="w-full min-w-[1100px] text-sm">
                <thead className="text-xs uppercase tracking-wider text-ink-lo">
                  <tr>
                    <th className="px-2 py-2 text-left">Player</th>
                    <th className="px-2 py-2 text-left">Rule</th>
                    <th className="px-2 py-2 text-left">Status</th>
                    <th className="px-2 py-2 text-left">Last login</th>
                    <th className="px-2 py-2 text-right">Balance</th>
                    <th className="px-2 py-2 text-left">Attempts</th>
                    <th className="px-2 py-2 text-left">Locked</th>
                    <th className="px-2 py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {tasks.map((t) => {
                    const locked = isLockedNow(t);
                    return (
                      <tr key={t.id} className="border-t border-neon/10 align-top">
                        <td className="px-2 py-2">
                          <p className="font-semibold text-ink-hi">{t.username ?? t.userId.slice(0, 6)}</p>
                          {t.phone ? <p className="text-xs text-ink-lo">{t.phone}</p> : null}
                        </td>
                        <td className="px-2 py-2 text-xs">
                          {t.rule ? <>
                            <p className="font-medium text-ink-mid">{t.rule.name}</p>
                            <p className="text-ink-lo">{t.rule.kind}</p>
                          </> : <span className="text-ink-lo">manual</span>}
                        </td>
                        <td className="px-2 py-2">
                          <Chip tone={statusTone(t.status)}>{t.status}</Chip>
                          {t.lastAttemptOutcome ? <p className="mt-1 text-[10px] text-ink-lo">last: {t.lastAttemptOutcome}</p> : null}
                        </td>
                        <td className="px-2 py-2 text-xs text-ink-lo">{t.lastLoginAt ? new Date(t.lastLoginAt).toLocaleDateString() : 'never'}</td>
                        <td className="px-2 py-2 text-right font-mono">{formatBDT(t.balance)}</td>
                        <td className="px-2 py-2 text-xs">
                          <span className="font-semibold text-ink-hi">{t.attemptCount}</span>
                          {t.lastAttemptAt ? <p className="text-[10px] text-ink-lo">{new Date(t.lastAttemptAt).toLocaleString()}</p> : null}
                        </td>
                        <td className="px-2 py-2 text-xs">
                          {locked ? (
                            <span className="inline-flex items-center gap-1 text-signal-warn">
                              <Lock className="h-3 w-3" /> {t.lockedByStaffName ?? '?'}
                            </span>
                          ) : <span className="text-ink-lo">free</span>}
                        </td>
                        <td className="px-2 py-2 text-right">
                          {t.status === 'open' || t.status === 'in_progress' ? (
                            <div className="inline-flex gap-1">
                              {locked ? (
                                <Button size="sm" variant="ghost" leftIcon={<Lock className="h-3.5 w-3.5" />} onClick={() => release(t)}>Release</Button>
                              ) : (
                                <Button size="sm" variant="neon" leftIcon={<Phone className="h-3.5 w-3.5" />} onClick={() => claim(t)}>Claim</Button>
                              )}
                              <Button size="sm" leftIcon={<MessageCircle className="h-3.5 w-3.5" />} onClick={() => setAttemptTask(t)}>Record</Button>
                            </div>
                          ) : (
                            <span className="text-xs text-ink-lo">closed{t.closedByStaffName ? ` by ${t.closedByStaffName}` : ''}</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="rules">
          <div className="mb-3 flex justify-end">
            <Button leftIcon={<Plus className="h-4 w-4" />} onClick={() => setEditor({
              id: 'new', key: '', name: '', kind: 'no_login', threshold: 7,
              segmentLabel: '', priority: 0, status: 'active', autoCreateTasks: false,
            })}>New rule</Button>
          </div>
          {rulesLoading ? (
            <p className="text-sm text-ink-mid">Loading rules...</p>
          ) : rules.length === 0 ? (
            <Card padding="lg">
              <p className="text-sm text-ink-mid">No recovery rules yet. Click <b>New rule</b> to define one (e.g. &quot;No login since 7 days&quot;).</p>
              <p className="mt-2 text-xs text-ink-lo">Rules with <b>autoCreateTasks=true</b> spawn tasks automatically on every cron sweep.</p>
            </Card>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {rules.map((r) => (
                <Card key={r.id} padding="lg">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs uppercase tracking-wider text-gold-300">{r.kind}{r.key ? ` . ${r.key}` : ''}</p>
                      <p className="mt-1 text-sm font-semibold text-ink-hi">{r.name}</p>
                      {r.segmentLabel ? <p className="mt-0.5 text-xs text-ink-mid">{r.segmentLabel}</p> : null}
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <Chip tone={r.status === 'active' ? 'ok' : r.status === 'paused' ? 'warn' : 'neutral'}>{r.status}</Chip>
                      {r.autoCreateTasks ? <Chip tone="info">auto</Chip> : null}
                    </div>
                  </div>
                  <dl className="mt-3 grid grid-cols-3 gap-2 text-xs">
                    <Field label="Threshold" value={r.kind === 'balance_below' ? formatBDT(r.threshold) : `${r.threshold} d`} />
                    <Field label="Priority" value={String(r.priority)} />
                    <Field label="Auto" value={r.autoCreateTasks ? 'yes' : 'no'} />
                  </dl>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button size="sm" variant="neon" leftIcon={<Stethoscope className="h-3.5 w-3.5" />} onClick={() => previewRuleSegment(r)}>Preview</Button>
                    <Button size="sm" variant="gold" leftIcon={<Sparkles className="h-3.5 w-3.5" />} onClick={() => materializeRule(r)}>Materialize</Button>
                    <Button size="sm" variant="ghost" leftIcon={<Pencil className="h-3.5 w-3.5" />} onClick={() => setEditor({
                      id: r.id, key: r.key ?? '', name: r.name, kind: r.kind, threshold: r.threshold,
                      segmentLabel: r.segmentLabel ?? '', priority: r.priority, status: r.status, autoCreateTasks: r.autoCreateTasks,
                    })}>Edit</Button>
                    <Button size="sm" variant="ghost" leftIcon={<Trash2 className="h-3.5 w-3.5" />} onClick={() => deleteRule(r)}>Delete</Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="performance">
          <Card padding="md" className="mb-3">
            <div className="flex flex-wrap items-end gap-3">
              <FormField label="From">
                <Input type="datetime-local" value={perfFrom} onChange={(e) => setPerfFrom(e.target.value)} />
              </FormField>
              <FormField label="To">
                <Input type="datetime-local" value={perfTo} onChange={(e) => setPerfTo(e.target.value)} />
              </FormField>
              <Button loading={perfBusy} leftIcon={<RefreshCw className="h-3.5 w-3.5" />} onClick={loadPerformance}>Apply</Button>
            </div>
          </Card>
          {perfRows.length === 0 ? (
            <Card padding="lg"><p className="text-sm text-ink-mid">No staff attempts in the selected window.</p></Card>
          ) : (
            <Card padding="md" className="overflow-x-auto">
              <table className="w-full min-w-[800px] text-sm">
                <thead className="text-xs uppercase tracking-wider text-ink-lo">
                  <tr>
                    <th className="px-2 py-2 text-left">Staff</th>
                    <th className="px-2 py-2 text-right">Attempts</th>
                    <th className="px-2 py-2 text-right">Unique tasks</th>
                    <th className="px-2 py-2 text-right">Won</th>
                    <th className="px-2 py-2 text-right">Lost</th>
                    <th className="px-2 py-2 text-right">Abandoned</th>
                    <th className="px-2 py-2 text-right">Conversion %</th>
                    <th className="px-2 py-2 text-left">Outcomes</th>
                  </tr>
                </thead>
                <tbody>
                  {perfRows.map((r) => (
                    <tr key={r.staffId} className="border-t border-neon/10">
                      <td className="px-2 py-2 font-semibold text-ink-hi">{r.staffUsername ?? r.staffId.slice(0, 8)}</td>
                      <td className="px-2 py-2 text-right">{r.totalAttempts}</td>
                      <td className="px-2 py-2 text-right">{r.uniqueTasks}</td>
                      <td className="px-2 py-2 text-right text-signal-ok">{r.closedWon}</td>
                      <td className="px-2 py-2 text-right text-signal-danger">{r.closedLost}</td>
                      <td className="px-2 py-2 text-right text-ink-lo">{r.closedAbandoned}</td>
                      <td className="px-2 py-2 text-right font-mono">{r.conversionRate}%</td>
                      <td className="px-2 py-2 text-xs text-ink-mid">
                        {Object.entries(r.outcomeBreakdown).map(([k, v]) => `${k}=${v}`).join(' ; ')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      <Modal open={!!editor} onOpenChange={(v) => !v && setEditor(null)} title={editor?.id === 'new' ? 'New recovery rule' : 'Edit recovery rule'} size="lg">
        {editor ? (
          <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); void saveRule(); }}>
            <div className="grid gap-3 md:grid-cols-2">
              <FormField label="Name" required>
                <Input value={editor.name} onChange={(e) => setEditor({ ...editor, name: e.target.value })} placeholder="e.g. Sleeping 7+ days" />
              </FormField>
              <FormField label="Kind" required hint="Drives the segment query.">
                <Select value={editor.kind} onChange={(e) => setEditor({ ...editor, kind: e.target.value })}>
                  {KINDS.map((k) => <option key={k.key} value={k.key}>{k.label}</option>)}
                </Select>
              </FormField>
              <FormField label="Threshold" required hint={editor.kind === 'balance_below' ? 'BDT amount.' : 'Days.'}>
                <Input type="number" min={0} value={editor.threshold} onChange={(e) => setEditor({ ...editor, threshold: Number(e.target.value) })} />
              </FormField>
              <FormField label="Priority" hint="Higher rules run first in the sweep.">
                <Input type="number" min={0} value={editor.priority} onChange={(e) => setEditor({ ...editor, priority: Number(e.target.value) })} />
              </FormField>
              <FormField label="Status">
                <Select value={editor.status} onChange={(e) => setEditor({ ...editor, status: e.target.value })}>
                  <option value="active">active</option>
                  <option value="paused">paused</option>
                  <option value="hidden">hidden</option>
                </Select>
              </FormField>
              <FormField label="Stable key (optional)" hint="Letters, digits, underscore. Lookup-friendly.">
                <Input value={editor.key ?? ''} onChange={(e) => setEditor({ ...editor, key: e.target.value })} placeholder="e.g. sleeper_7d" />
              </FormField>
              <FormField label="Segment label (optional)" hint="Short tag shown in lists.">
                <Input value={editor.segmentLabel ?? ''} onChange={(e) => setEditor({ ...editor, segmentLabel: e.target.value })} placeholder="e.g. Sleeping 7+ days" />
              </FormField>
            </div>
            <label className="flex items-center gap-2 text-sm text-ink-mid">
              <input type="checkbox" checked={editor.autoCreateTasks} onChange={(e) => setEditor({ ...editor, autoCreateTasks: e.target.checked })} />
              Auto-create tasks on every cron sweep (idempotent; existing open tasks for the rule are skipped).
            </label>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" type="button" onClick={() => setEditor(null)}>Cancel</Button>
              <Button type="submit" variant="gold" loading={savingRule} disabled={!editor.name.trim()}>Save</Button>
            </div>
          </form>
        ) : null}
      </Modal>

      <Modal open={!!previewRule} onOpenChange={(v) => !v && setPreviewRule(null)} title={previewRule ? `Preview: ${previewRule.name}` : ''} size="lg">
        {previewRule ? (
          <div className="space-y-3">
            <p className="text-xs text-ink-mid">
              Dry-run for <code className="font-mono">{previewRule.kind}</code> with threshold {previewRule.kind === 'balance_below' ? formatBDT(previewRule.threshold) : `${previewRule.threshold} d`}. No tasks are created here.
            </p>
            {previewBusy ? (
              <p className="text-sm text-ink-mid">Evaluating segment...</p>
            ) : previewUsers.length === 0 ? (
              <Card padding="md"><p className="text-sm text-ink-mid">Zero users match this rule right now.</p></Card>
            ) : (
              <Card padding="none" className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="text-xs uppercase tracking-wider text-ink-lo">
                    <tr>
                      <th className="px-3 py-2 text-left">User</th>
                      <th className="px-3 py-2 text-left">Last login</th>
                      <th className="px-3 py-2 text-right">Balance</th>
                      <th className="px-3 py-2 text-right">Total deposits</th>
                      <th className="px-3 py-2 text-left">Last deposit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewUsers.slice(0, 100).map((u) => (
                      <tr key={u.id} className="border-t border-neon/10">
                        <td className="px-3 py-2">
                          <p className="font-semibold text-ink-hi">{u.username}</p>
                          {u.phone ? <p className="text-xs text-ink-lo">{u.phone}</p> : null}
                        </td>
                        <td className="px-3 py-2 text-xs text-ink-lo">{u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString() : 'never'}</td>
                        <td className="px-3 py-2 text-right font-mono">{formatBDT(u.balance)}</td>
                        <td className="px-3 py-2 text-right font-mono">{formatBDT(u.totalApprovedDeposits)}</td>
                        <td className="px-3 py-2 text-xs text-ink-lo">{u.lastApprovedDepositAt ? new Date(u.lastApprovedDepositAt).toLocaleDateString() : 'none'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {previewUsers.length > 100 ? <p className="px-3 py-2 text-xs text-ink-lo">+{previewUsers.length - 100} more</p> : null}
              </Card>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={() => setPreviewRule(null)}>Close</Button>
              <Button variant="gold" leftIcon={<Sparkles className="h-3.5 w-3.5" />} onClick={() => { void materializeRule(previewRule); setPreviewRule(null); }}>
                Materialize ({previewUsers.length})
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>

      <Drawer
        open={!!attemptTask}
        onOpenChange={(v) => { if (!v) setAttemptTask(null); }}
        title={attemptTask ? `Record attempt . ${attemptTask.username}` : ''}
        description="Log every call/sms/whatsapp/email. Optional close on conversion or exhaustion."
        width="520px"
      >
        {attemptTask ? <AttemptForm task={attemptTask} onDone={(msg) => { setAttemptTask(null); flashToast(msg); loadTasks(); }} onClose={() => setAttemptTask(null)} /> : null}
      </Drawer>
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

function AttemptForm({ task, onDone, onClose }: { task: TaskRow; onDone: (msg: string) => void; onClose: () => void }) {
  const [channel, setChannel] = useState<typeof CHANNELS[number]>('call');
  const [outcome, setOutcome] = useState<typeof OUTCOMES[number]>('no_answer');
  const [notes, setNotes] = useState('');
  const [closeAs, setCloseAs] = useState<'' | 'won' | 'lost' | 'abandoned'>('');
  const [closeReason, setCloseReason] = useState('');
  const [history, setHistory] = useState<AttemptRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/admin/recovery/tasks/${task.id}/attempts`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { if (Array.isArray(data?.attempts)) setHistory(data.attempts as AttemptRow[]); });
  }, [task.id]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/recovery/tasks/${task.id}/attempts`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          channel,
          outcome,
          notes: notes.trim() || undefined,
          closeAs: closeAs || undefined,
          closeReason: closeReason.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data?.code === 'LOCKED_BY_OTHER') throw new Error('Another staff currently holds this task.');
        if (data?.code === 'TASK_CLOSED') throw new Error('Task is already closed.');
        throw new Error(data?.message ?? data?.code ?? 'Record failed');
      }
      onDone(`Recorded ${channel}/${outcome} for ${task.username}${closeAs ? ` and closed as ${closeAs}` : ''}.`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Record failed');
    } finally { setBusy(false); }
  };

  const channelIcon = (c: string) => c === 'call' ? <Phone className="h-3 w-3" /> : c === 'sms' || c === 'whatsapp' ? <MessageCircle className="h-3 w-3" /> : c === 'email' ? <Mail className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />;
  const outcomeChip = (o: string): 'ok' | 'warn' | 'danger' | 'neutral' => o === 'converted' ? 'ok' : o === 'no_answer' || o === 'callback' ? 'warn' : o === 'not_interested' || o === 'wrong_number' ? 'danger' : 'neutral';

  return (
    <form className="space-y-4" onSubmit={submit}>
      <div className="rounded-lg border border-neon/10 bg-base-deep/40 p-3 text-xs">
        <p className="text-ink-mid">Player <span className="font-semibold text-ink-hi">{task.username}</span> . phone <span className="font-mono">{task.phone ?? '?'}</span></p>
        <p className="text-ink-lo">Balance {formatBDT(task.balance)} . attempts so far: {task.attemptCount}</p>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <FormField label="Channel" required>
          <Select value={channel} onChange={(e) => setChannel(e.target.value as typeof CHANNELS[number])}>
            {CHANNELS.map((c) => <option key={c} value={c}>{c}</option>)}
          </Select>
        </FormField>
        <FormField label="Outcome" required>
          <Select value={outcome} onChange={(e) => setOutcome(e.target.value as typeof OUTCOMES[number])}>
            {OUTCOMES.map((o) => <option key={o} value={o}>{o}</option>)}
          </Select>
        </FormField>
      </div>
      <FormField label="Notes (optional)">
        <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Free text. Visible to other recovery staff on this task." />
      </FormField>

      <div className="rounded-lg border border-neon/10 bg-base-deep/40 p-3">
        <p className="text-xs text-ink-mid">Optional: close the task now</p>
        <div className="mt-2 grid gap-3 md:grid-cols-2">
          <FormField label="Close as">
            <Select value={closeAs} onChange={(e) => setCloseAs(e.target.value as '' | 'won' | 'lost' | 'abandoned')}>
              <option value="">leave open</option>
              <option value="won">won (converted)</option>
              <option value="lost">lost (no conversion)</option>
              <option value="abandoned">abandoned (skip)</option>
            </Select>
          </FormField>
          {closeAs ? (
            <FormField label="Close reason (optional)">
              <Input value={closeReason} onChange={(e) => setCloseReason(e.target.value)} placeholder="Short note for audit" />
            </FormField>
          ) : null}
        </div>
      </div>

      {err ? <p className="text-sm text-signal-danger">{err}</p> : null}
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
        <Button type="submit" variant="gold" loading={busy}>Record attempt</Button>
      </div>

      <div className="border-t border-neon/10 pt-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-ink-lo">Timeline</p>
        {history.length === 0 ? (
          <p className="mt-2 text-xs text-ink-lo">No attempts logged yet.</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {history.map((h) => (
              <li key={h.id} className="rounded-lg border border-neon/10 bg-base-deep/40 p-2.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1 text-ink-mid">{channelIcon(h.channel)} {h.channel}</span>
                  <Chip tone={outcomeChip(h.outcome)}>{h.outcome}</Chip>
                </div>
                <p className="mt-1 text-ink-lo">
                  {new Date(h.attemptedAt).toLocaleString()} . by <span className="text-ink-mid">{h.staffUsername ?? h.staffId.slice(0, 6)}</span>
                </p>
                {h.notes ? <p className="mt-1 text-ink-mid">{h.notes}</p> : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </form>
  );
}
