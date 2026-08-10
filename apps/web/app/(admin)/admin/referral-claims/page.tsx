// Built by Anointed Coder.
//
// /admin/referral-claims
//
// One-page admin console for the Phase E referral claim flow:
//   - Settings card: cadence + hold days + turnover gate.
//   - Balances table: per-affiliate pending / claimable / claimed.
//   - Claims table: pending / paid / rejected ReferralClaim ledger.
//     Pending rows expose Approve and Reject buttons.

'use client';

import { useCallback, useEffect, useState } from 'react';
import { PageHeader } from '@/components/site/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { NumericInput } from '@/components/ui/NumericInput';
import { Chip } from '@/components/ui/Chip';
import { Modal } from '@/components/ui/Modal';
import { FormField, Textarea } from '@/components/ui/Input';
import { ConfirmDialog } from '@/components/admin/ConfirmDialog';
import { Users, Save, RefreshCw, Search } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

interface Settings {
  cadence: 'weekly' | 'monthly' | 'manual' | 'auto';
  holdDays: number;
  turnoverX: number;
  /** Turnover multiplier for percentage deposit commissions, every level. */
  commissionTurnoverX: number;
  firstDepositMinBdt: number;
  firstDepositRewardBdt: number;
}
interface BalanceRow {
  userId: string;
  username: string;
  phone: string | null;
  email: string | null;
  pendingAmount: number;
  claimableAmount: number;
  claimedAmount: number;
  lastClaimedAt: string | null;
  updatedAt: string;
}
interface ClaimRow {
  id: string;
  userId: string;
  username: string;
  phone: string | null;
  amount: number;
  status: 'pending' | 'paid' | 'rejected';
  errorCode: string | null;
  walletTxId: string | null;
  createdAt: string;
  paidAt: string | null;
}

const inputCls = 'w-full rounded-lg border border-brand-divider bg-brand-paper px-3 py-2 text-sm text-brand-ink placeholder:text-brand-inkMute focus:outline-none focus:ring-2 focus:ring-brand-blue-500';

function formatBDT(n: number): string {
  return `BDT ${n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

function fmtDate(s: string | null): string {
  if (!s) return '-';
  try { return new Date(s).toLocaleString(); } catch { return s; }
}

export default function AdminReferralClaimsPage() {
  const [settings, setSettings] = useState<Settings>({
    cadence: 'weekly',
    holdDays: 7,
    turnoverX: 0,
    // Replaced on load with the server's resolved value, which falls back to
    // turnoverX while the operator has never set this explicitly.
    commissionTurnoverX: 0,
    firstDepositMinBdt: 0,
    firstDepositRewardBdt: 0,
  });
  const [balances, setBalances] = useState<BalanceRow[]>([]);
  const [claims, setClaims] = useState<ClaimRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);
  const [actingId, setActingId] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'' | 'pending' | 'paid' | 'rejected'>('');
  // In-page review dialogs. The old flow used prompt() for the reject
  // note (suppressed in installed PWAs, so a reject fired instantly
  // with an empty note) and paid out on Approve with no confirmation.
  const [approveTarget, setApproveTarget] = useState<ClaimRow | null>(null);
  const [rejectTarget, setRejectTarget] = useState<ClaimRow | null>(null);
  const [rejectNote, setRejectNote] = useState('');
  const [rejectBusy, setRejectBusy] = useState(false);
  const [rejectError, setRejectError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const params = new URLSearchParams();
      if (query.trim()) params.set('q', query.trim());
      if (statusFilter) params.set('status', statusFilter);
      const r = await fetch(`/api/admin/referral-claims${params.toString() ? `?${params.toString()}` : ''}`, { cache: 'no-store' });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.message ?? j?.code ?? 'Failed to load');
      setSettings(j.settings as Settings);
      setBalances(j.balances as BalanceRow[]);
      setClaims(j.claims as ClaimRow[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [query, statusFilter]);

  useEffect(() => { load(); }, [load]);

  const saveSettings = async () => {
    setSavingSettings(true); setError(null); setInfo(null);
    try {
      const r = await fetch('/api/admin/referral-claims/settings', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          cadence: settings.cadence,
          holdDays: settings.holdDays,
          turnoverX: settings.turnoverX,
          commissionTurnoverX: settings.commissionTurnoverX,
          firstDepositMinBdt: settings.firstDepositMinBdt,
          firstDepositRewardBdt: settings.firstDepositRewardBdt,
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.message ?? j?.code ?? 'Save failed');
      setSettings(j.settings as Settings);
      setInfo('Settings saved.');
      setTimeout(() => setInfo(null), 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSavingSettings(false);
    }
  };

  const runCron = async () => {
    setError(null); setInfo(null);
    try {
      const r = await fetch('/api/cron/referral-mature', { method: 'POST' });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.message ?? j?.code ?? 'Cron failed');
      setInfo(`Maturity sweep done. Users touched: ${j.usersTouched ?? 0}. Newly matured: ${formatBDT(Number(j.newlyMatured ?? 0))}. Auto paid: ${formatBDT(Number(j.amountPaid ?? 0))}.`);
      await load();
      setTimeout(() => setInfo(null), 5000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Cron failed');
    }
  };

  // Sends the review decision. THROWS on failure so each caller can
  // surface the error in the right place (the reject modal renders it
  // inside itself; the approve dialog reports to the page card).
  const reviewClaim = async (id: string, action: 'approve' | 'reject', note?: string) => {
    setActingId(id); setError(null);
    try {
      const r = await fetch(`/api/admin/referral-claims/${id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action, adminNote: note?.trim() || undefined }),
      });
      const j = await r.json().catch(() => null);
      if (!r.ok) throw new Error(j?.message ?? j?.code ?? 'Action failed');
      setInfo(action === 'approve'
        ? 'Claim approved and paid. ক্লেইম অনুমোদন করা হয়েছে এবং টাকা পরিশোধ হয়েছে।'
        : 'Claim rejected. ক্লেইম প্রত্যাখ্যান করা হয়েছে।');
      setTimeout(() => setInfo(null), 4000);
      await load();
    } finally {
      setActingId(null);
    }
  };

  const submitReject = async () => {
    if (!rejectTarget) return;
    setRejectBusy(true); setRejectError(null);
    try {
      await reviewClaim(rejectTarget.id, 'reject', rejectNote);
      setRejectTarget(null);
      setRejectNote('');
    } catch (e) {
      // Keep the modal open and show the failure inside it; the page
      // level error card would sit behind the overlay.
      setRejectError(e instanceof Error ? e.message : 'Reject failed');
    } finally {
      setRejectBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        icon={<Users className="h-5 w-5" />}
        title="Referral claims"
        subtitle="Settings, balances, and the claim review queue."
      />

      {error ? <Card padding="sm" className="border-l-4 border-rose-400/60"><p className="text-sm text-rose-300">{error}</p></Card> : null}
      {info ? <Card padding="sm" className="border-l-4 border-emerald-400/60"><p className="text-sm text-emerald-300">{info}</p></Card> : null}

      <Card padding="md">
        <p className="text-[10px] font-bold uppercase tracking-wider text-brand-inkMute">Settings</p>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <label className="block">
            <span className="text-[10px] font-bold uppercase tracking-wider text-brand-inkMute">Cadence</span>
            <select value={settings.cadence} onChange={(e) => setSettings({ ...settings, cadence: e.target.value as Settings['cadence'] })} className={inputCls}>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="manual">Manual review</option>
              <option value="auto">Auto (no cadence gate)</option>
            </select>
          </label>
          <label className="block">
            <span className="text-[10px] font-bold uppercase tracking-wider text-brand-inkMute">Fixed reward minimum deposit</span>
            <NumericInput min={0} max={10000000} value={settings.firstDepositMinBdt} onValueChange={(n) => setSettings({ ...settings, firstDepositMinBdt: n })} />
          </label>
          <label className="block">
            <span className="text-[10px] font-bold uppercase tracking-wider text-brand-inkMute">Global fixed reward</span>
            <NumericInput min={0} max={1000000} value={settings.firstDepositRewardBdt} onValueChange={(n) => setSettings({ ...settings, firstDepositRewardBdt: n })} />
          </label>
          <label className="block">
            <span className="text-[10px] font-bold uppercase tracking-wider text-brand-inkMute">Hold days</span>
            <NumericInput min={0} max={180} value={settings.holdDays} onValueChange={(n) => setSettings({ ...settings, holdDays: n })} />
          </label>
          <label className="block">
            <span className="text-[10px] font-bold uppercase tracking-wider text-brand-inkMute">Fixed reward turnover (Nx)</span>
            <NumericInput min={0} max={50} value={settings.turnoverX} onValueChange={(n) => setSettings({ ...settings, turnoverX: n })} />
          </label>
          <label className="block">
            <span className="text-[10px] font-bold uppercase tracking-wider text-brand-inkMute">Commission turnover (Nx)</span>
            <NumericInput min={0} max={50} value={settings.commissionTurnoverX} onValueChange={(n) => setSettings({ ...settings, commissionTurnoverX: n })} />
          </label>
          <div className="flex items-end">
            <Button variant="gold" leftIcon={<Save className="h-4 w-4" />} loading={savingSettings} onClick={saveSettings} className="w-full">Save</Button>
          </div>
        </div>
        <p className="mt-2 text-[11px] text-brand-inkMute">The fixed reward minimum applies only to the one-time direct referral reward. Percentage commissions apply to every approved deposit. Fixed reward turnover gates the one-time reward; commission turnover gates percentage deposit commissions at every level, always as a multiple of the amount that affiliate actually received. Either at 0 means no lock for that kind. Example: 100 BDT commission at 5x must wager 500 BDT before it can be withdrawn.</p>
      </Card>

      <Card padding="md">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex flex-1 items-center gap-2">
            <Search className="h-4 w-4 text-brand-inkMute" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') load(); }} placeholder="Search username / phone / email" className={inputCls} />
          </div>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)} className={cn(inputCls, 'w-auto')}>
            <option value="">All status</option>
            <option value="pending">Pending</option>
            <option value="paid">Paid</option>
            <option value="rejected">Rejected</option>
          </select>
          <Button variant="ghost" leftIcon={<RefreshCw className="h-4 w-4" />} onClick={load} loading={loading}>Reload</Button>
          <Button variant="ghost" onClick={runCron}>Run maturity sweep</Button>
        </div>
      </Card>

      <Card padding="md">
        <p className="text-[10px] font-bold uppercase tracking-wider text-brand-inkMute">Balances</p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead className="text-xs uppercase tracking-wider text-brand-inkMute">
              <tr>
                <th className="px-2 py-2 text-left">User</th>
                <th className="px-2 py-2 text-right">Pending</th>
                <th className="px-2 py-2 text-right">Claimable</th>
                <th className="px-2 py-2 text-right">Claimed</th>
                <th className="px-2 py-2 text-left">Last claim</th>
                <th className="px-2 py-2 text-left">Updated</th>
              </tr>
            </thead>
            <tbody>
              {balances.length === 0 ? (
                <tr><td colSpan={6} className="px-2 py-6 text-center text-brand-inkMute">No referral balances yet. Run the maturity sweep or the backfill script.</td></tr>
              ) : null}
              {balances.map((b) => (
                <tr key={b.userId} className="border-t border-brand-divider">
                  <td className="px-2 py-2">
                    <p className="font-semibold text-brand-ink">{b.username}</p>
                    <p className="text-[11px] text-brand-inkMute">{b.phone ?? ''}{b.email ? ` . ${b.email}` : ''}</p>
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums">{formatBDT(b.pendingAmount)}</td>
                  <td className="px-2 py-2 text-right tabular-nums text-emerald-400 font-semibold">{formatBDT(b.claimableAmount)}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{formatBDT(b.claimedAmount)}</td>
                  <td className="px-2 py-2 text-[11px] text-brand-inkMute">{fmtDate(b.lastClaimedAt)}</td>
                  <td className="px-2 py-2 text-[11px] text-brand-inkMute">{fmtDate(b.updatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card padding="md">
        <p className="text-[10px] font-bold uppercase tracking-wider text-brand-inkMute">Claim ledger</p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead className="text-xs uppercase tracking-wider text-brand-inkMute">
              <tr>
                <th className="px-2 py-2 text-left">User</th>
                <th className="px-2 py-2 text-right">Amount</th>
                <th className="px-2 py-2 text-left">Status</th>
                <th className="px-2 py-2 text-left">Wallet tx</th>
                <th className="px-2 py-2 text-left">Created</th>
                <th className="px-2 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {claims.length === 0 ? (
                <tr><td colSpan={6} className="px-2 py-6 text-center text-brand-inkMute">No claim rows match the current filter.</td></tr>
              ) : null}
              {claims.map((c) => (
                <tr key={c.id} className="border-t border-brand-divider">
                  <td className="px-2 py-2">
                    <p className="font-semibold text-brand-ink">{c.username}</p>
                    <p className="text-[11px] text-brand-inkMute">{c.phone ?? ''}</p>
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums">{formatBDT(c.amount)}</td>
                  <td className="px-2 py-2"><Chip tone={c.status === 'paid' ? 'ok' : c.status === 'rejected' ? 'danger' : 'warn'}>{c.status}</Chip></td>
                  <td className="px-2 py-2 font-mono text-[11px] text-brand-inkMute">{c.walletTxId ?? '-'}</td>
                  <td className="px-2 py-2 text-[11px] text-brand-inkMute">{fmtDate(c.createdAt)}</td>
                  <td className="px-2 py-2 text-right">
                    {c.status === 'pending' ? (
                      <div className="inline-flex gap-2">
                        <Button size="sm" variant="gold" loading={actingId === c.id} onClick={() => setApproveTarget(c)}>Approve</Button>
                        <Button size="sm" variant="ghost" loading={actingId === c.id} onClick={() => { setRejectTarget(c); setRejectNote(''); setRejectError(null); }}>Reject</Button>
                      </div>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <ConfirmDialog
        open={!!approveTarget}
        onOpenChange={(v) => !v && setApproveTarget(null)}
        title="Approve referral claim"
        message={approveTarget ? `Approve and pay ${formatBDT(approveTarget.amount)} to ${approveTarget.username}? The amount is credited to the affiliate wallet immediately.` : ''}
        messageBn={approveTarget ? `${approveTarget.username} কে ${formatBDT(approveTarget.amount)} অনুমোদন করে পরিশোধ করবেন? টাকা সাথে সাথে অ্যাফিলিয়েট ওয়ালেটে জমা হবে।` : ''}
        confirmLabel="Approve and pay"
        cancelLabel="Cancel"
        onConfirm={async () => {
          const target = approveTarget;
          setApproveTarget(null);
          if (!target) return;
          try {
            await reviewClaim(target.id, 'approve');
          } catch (e) {
            setError(`${e instanceof Error ? e.message : 'Approve failed'} (Approve failed. অনুমোদন ব্যর্থ হয়েছে।)`);
          }
        }}
      />

      <Modal
        open={!!rejectTarget}
        onOpenChange={(v) => { if (!v && !rejectBusy) { setRejectTarget(null); setRejectError(null); } }}
        title="Reject referral claim"
        description={rejectTarget ? `${rejectTarget.username} . ${formatBDT(rejectTarget.amount)}` : ''}
        size="sm"
      >
        {rejectTarget ? (
          <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); void submitReject(); }}>
            <FormField
              label="Rejection note (optional but recommended)"
              hint="নোটটি ঐচ্ছিক তবে দেওয়া ভালো; অডিট লগে সংরক্ষিত হবে।"
            >
              <Textarea rows={3} value={rejectNote} onChange={(e) => setRejectNote(e.target.value)} placeholder="Why this claim is rejected" />
            </FormField>
            {rejectError ? (
              <p className="text-sm text-signal-danger">Reject failed: {rejectError} (প্রত্যাখ্যান ব্যর্থ হয়েছে: {rejectError})</p>
            ) : null}
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" disabled={rejectBusy} onClick={() => setRejectTarget(null)}>Cancel</Button>
              <Button type="submit" variant="danger" loading={rejectBusy}>Reject claim</Button>
            </div>
          </form>
        ) : null}
      </Modal>
    </div>
  );
}
