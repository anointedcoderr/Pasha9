// Built by Anointed Coder.
//
// One player's full financial history, with the balance before and after
// every movement. This is the screen that answers "my balance dropped and I
// do not know why" in seconds, instead of the day of hand-written database
// queries it used to take.
//
// Shows the last 7 days by default (an active player produces hundreds of
// bet/win rows a day). Older records are one date filter away, never
// discarded, and the CSV export defaults to the FULL history because its
// purpose is evidence in a dispute.
//
// The reconciliation banner is deliberately prominent: if the recorded
// history does not account for the wallet, an operator must know that BEFORE
// quoting these figures to a player.

'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { PageHeader } from '@/components/site/PageHeader';
import { DataTable } from '@/components/ui/DataTable';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { Button } from '@/components/ui/Button';
import { StatTile } from '@/components/ui/StatTile';
import { EmptyState } from '@/components/ui/EmptyState';
import { formatBDT, formatDate, formatDateTime } from '@/lib/utils/format';
import { useLang } from '@/lib/i18n/context';
import { Wallet, RefreshCw, Download, AlertTriangle, ShieldCheck } from 'lucide-react';
import type { ColumnDef } from '@tanstack/react-table';

interface LedgerEntry {
  id: string;
  at: string;
  type: string;
  direction: 'credit' | 'debit';
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  status: string;
  provider: string | null;
  gameUid: string | null;
  gameName: string | null;
  roundId: string | null;
  referenceId: string | null;
  transactionId: string | null;
  bonusSource: string | null;
  description: string | null;
  actor: string | null;
  actorRole: string | null;
}

interface ChainBreak {
  ledgerId: string;
  at: string;
  type: string;
  expectedBefore: string;
  actualBefore: string;
  gap: string;
}

interface PeriodSummary {
  from: string | null;
  to: string | null;
  totalDeposit: string;
  totalWithdrawal: string;
  totalBet: string;
  totalWin: string;
  totalLoss: string;
  netProfitLoss: string;
}

interface AuditResponse {
  user: { id: string; username: string; phone: string; registeredAt: string };
  wallet: { balance: number; bonusBalance: number; lockedBalance: number; lottoBalance: number };
  summary: Record<string, string>;
  periodSummary: PeriodSummary;
  reconciliation: {
    ok: boolean;
    entries: number;
    walletBalance: string;
    ledgerTotal: string;
    difference: string;
    chainBreaks: ChainBreak[];
    predatesLedger: boolean;
  };
  paging: { take: number; skip: number; total: number; returned: number };
  windowDays: number | null;
  entries: LedgerEntry[];
}

const PAGE_SIZE = 50;

export default function WalletAuditPage() {
  const params = useParams<{ id: string }>();
  const userId = params?.id ?? '';
  const { lang } = useLang();

  const [data, setData] = useState<AuditResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [showAll, setShowAll] = useState(false);
  const [skip, setSkip] = useState(0);

  const load = useCallback(async () => {
    if (!userId) return;
    setRefreshing(true);
    setError(null);
    try {
      const q = new URLSearchParams({ take: String(PAGE_SIZE), skip: String(skip) });
      if (from) q.set('from', from);
      if (to) q.set('to', to);
      if (showAll && !from && !to) q.set('all', '1');
      const r = await fetch(`/api/admin/users/${userId}/wallet-audit?${q}`, { cache: 'no-store', credentials: 'include' });
      const j = await r.json().catch(() => null);
      if (!r.ok) throw new Error(j?.message ?? j?.code ?? 'Failed to load');
      setData(j as AuditResponse);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userId, from, to, showAll, skip]);

  useEffect(() => { load(); }, [load]);

  // Quick presets for the period summary card. Sets the SAME from/to state
  // the raw date inputs use, so a preset and manual "custom" dates are one
  // continuous control rather than two separate mechanisms - editing either
  // input after clicking a preset just refines it, exactly as a Super Admin
  // would expect.
  const setPreset = (days: number) => {
    const to = new Date();
    const from = new Date(to.getTime() - days * 86_400_000);
    setFrom(from.toISOString().slice(0, 10));
    setTo(to.toISOString().slice(0, 10));
    setShowAll(false);
    setSkip(0);
  };
  const activePreset = useMemo(() => {
    if (showAll || !from || !to) return null;
    const days = Math.round((new Date(to).getTime() - new Date(from).getTime()) / 86_400_000);
    return [7, 15, 30].includes(days) ? days : null;
  }, [from, to, showAll]);

  const exportHref = useMemo(() => {
    const q = new URLSearchParams();
    if (from) q.set('from', from);
    if (to) q.set('to', to);
    const qs = q.toString();
    return `/api/admin/users/${userId}/wallet-audit/export${qs ? `?${qs}` : ''}`;
  }, [userId, from, to]);

  const columns = useMemo<ColumnDef<LedgerEntry>[]>(() => [
    {
      header: 'Date/Time',
      accessorKey: 'at',
      cell: ({ getValue }) => <span className="whitespace-nowrap text-ink-lo">{formatDateTime(String(getValue()), lang)}</span>,
    },
    {
      header: 'Type',
      accessorKey: 'type',
      cell: ({ row }) => (
        <div>
          <p className="font-medium text-ink-hi">{row.original.type}</p>
          {row.original.description ? <p className="text-[11px] text-ink-lo">{row.original.description}</p> : null}
        </div>
      ),
    },
    {
      header: 'Balance Before',
      accessorKey: 'balanceBefore',
      cell: ({ getValue }) => <span className="tabular-nums text-ink-mid">{formatBDT(Number(getValue()))}</span>,
    },
    {
      header: 'Amount',
      accessorKey: 'amount',
      cell: ({ getValue }) => {
        const v = Number(getValue());
        // A zero amount is a pocket-to-pocket move (a bonus unlocking), not a
        // no-op. Shown dimmed rather than hidden so the row still explains a
        // balance change the player saw.
        return (
          <span className={v > 0 ? 'tabular-nums font-semibold text-emerald-500' : v < 0 ? 'tabular-nums font-semibold text-rose-500' : 'tabular-nums text-ink-lo'}>
            {formatBDT(v, { sign: true })}
          </span>
        );
      },
    },
    {
      header: 'Balance After',
      accessorKey: 'balanceAfter',
      cell: ({ getValue }) => <span className="tabular-nums font-semibold text-ink-hi">{formatBDT(Number(getValue()))}</span>,
    },
    {
      header: 'Source',
      accessorKey: 'provider',
      cell: ({ row }) => {
        const r = row.original;
        const bits = [r.provider, r.gameName ?? r.gameUid, r.bonusSource].filter(Boolean);
        return bits.length ? <span className="text-ink-mid">{bits.join(' · ')}</span> : <span className="text-ink-lo">-</span>;
      },
    },
    {
      header: 'Round / Ref',
      accessorKey: 'roundId',
      cell: ({ row }) => {
        const v = row.original.roundId ?? row.original.referenceId;
        return v ? <code className="font-mono text-[11px] text-ink-lo">{v}</code> : <span className="text-ink-lo">-</span>;
      },
    },
    {
      header: 'By',
      accessorKey: 'actor',
      cell: ({ getValue }) => {
        const v = getValue() as string | null;
        // Only manual operator actions have an actor; automatic movements
        // showing "system" would imply someone acted when nobody did.
        return v ? <Chip tone="warn">{v}</Chip> : <span className="text-ink-lo">-</span>;
      },
    },
  ], [lang]);

  const rec = data?.reconciliation;
  const total = data?.paging.total ?? 0;
  const canPrev = skip > 0;
  const canNext = skip + PAGE_SIZE < total;

  return (
    <>
      <PageHeader
        title="Wallet Audit"
        subtitle={data ? `${data.user.username} · ${data.user.phone}` : 'Loading...'}
        icon={<Wallet className="h-5 w-5" />}
        // Reached from a row's drawer on Users, which has no URL of its own -
        // this page's own address is the only bookmarkable/shareable one, so
        // Users is the one destination that reliably makes sense to return to.
        back={{ href: '/admin/users', label: 'Users' }}
      />

      {/* Reconciliation first: an operator must not quote figures below
          without knowing whether they add up. */}
      {rec ? (
        <Card padding="md" className="mb-4">
          <div className="flex flex-wrap items-start gap-3">
            {rec.ok ? (
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500" aria-hidden />
            ) : (
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-signal-danger" aria-hidden />
            )}
            <div className="min-w-0 flex-1">
              <p className={rec.ok ? 'text-sm font-semibold text-emerald-600' : 'text-sm font-semibold text-signal-danger'}>
                {rec.ok
                  ? 'Every taka is accounted for. Wallet matches the recorded history exactly.'
                  : 'This wallet does NOT match its recorded history.'}
              </p>
              <p className="mt-1 text-xs text-ink-mid">
                Wallet {formatBDT(Number(rec.walletBalance))} · Recorded {formatBDT(Number(rec.ledgerTotal))} · Difference{' '}
                <strong className={Number(rec.difference) === 0 ? '' : 'text-signal-danger'}>{formatBDT(Number(rec.difference), { sign: true })}</strong>
              </p>
              {rec.predatesLedger ? (
                <p className="mt-1 text-xs text-ink-lo">
                  This player was active before the audit system started, so part of their history predates it. A difference here is expected until the backfill has run.
                </p>
              ) : null}
              {rec.chainBreaks.length > 0 ? (
                <div className="mt-2">
                  <p className="text-xs font-semibold text-signal-danger">
                    {rec.chainBreaks.length} point{rec.chainBreaks.length === 1 ? '' : 's'} where the balance moved without a record:
                  </p>
                  <ul className="mt-1 space-y-0.5">
                    {rec.chainBreaks.slice(0, 5).map((b) => (
                      <li key={b.ledgerId} className="text-xs text-ink-mid">
                        {formatDateTime(b.at, lang)} · {b.type} · expected {b.expectedBefore}, found {b.actualBefore} (gap {b.gap})
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          </div>
        </Card>
      ) : null}

      {data ? (
        <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <StatTile label="Current Balance" value={formatBDT(data.wallet.balance)} accent="gold" />
          <StatTile label="Locked" value={formatBDT(data.wallet.lockedBalance)} hint="Not withdrawable yet" />
          <StatTile label="Total Deposits" value={formatBDT(Number(data.summary.totalDeposits))} />
          <StatTile label="Total Withdrawals" value={formatBDT(Math.abs(Number(data.summary.totalWithdrawals)))} />
          <StatTile label="Total Bets" value={formatBDT(Math.abs(Number(data.summary.totalBets)))} />
          <StatTile label="Total Wins" value={formatBDT(Number(data.summary.totalWins))} />
          <StatTile label="Bonuses & Rewards" value={formatBDT(Number(data.summary.totalBonuses))} />
          <StatTile label="Admin Credits" value={formatBDT(Number(data.summary.totalAdminCredits))} />
          <StatTile label="Admin Debits" value={formatBDT(Math.abs(Number(data.summary.totalAdminDebits)))} />
          <StatTile label="Registered" value={formatDateTime(data.user.registeredAt, lang)} />
        </div>
      ) : null}

      <Card padding="md" className="mb-4">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-ink-mid">Period summary</span>
          {[
            { days: 7, label: 'Last 7 days' },
            { days: 15, label: 'Last 15 days' },
            { days: 30, label: 'Last 30 days' },
          ].map((p) => (
            <Button key={p.days} size="sm" variant={activePreset === p.days ? 'gold' : 'ghost'} aria-pressed={activePreset === p.days} onClick={() => setPreset(p.days)}>
              {p.label}
            </Button>
          ))}
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label htmlFor="wa-from" className="mb-1 block text-xs font-medium text-ink-mid">From</label>
            <input
              id="wa-from"
              type="date"
              value={from}
              onChange={(e) => { setFrom(e.target.value); setSkip(0); }}
              className="h-10 rounded-lg border border-brand-divider bg-brand-paper px-3 text-sm text-brand-ink"
            />
          </div>
          <div>
            <label htmlFor="wa-to" className="mb-1 block text-xs font-medium text-ink-mid">To</label>
            <input
              id="wa-to"
              type="date"
              value={to}
              onChange={(e) => { setTo(e.target.value); setSkip(0); }}
              className="h-10 rounded-lg border border-brand-divider bg-brand-paper px-3 text-sm text-brand-ink"
            />
          </div>
          <Button
            size="sm"
            variant={showAll ? 'gold' : 'ghost'}
            onClick={() => { setShowAll((v) => !v); setSkip(0); }}
          >
            {showAll ? 'Showing full history' : 'Show full history'}
          </Button>
          <Button size="sm" variant="ghost" leftIcon={<RefreshCw className="h-3.5 w-3.5" />} onClick={load} loading={refreshing}>
            Refresh
          </Button>
          {/* A real anchor, not a Button inside an anchor: nesting a button
              in a link is invalid and gives screen readers and keyboard users
              two conflicting controls in one stop. */}
          <a
            href={exportHref}
            download
            className="ml-auto inline-flex h-9 items-center gap-2 rounded-lg border border-brand-divider px-3 text-sm font-medium text-brand-ink transition hover:bg-brand-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-yellow-500/50"
          >
            <Download className="h-3.5 w-3.5" aria-hidden />
            Export CSV
          </a>
        </div>
        {data?.windowDays ? (
          <p className="mt-2 text-xs text-ink-lo">
            Showing the last {data.windowDays} days. Pick a date range or choose full history to go back further, to registration.
          </p>
        ) : null}
      </Card>

      {/*
        Admin-only automatic financial summary for the period selected above.
        Never sent to any player-facing endpoint - see the API route comment:
        the client was explicit that a player must not see a deposit vs
        winnings comparison, since a large gap between the two reads as
        discouraging. This exists so a Super Admin does not have to add up
        transactions by hand to answer "how did this player do this week".
      */}
      {data?.periodSummary ? (
        <Card padding="md" className="mb-4">
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-sm font-semibold text-ink-hi">
              {showAll || (!from && !to)
                ? `Full history${data.periodSummary.from ? '' : ' (from registration)'}`
                : `${formatDate(data.periodSummary.from ?? '', lang)} – ${formatDate(data.periodSummary.to ?? '', lang)}`}
            </h2>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <StatTile label="Total Deposit" value={formatBDT(Number(data.periodSummary.totalDeposit))} accent="gold" />
            <StatTile label="Total Withdrawal" value={formatBDT(Number(data.periodSummary.totalWithdrawal))} />
            <StatTile label="Total Bet" value={formatBDT(Number(data.periodSummary.totalBet))} />
            <StatTile label="Total Win" value={formatBDT(Number(data.periodSummary.totalWin))} />
            <StatTile label="Total Loss" value={formatBDT(Number(data.periodSummary.totalLoss))} hint="Bet minus win" />
            <StatTile
              label="Net Profit/Loss"
              value={formatBDT(Number(data.periodSummary.netProfitLoss), { sign: true })}
              hint="Win minus bet, player's side"
              accent={Number(data.periodSummary.netProfitLoss) >= 0 ? 'gold' : undefined}
            />
          </div>
        </Card>
      ) : null}

      {error ? <Card padding="md" className="mb-4"><p className="text-sm text-signal-danger">{error}</p></Card> : null}

      {loading ? (
        <Card padding="lg"><p className="text-sm text-ink-mid">Loading...</p></Card>
      ) : !data || data.entries.length === 0 ? (
        <EmptyState
          title="No movements in this period"
          description="Widen the date range or choose full history to see older records."
          icon={<Wallet className="h-6 w-6" />}
        />
      ) : (
        <>
          <DataTable columns={columns} data={data.entries} searchPlaceholder="Search type, source, round" pageSize={PAGE_SIZE} />
          <div className="mt-3 flex items-center justify-between">
            <p className="text-xs text-ink-lo">
              Showing {data.paging.skip + 1}-{data.paging.skip + data.paging.returned} of {total}
            </p>
            <div className="flex gap-2">
              <Button size="sm" variant="ghost" disabled={!canPrev} onClick={() => setSkip((s) => Math.max(0, s - PAGE_SIZE))}>Previous</Button>
              <Button size="sm" variant="ghost" disabled={!canNext} onClick={() => setSkip((s) => s + PAGE_SIZE)}>Next</Button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
