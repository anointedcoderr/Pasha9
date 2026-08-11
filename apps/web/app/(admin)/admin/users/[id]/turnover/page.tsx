// Built by Anointed Coder.
//
// Operator control over one player's outstanding wagering requirement, plus
// the permanent history of every manual adjustment.
//
// Treated with the same seriousness as a balance change on purpose: lowering
// a requirement lets a player withdraw sooner, so it moves money in practice
// even though it never touches the wallet. Hence the required reason, the
// explicit before/after preview, and the confirmation step.

'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { PageHeader } from '@/components/site/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { StatTile } from '@/components/ui/StatTile';
import { EmptyState } from '@/components/ui/EmptyState';
import { formatBDT, formatDateTime } from '@/lib/utils/format';
import { useLang } from '@/lib/i18n/context';
import { Target, RefreshCw, AlertTriangle } from 'lucide-react';

interface Grant {
  id: string;
  sourceType: string | null;
  amount: number;
  required: number;
  progress: number;
  remaining: number;
}

interface HistoryRow {
  at: string;
  kind: string;
  change: number;
  before: number | null;
  after: number | null;
  reason: string | null;
  actorId: string | null;
  actorRole: string | null;
}

interface Part { required: number; completed: number; remaining: number }

interface TurnoverResponse {
  /** The player's TOTAL outstanding requirement, identical to what they see. */
  remaining: number;
  required: number;
  completed: number;
  isMet: boolean;
  breakdown: { deposit: Part; bettingPass: Part; referral: Part; spin: Part };
  /**
   * Only the part carried by bonus grants. The adjustment controls move these
   * and nothing else, so this, not the total, is what a preview must be based
   * on. Deposit turnover is a function of what the player deposited and cannot
   * be edited away here.
   */
  grantsRemaining: number;
  grants: Grant[];
  history: HistoryRow[];
}

type Mode = 'increase' | 'decrease' | 'set';

const MODES: Array<{ key: Mode; label: string }> = [
  { key: 'increase', label: 'Increase by' },
  { key: 'decrease', label: 'Decrease by' },
  { key: 'set', label: 'Set exactly to' },
];

export default function TurnoverPage() {
  const params = useParams<{ id: string }>();
  const userId = params?.id ?? '';
  const { lang } = useLang();

  const [data, setData] = useState<TurnoverResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [mode, setMode] = useState<Mode>('decrease');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');

  const load = useCallback(async () => {
    if (!userId) return;
    setError(null);
    try {
      const r = await fetch(`/api/admin/users/${userId}/turnover`, { cache: 'no-store', credentials: 'include' });
      const j = await r.json().catch(() => null);
      if (!r.ok) throw new Error(j?.message ?? j?.code ?? 'Failed to load');
      setData(j as TurnoverResponse);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  // Shown before the operator commits, so the effect of the change is never
  // a surprise - especially for "set", where the direction is not obvious
  // from the number typed.
  const preview = useMemo(() => {
    if (!data) return null;
    const n = Number(amount);
    if (!Number.isFinite(n) || amount.trim() === '') return null;
    // Bonus-grant requirement, not the total: an adjustment cannot move
    // deposit or betting pass turnover, so previewing against the total would
    // promise a result the save could not deliver.
    const before = data.grantsRemaining;
    const raw = mode === 'set' ? n : mode === 'increase' ? before + n : before - n;
    const after = Math.max(0, raw);
    return { before, after, change: after - before, clamped: raw < 0 };
  }, [data, amount, mode]);

  const canSubmit = Boolean(
    preview && reason.trim().length >= 3 && preview.change !== 0 && !saving,
  );

  const submit = async () => {
    if (!canSubmit) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const r = await fetch(`/api/admin/users/${userId}/turnover`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ mode, amount: Number(amount), reason: reason.trim() }),
      });
      const j = await r.json().catch(() => null);
      if (!r.ok) throw new Error(j?.message ?? j?.code ?? 'Adjustment failed');
      setNotice(
        j?.unchanged
          ? 'No change: the requirement was already at that value.'
          : `Requirement changed from ${formatBDT(j.turnover.before)} to ${formatBDT(j.turnover.after)}.`,
      );
      setAmount('');
      setReason('');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Adjustment failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Turnover Management"
        subtitle="Adjust a player's outstanding wagering requirement"
        icon={<Target className="h-5 w-5" />}
        back={{ href: '/admin/users', label: 'Users' }}
      />

      {loading ? (
        <Card padding="lg"><p className="text-sm text-ink-mid">Loading...</p></Card>
      ) : (
        <>
          <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <StatTile
              label="Remaining Requirement"
              value={formatBDT(data?.remaining ?? 0)}
              accent="gold"
              hint="Exactly what the player sees"
            />
            <StatTile label="Active Grants" value={String(data?.grants.length ?? 0)} />
            <StatTile label="Manual Adjustments" value={String(data?.history.length ?? 0)} hint="All time" />
          </div>

          {/*
            Where the total comes from. Without this an operator sees one
            number and no way to tell which part is outstanding, which is how
            a player blocked by deposit turnover looked like a player with no
            requirement at all.
          */}
          <Card padding="md" className="mb-4">
            <h2 className="mb-3 text-sm font-semibold text-ink-hi">
              Where this comes from
              <span className="ml-2 font-normal text-ink-lo">
                {data?.isMet ? 'Requirement met, withdrawal allowed' : 'Withdrawal blocked until met'}
              </span>
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-left text-sm">
                <thead className="text-xs uppercase text-ink-lo">
                  <tr className="border-b border-neon/10">
                    <th scope="col" className="py-2 pr-3 font-medium">Source</th>
                    <th scope="col" className="py-2 pr-3 text-right font-medium">Required</th>
                    <th scope="col" className="py-2 pr-3 text-right font-medium">Completed</th>
                    <th scope="col" className="py-2 pr-3 text-right font-medium">Remaining</th>
                  </tr>
                </thead>
                <tbody>
                  {([
                    ['Deposit', data?.breakdown.deposit],
                    ['Betting pass', data?.breakdown.bettingPass],
                    ['Referral', data?.breakdown.referral],
                    ['Spin', data?.breakdown.spin],
                  ] as const).map(([label, part]) => (
                    <tr key={label} className="border-b border-neon/5">
                      <td className="py-2 pr-3 text-ink-hi">{label}</td>
                      <td className="py-2 pr-3 text-right text-ink-mid">{formatBDT(part?.required ?? 0)}</td>
                      <td className="py-2 pr-3 text-right text-ink-mid">{formatBDT(part?.completed ?? 0)}</td>
                      <td className="py-2 pr-3 text-right font-semibold text-ink-hi">{formatBDT(part?.remaining ?? 0)}</td>
                    </tr>
                  ))}
                  <tr>
                    <td className="py-2 pr-3 text-ink-hi">Bonus grants</td>
                    <td className="py-2 pr-3 text-right text-ink-lo">.</td>
                    <td className="py-2 pr-3 text-right text-ink-lo">.</td>
                    <td className="py-2 pr-3 text-right font-semibold text-ink-hi">{formatBDT(data?.grantsRemaining ?? 0)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </Card>

          <Card padding="md" className="mb-4">
            <h2 className="mb-1 text-sm font-semibold text-ink-hi">Adjust bonus grant requirement</h2>
            <p className="mb-3 text-xs text-ink-lo">
              Applies to the bonus grant portion only, currently {formatBDT(data?.grantsRemaining ?? 0)}. Deposit and
              betting pass turnover follow the player&apos;s own deposits and wagering and cannot be edited here.
            </p>

            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label htmlFor="to-mode" className="mb-1 block text-xs font-medium text-ink-mid">Action</label>
                <select
                  id="to-mode"
                  value={mode}
                  onChange={(e) => setMode(e.target.value as Mode)}
                  className="h-10 rounded-lg border border-brand-divider bg-brand-paper px-3 text-sm text-brand-ink"
                >
                  {MODES.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="to-amount" className="mb-1 block text-xs font-medium text-ink-mid">Amount (BDT)</label>
                <input
                  id="to-amount"
                  type="number"
                  step="0.01"
                  min="0"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="h-10 w-40 rounded-lg border border-brand-divider bg-brand-paper px-3 text-sm text-brand-ink"
                />
              </div>
              <div className="min-w-[16rem] flex-1">
                <label htmlFor="to-reason" className="mb-1 block text-xs font-medium text-ink-mid">
                  Reason <span className="text-signal-danger">*</span>
                </label>
                <input
                  id="to-reason"
                  type="text"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Why is this being changed?"
                  aria-describedby="to-reason-hint"
                  className="h-10 w-full rounded-lg border border-brand-divider bg-brand-paper px-3 text-sm text-brand-ink"
                />
                <p id="to-reason-hint" className="mt-1 text-[11px] text-ink-lo">
                  Required, at least 3 characters. Stored permanently with your name.
                </p>
              </div>
            </div>

            {preview ? (
              <div className="mt-3 rounded-lg border border-brand-divider bg-brand-surface/50 p-3">
                <p className="text-sm text-ink-hi">
                  {formatBDT(preview.before)} <span className="text-ink-lo">&rarr;</span>{' '}
                  <strong>{formatBDT(preview.after)}</strong>{' '}
                  <span className={preview.change < 0 ? 'text-rose-500' : 'text-emerald-500'}>
                    ({formatBDT(preview.change, { sign: true })})
                  </span>
                </p>
                {preview.clamped ? (
                  <p className="mt-1 text-xs text-ink-mid">
                    That would go below zero, so the requirement will be set to 0 instead.
                  </p>
                ) : null}
                {preview.change < 0 ? (
                  <p className="mt-1 flex items-start gap-1.5 text-xs text-ink-mid">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-signal-danger" aria-hidden />
                    Reducing the requirement lets this player withdraw sooner.
                  </p>
                ) : null}
              </div>
            ) : null}

            <div className="mt-3 flex items-center gap-2">
              <Button size="sm" variant="gold" onClick={submit} loading={saving} disabled={!canSubmit}>
                Apply adjustment
              </Button>
              <Button size="sm" variant="ghost" leftIcon={<RefreshCw className="h-3.5 w-3.5" />} onClick={load}>
                Refresh
              </Button>
            </div>

            {/* Announced to assistive tech, since the outcome is otherwise
                only visible as a colour-coded line further up. */}
            <div aria-live="polite">
              {notice ? <p className="mt-3 text-sm text-emerald-600">{notice}</p> : null}
              {error ? <p className="mt-3 text-sm text-signal-danger">{error}</p> : null}
            </div>
          </Card>

          <Card padding="md" className="mb-4">
            <h2 className="mb-3 text-sm font-semibold text-ink-hi">Active grants</h2>
            {!data || data.grants.length === 0 ? (
              <p className="text-sm text-ink-mid">
                This player has no active wagering requirement. There is nothing to adjust.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[36rem] text-sm">
                  <thead>
                    <tr className="border-b border-brand-divider text-left text-xs text-ink-mid">
                      <th scope="col" className="py-2 pr-3 font-medium">Source</th>
                      <th scope="col" className="py-2 pr-3 font-medium">Bonus</th>
                      <th scope="col" className="py-2 pr-3 font-medium">Required</th>
                      <th scope="col" className="py-2 pr-3 font-medium">Wagered</th>
                      <th scope="col" className="py-2 font-medium">Remaining</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.grants.map((g) => (
                      <tr key={g.id} className="border-b border-brand-divider/60 last:border-0">
                        <td className="py-2 pr-3 text-ink-mid">{g.sourceType ?? '-'}</td>
                        <td className="py-2 pr-3 tabular-nums text-ink-mid">{formatBDT(g.amount)}</td>
                        <td className="py-2 pr-3 tabular-nums text-ink-mid">{formatBDT(g.required)}</td>
                        <td className="py-2 pr-3 tabular-nums text-ink-mid">{formatBDT(g.progress)}</td>
                        <td className="py-2 tabular-nums font-semibold text-ink-hi">{formatBDT(g.remaining)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card padding="md">
            <h2 className="mb-3 text-sm font-semibold text-ink-hi">Adjustment history</h2>
            {!data || data.history.length === 0 ? (
              <EmptyState
                title="No manual adjustments"
                description="Every change made from this screen will be recorded here permanently."
                icon={<Target className="h-6 w-6" />}
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[40rem] text-sm">
                  <thead>
                    <tr className="border-b border-brand-divider text-left text-xs text-ink-mid">
                      <th scope="col" className="py-2 pr-3 font-medium">When</th>
                      <th scope="col" className="py-2 pr-3 font-medium">Action</th>
                      <th scope="col" className="py-2 pr-3 font-medium">Before</th>
                      <th scope="col" className="py-2 pr-3 font-medium">Change</th>
                      <th scope="col" className="py-2 pr-3 font-medium">After</th>
                      <th scope="col" className="py-2 font-medium">Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.history.map((h, i) => (
                      <tr key={`${h.at}-${i}`} className="border-b border-brand-divider/60 last:border-0">
                        <td className="whitespace-nowrap py-2 pr-3 text-ink-lo">{formatDateTime(h.at, lang)}</td>
                        <td className="py-2 pr-3 text-ink-mid">{h.kind.replace('admin_', '')}</td>
                        <td className="py-2 pr-3 tabular-nums text-ink-mid">{h.before == null ? '-' : formatBDT(h.before)}</td>
                        <td className={`py-2 pr-3 tabular-nums font-semibold ${h.change < 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
                          {formatBDT(h.change, { sign: true })}
                        </td>
                        <td className="py-2 pr-3 tabular-nums text-ink-hi">{h.after == null ? '-' : formatBDT(h.after)}</td>
                        <td className="py-2 text-ink-mid">{h.reason ?? '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}
    </>
  );
}
