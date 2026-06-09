// Built by Anointed Coder.
'use client';

import { useCallback, useEffect, useState } from 'react';
import { PageHeader } from '@/components/site/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { Modal } from '@/components/ui/Modal';
import { FormField, Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Switch } from '@/components/ui/Switch';
import { EmptyState } from '@/components/ui/EmptyState';
import { Ticket, Pencil, Trash2, Plus, Crown, CheckCircle2, Stethoscope, RefreshCcw, Sparkles, Trophy, Wand2, List } from 'lucide-react';
import { formatBDT, formatDateTime } from '@/lib/utils/format';
import { useLang } from '@/lib/i18n/context';

type Accent = 'yellow' | 'blue' | 'red' | 'royal';
type Status = 'active' | 'hidden' | 'paused';

interface Draw {
  id: string;
  name: string;
  schedule?: string | null;
  drawsAt?: string | null;
  digitsCount: number;
  ticketPrice: number | string;
  prizePool: number | string;
  accent: Accent;
  position: number;
  status: Status;
}

interface ResultRow {
  id: string;
  drawId: string;
  winningNumber: string;
  publishedAt: string;
  totalWinners: number;
  totalPaid: number;
  ticketBaseValue: number;
  prize1xMult: number;
}

interface SettleDraft {
  draw: Draw;
  winningNumber: string;
  ticketBaseValue: string;
  prize1xMult: string;
  prize2xMult: string;
  prize3xMult: string;
  prizeSpecialMult: string;
  prizeConsoMult: string;
  // M4 Phase F: Babu88-style additional prize numbers (display only,
  // do not affect prize computation). claimMode optionally overrides
  // the SystemSetting `lotto_claim_mode` for this settlement.
  second: string;
  third: string;
  specials: string;     // comma-separated list of 4-digit numbers
  consolations: string; // comma-separated list of 4-digit numbers
  claimMode: 'inherit' | 'auto' | 'manual';
}

interface LottoSettings {
  enabled: boolean;
  claimMode: 'auto' | 'manual';
  ticketRateAmount: number;
  ticketRateCount: number;
}

interface TierRow { tier: string; label: string; count: number; paid: number }
interface DiagnoseResult {
  drawName: string;
  ticketCount: number;
  alreadySettled: boolean;
  totalWinners: number;
  totalPaid: number;
  uniqueWinners: number;
  breakdown: TierRow[];
  samples: Array<{ ticket: string; tier: string; amount: number }>;
}

interface AdminTicketRow {
  id: string;
  number: string;
  status: string;
  source: string;
  generatedAt: string;
  draw: { id: string; name: string; drawsAt: string | null } | null;
  user: { id: string; username: string; phone: string } | null;
}

interface WinnersBreakdown {
  draw: { id: string; name: string; drawsAt: string | null; status: string };
  result: { id: string; winningNumber: string; publishedAt: string; totalPaid: number; ticketBaseValue: number } | null;
  winners: Array<{
    id: string;
    ticketNumber: string;
    prizeTier: string;
    amount: number;
    status: string;
    createdAt: string;
    creditedAt: string | null;
    user: { id: string; username: string; phone: string } | null;
  }>;
  byTier: Record<string, { count: number; sumAmount: number }>;
  byStatus: Record<string, { count: number; sumAmount: number }>;
  total: number;
  sumAmount: number;
}

const BLANK: Draw = {
  id: '',
  name: '',
  schedule: '',
  drawsAt: '',
  digitsCount: 4,
  // Client spec ticket value. 5 BDT * 2000x = 10,000 BDT 1st prize,
  // matching the example in the spec doc.
  ticketPrice: 5,
  prizePool: 100000,
  accent: 'yellow',
  position: 0,
  status: 'active',
};

export default function AdminLottoPage() {
  const { lang } = useLang();
  const [draws, setDraws] = useState<Draw[]>([]);
  const [results, setResults] = useState<ResultRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editor, setEditor] = useState<Draw | null>(null);
  const [settling, setSettling] = useState<SettleDraft | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [settings, setSettings] = useState<LottoSettings | null>(null);
  const [settingsBusy, setSettingsBusy] = useState(false);
  const [diagnose, setDiagnose] = useState<DiagnoseResult | null>(null);
  const [diagnoseBusy, setDiagnoseBusy] = useState(false);
  const [rolloverBusy, setRolloverBusy] = useState(false);
  const [seedBusy, setSeedBusy] = useState(false);
  // View Tickets browser state
  const [ticketsOpen, setTicketsOpen] = useState(false);
  const [ticketsList, setTicketsList] = useState<AdminTicketRow[]>([]);
  const [ticketsTotal, setTicketsTotal] = useState(0);
  const [ticketsBusy, setTicketsBusy] = useState(false);
  const [ticketsFilters, setTicketsFilters] = useState<{ drawId: string; status: string; number: string }>({ drawId: '', status: '', number: '' });
  // View Winners breakdown state
  const [winners, setWinners] = useState<WinnersBreakdown | null>(null);
  const [winnersBusy, setWinnersBusy] = useState(false);
  // Auto-generate result button state
  const [generateBusy, setGenerateBusy] = useState(false);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const [drawsRes, resultsRes] = await Promise.all([
        fetch('/api/admin/lotto', { cache: 'no-store' }),
        fetch('/api/content/lotto/results', { cache: 'no-store' }),
      ]);
      const drawsData = await drawsRes.json();
      if (!drawsRes.ok) throw new Error(drawsData.message ?? drawsData.code);
      setDraws((drawsData.draws ?? []) as Draw[]);
      if (resultsRes.ok) {
        const resultsData = await resultsRes.json();
        setResults((resultsData.results ?? []) as ResultRow[]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  useEffect(() => {
    fetch('/api/admin/lotto/settings', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (j?.settings) setSettings(j.settings as LottoSettings); })
      .catch(() => { /* leave null until user opens settings */ });
  }, []);

  const saveSettings = async (patch: Partial<LottoSettings>) => {
    setSettingsBusy(true);
    try {
      const r = await fetch('/api/admin/lotto/settings', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(patch),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.message ?? j?.code ?? 'Save failed');
      setSettings(j.settings as LottoSettings);
      setToast('Lotto settings saved.');
      setTimeout(() => setToast(null), 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSettingsBusy(false);
    }
  };

  const save = async () => {
    if (!editor) return;
    setBusy(true);
    setError(null);
    const toIso = (v?: string | null) => (v ? new Date(v).toISOString() : null);
    const payload = {
      name: editor.name,
      schedule: editor.schedule || null,
      drawsAt: toIso(editor.drawsAt),
      digitsCount: Number(editor.digitsCount),
      ticketPrice: Number(editor.ticketPrice),
      prizePool: Number(editor.prizePool),
      accent: editor.accent,
      position: Number(editor.position),
      status: editor.status,
    };
    try {
      const res = editor.id
        ? await fetch(`/api/admin/lotto/${editor.id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) })
        : await fetch('/api/admin/lotto', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? data.code);
      setEditor(null);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm('Delete this draw?')) return;
    const res = await fetch(`/api/admin/lotto/${id}`, { method: 'DELETE' });
    if (res.ok) refresh();
  };

  const toggle = async (d: Draw) => {
    await fetch(`/api/admin/lotto/${d.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status: d.status === 'active' ? 'hidden' : 'active' }),
    });
    refresh();
  };

  const settle = async () => {
    if (!settling) return;
    setBusy(true);
    setError(null);
    try {
      const specials = settling.specials.split(',').map((s) => s.trim()).filter((s) => /^\d{4}$/.test(s));
      const consolations = settling.consolations.split(',').map((s) => s.trim()).filter((s) => /^\d{4}$/.test(s));
      const extraNumbers = (settling.second || settling.third || specials.length || consolations.length)
        ? {
            second: settling.second && /^\d{4}$/.test(settling.second) ? settling.second : null,
            third: settling.third && /^\d{4}$/.test(settling.third) ? settling.third : null,
            specials,
            consolations,
          }
        : null;
      const payload = {
        winningNumber: settling.winningNumber,
        ticketBaseValue: Number(settling.ticketBaseValue) || undefined,
        prize1xMult: Number(settling.prize1xMult) || undefined,
        prize2xMult: Number(settling.prize2xMult) || undefined,
        prize3xMult: Number(settling.prize3xMult) || undefined,
        prizeSpecialMult: Number(settling.prizeSpecialMult) || undefined,
        prizeConsoMult: Number(settling.prizeConsoMult) || undefined,
        extraNumbers,
        claimMode: settling.claimMode === 'inherit' ? undefined : settling.claimMode,
      };
      const res = await fetch(`/api/admin/lotto/${settling.draw.id}/settle`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? data.code ?? 'Settle failed');
      const breakdownText = Array.isArray(data.breakdown)
        ? data.breakdown.filter((b: TierRow) => b.count > 0).map((b: TierRow) => `${b.label}: ${b.count} (${formatBDT(b.paid)})`).join(' . ')
        : '';
      setToast(
        `Published ${settling.winningNumber}. ${data.totalWinners} winner(s), ${formatBDT(Number(data.totalPaid))} paid` +
          (breakdownText ? ` . ${breakdownText}` : '.'),
      );
      setTimeout(() => setToast(null), 8000);
      setSettling(null);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Settle failed');
    } finally {
      setBusy(false);
    }
  };

  // Auto-generate 23 winning numbers per the client spec. Fills the
  // settle form so the admin can review + edit before publishing.
  const runGenerate = async () => {
    if (!settling) return;
    setGenerateBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/lotto/${settling.draw.id}/generate-result`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? data.code ?? 'Generate failed');
      setSettling({
        ...settling,
        winningNumber: data.winningNumber,
        second: data.extraNumbers?.second ?? '',
        third: data.extraNumbers?.third ?? '',
        specials: Array.isArray(data.extraNumbers?.specials) ? data.extraNumbers.specials.join(', ') : '',
        consolations: Array.isArray(data.extraNumbers?.consolations) ? data.extraNumbers.consolations.join(', ') : '',
      });
      setDiagnose(null);
      setToast('Generated 23 winning numbers. Review and edit before publishing.');
      setTimeout(() => setToast(null), 4000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Generate failed');
    } finally {
      setGenerateBusy(false);
    }
  };

  const loadTickets = useCallback(async () => {
    setTicketsBusy(true);
    setError(null);
    try {
      const url = new URL('/api/admin/lotto/tickets', window.location.origin);
      if (ticketsFilters.drawId) url.searchParams.set('drawId', ticketsFilters.drawId);
      if (ticketsFilters.status) url.searchParams.set('status', ticketsFilters.status);
      if (ticketsFilters.number) url.searchParams.set('number', ticketsFilters.number);
      url.searchParams.set('take', '200');
      const res = await fetch(url.toString(), { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? data.code ?? 'Failed');
      setTicketsList(data.tickets as AdminTicketRow[]);
      setTicketsTotal(Number(data.total ?? 0));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setTicketsBusy(false);
    }
  }, [ticketsFilters]);

  const loadWinners = async (drawId: string) => {
    setWinnersBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/lotto/${drawId}/winners`, { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? data.code ?? 'Failed');
      setWinners(data as WinnersBreakdown);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setWinnersBusy(false);
    }
  };

  const runDiagnose = async () => {
    if (!settling) return;
    setDiagnoseBusy(true);
    setError(null);
    try {
      const payload = {
        winningNumber: settling.winningNumber,
        ticketBaseValue: Number(settling.ticketBaseValue) || undefined,
        prize1xMult: Number(settling.prize1xMult) || undefined,
        prize2xMult: Number(settling.prize2xMult) || undefined,
        prize3xMult: Number(settling.prize3xMult) || undefined,
        prizeSpecialMult: Number(settling.prizeSpecialMult) || undefined,
        prizeConsoMult: Number(settling.prizeConsoMult) || undefined,
      };
      const res = await fetch(`/api/admin/lotto/${settling.draw.id}/diagnose`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? data.code ?? 'Diagnose failed');
      setDiagnose(data as DiagnoseResult);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Diagnose failed');
    } finally {
      setDiagnoseBusy(false);
    }
  };

  const runRollover = async () => {
    setRolloverBusy(true);
    try {
      const res = await fetch('/api/cron/lotto-rollover', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? data.code ?? 'Rollover failed');
      const summary = typeof data.message === 'string' && data.message.length
        ? data.message
        : `closed ${data.closed ?? 0}, seeded ${data.seeded ?? 0}`;
      const after = typeof data.activeAfter === 'number' ? ` Active draws now: ${data.activeAfter}.` : '';
      setToast(`Rollover: ${summary}.${after}`);
      setTimeout(() => setToast(null), 8000);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Rollover failed');
    } finally {
      setRolloverBusy(false);
    }
  };

  const seedDefault = async () => {
    setSeedBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/lotto/seed-default', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? data.code ?? 'Seed failed');
      setToast(String(data.message ?? 'Default Daily 4D draw is ready.'));
      setTimeout(() => setToast(null), 6500);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Seed failed');
    } finally {
      setSeedBusy(false);
    }
  };

  const resultByDraw = new Map<string, ResultRow>(results.map((r) => [r.drawId, r]));

  return (
    <>
      <PageHeader
        title="Lotto Draws"
        subtitle="Daily 4D lottery + settlement"
        icon={<Ticket className="h-5 w-5" />}
        action={
          <div className="flex gap-2">
            <Button variant="ghost" leftIcon={<Sparkles className="h-3.5 w-3.5" />} loading={seedBusy} onClick={seedDefault} title="Idempotently create the canonical Daily 4D draw for the next 7:30 PM slot.">
              Seed default
            </Button>
            <Button variant="ghost" leftIcon={<RefreshCcw className={`h-3.5 w-3.5 ${rolloverBusy ? 'animate-spin' : ''}`} />} onClick={runRollover} loading={rolloverBusy}>
              Run rollover
            </Button>
            <Button leftIcon={<Plus className="h-4 w-4" />} onClick={() => setEditor({ ...BLANK, position: draws.length + 1 })}>New Draw</Button>
          </div>
        }
      />

      {toast ? (
        <Card padding="md" className="mb-4">
          <p className="flex items-center gap-2 text-sm text-signal-ok">
            <CheckCircle2 className="h-4 w-4" /> {toast}
          </p>
        </Card>
      ) : null}

      {error ? <Card padding="md" className="mb-4"><p className="text-sm text-signal-danger">{error}</p></Card> : null}

      <Card padding="md" className="mb-4">
        <p className="text-[10px] font-bold uppercase tracking-wider text-ink-lo">Lotto engine settings</p>
        {settings ? (
          <div className="mt-2 grid gap-3 sm:grid-cols-4">
            <FormField label="Lotto enabled" hint="Off pauses ticket accrual and the public lotto module.">
              <Select value={settings.enabled ? 'true' : 'false'} onChange={(e) => saveSettings({ enabled: e.target.value === 'true' })} disabled={settingsBusy}>
                <option value="true">Enabled</option>
                <option value="false">Disabled</option>
              </Select>
            </FormField>
            <FormField label="Claim mode" hint="Auto credits lotto balance on settle. Manual writes pending winnings that the player claims explicitly.">
              <Select value={settings.claimMode} onChange={(e) => saveSettings({ claimMode: e.target.value as 'auto' | 'manual' })} disabled={settingsBusy}>
                <option value="auto">Auto-credit</option>
                <option value="manual">Manual claim</option>
              </Select>
            </FormField>
            <FormField label="Deposit per ticket block (BDT)">
              <Input
                type="number"
                min={100}
                defaultValue={settings.ticketRateAmount}
                disabled={settingsBusy}
                onBlur={(e) => {
                  const v = Number(e.target.value);
                  if (Number.isFinite(v) && v >= 100 && v !== settings.ticketRateAmount) {
                    saveSettings({ ticketRateAmount: Math.floor(v) });
                  }
                }}
              />
            </FormField>
            <FormField label="Tickets per block">
              <Input
                type="number"
                min={1}
                defaultValue={settings.ticketRateCount}
                disabled={settingsBusy}
                onBlur={(e) => {
                  const v = Number(e.target.value);
                  if (Number.isFinite(v) && v >= 1 && v !== settings.ticketRateCount) {
                    saveSettings({ ticketRateCount: Math.floor(v) });
                  }
                }}
              />
            </FormField>
          </div>
        ) : (
          <p className="mt-2 text-sm text-ink-mid">Loading settings...</p>
        )}
      </Card>

      <Card padding="md" className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-ink-mid">
          Browse every ticket, every settled-draw winner, or open the per-draw settle modal.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="neon"
            leftIcon={<List className="h-3.5 w-3.5" />}
            onClick={() => { setTicketsOpen(true); void loadTickets(); }}
          >
            View All Tickets
          </Button>
        </div>
      </Card>

      <Card padding="md" className="mb-4">
        <p className="text-xs text-ink-mid">
          Settling a draw publishes the winning 4-digit number and pays out across six tiers, no double-pay
          (each ticket gets one tier - the highest it qualifies for): <span className="font-semibold text-ink-hi">1st exact</span> (full first-prize multiplier),
          <span className="font-semibold text-ink-hi"> 1st iBox</span> (first / unique-permutation-count for any other order),
          <span className="font-semibold text-ink-hi"> Special</span> (first 2 digits exact),
          <span className="font-semibold text-ink-hi"> 2nd</span> (last 3 digits exact),
          <span className="font-semibold text-ink-hi"> 3rd</span> (last 2 digits exact),
          <span className="font-semibold text-ink-hi"> Consolation</span> (winning number +/- 1 with wraparound).
          Use <span className="font-semibold text-ink-hi">Run rollover</span> daily at 7:30 PM (or via the cron endpoint
          POST /api/cron/lotto-rollover with Authorization: Bearer $CRON_SECRET) to close past-due draws and seed the next day.
        </p>
      </Card>

      {loading ? (
        <Card padding="lg">Loading...</Card>
      ) : draws.length === 0 ? (
        <Card padding="lg">
          <EmptyState
            title="No lotto draws yet"
            description="The lottery pipeline needs at least one active draw. Click the button below to create the canonical Daily 4D draw (name: Daily 4D, schedule: 19:30 BST, 4 digits, base ticket 20 BDT, multipliers 2000/800/300/150/30). Idempotent - calling it twice is safe."
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <Button variant="gold" leftIcon={<Sparkles className="h-4 w-4" />} loading={seedBusy} onClick={seedDefault}>
                  Create Daily 4D Draw
                </Button>
                <Button variant="neon" leftIcon={<Plus className="h-4 w-4" />} onClick={() => setEditor({ ...BLANK, position: 1 })}>
                  New Custom Draw
                </Button>
              </div>
            }
          />
        </Card>
      ) : (
        <div className="space-y-3">
          {draws.map((d) => {
            const result = resultByDraw.get(d.id);
            return (
              <Card key={d.id} padding="lg" className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-base font-extrabold text-brand-ink">{d.name}</p>
                    <Chip tone={d.status === 'active' ? 'ok' : 'neutral'}>{d.status}</Chip>
                    {result ? (
                      <Chip tone="ok">settled · {result.winningNumber}</Chip>
                    ) : (
                      <Chip tone="warn">awaiting settlement</Chip>
                    )}
                    <span className="text-[11px] text-brand-inkMute">position {d.position}</span>
                  </div>
                  <p className="text-sm text-brand-inkSoft">{d.schedule ?? 'no schedule'}</p>
                  <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-brand-inkSoft">
                    <span><span className="text-brand-inkMute">Digits</span> <span className="font-bold text-brand-ink">{d.digitsCount}</span></span>
                    <span><span className="text-brand-inkMute">Ticket base</span> <span className="font-bold text-brand-ink">{formatBDT(Number(d.ticketPrice))}</span></span>
                    <span><span className="text-brand-inkMute">Prize pool</span> <span className="font-bold text-brand-ink">{formatBDT(Number(d.prizePool), { compact: true })}</span></span>
                    {d.drawsAt ? (
                      <span><span className="text-brand-inkMute">Next draw</span> <span className="font-bold text-brand-ink">{formatDateTime(d.drawsAt, lang)}</span></span>
                    ) : null}
                  </div>
                  {result ? (
                    <p className="mt-1 text-xs text-brand-inkMute">
                      Published {formatDateTime(result.publishedAt, lang)} · {result.totalWinners} winner(s) · {formatBDT(result.totalPaid)} paid out
                    </p>
                  ) : null}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Switch checked={d.status === 'active'} onChange={() => toggle(d)} />
                  {!result ? (
                    <Button
                      size="sm"
                      variant="gold"
                      leftIcon={<Crown className="h-3.5 w-3.5" />}
                      onClick={() =>
                        setSettling({
                          draw: d,
                          winningNumber: '',
                          ticketBaseValue: String(d.ticketPrice),
                          prize1xMult: '2000',
                          prize2xMult: '800',
                          prize3xMult: '300',
                          prizeSpecialMult: '150',
                          prizeConsoMult: '30',
                          second: '',
                          third: '',
                          specials: '',
                          consolations: '',
                          claimMode: 'inherit',
                        })
                      }
                    >
                      Settle
                    </Button>
                  ) : null}
                  {result ? (
                    <Button
                      size="sm"
                      variant="neon"
                      leftIcon={<Trophy className="h-3.5 w-3.5" />}
                      onClick={() => loadWinners(d.id)}
                    >
                      Winners
                    </Button>
                  ) : null}
                  <Button size="sm" variant="neon" leftIcon={<Pencil className="h-3.5 w-3.5" />} onClick={() => setEditor({ ...d, drawsAt: d.drawsAt ? d.drawsAt.slice(0, 16) : '' })}>Edit</Button>
                  <Button size="sm" variant="danger" leftIcon={<Trash2 className="h-3.5 w-3.5" />} onClick={() => remove(d.id)}>Delete</Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Modal open={!!editor} onOpenChange={(v) => !v && setEditor(null)} title={editor?.id ? 'Edit Draw' : 'New Draw'} size="lg">
        {editor ? (
          <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); void save(); }}>
            <div className="grid gap-3 md:grid-cols-2">
              <FormField label="Name" required>
                <Input value={editor.name} onChange={(e) => setEditor({ ...editor, name: e.target.value })} />
              </FormField>
              <FormField label="Status">
                <Select value={editor.status} onChange={(e) => setEditor({ ...editor, status: e.target.value as Status })}>
                  <option value="active">Active</option>
                  <option value="hidden">Hidden</option>
                  <option value="paused">Paused</option>
                </Select>
              </FormField>
            </div>
            <FormField label="Schedule" hint="Human readable, e.g. Daily 19:30">
              <Input value={editor.schedule ?? ''} onChange={(e) => setEditor({ ...editor, schedule: e.target.value })} />
            </FormField>
            <div className="grid gap-3 md:grid-cols-3">
              <FormField label="Digits">
                <Input type="number" min="1" max="10" value={String(editor.digitsCount)} onChange={(e) => setEditor({ ...editor, digitsCount: Number(e.target.value) || 0 })} />
              </FormField>
              <FormField label="Ticket base value (BDT)" hint="Used as the unit prize when settling.">
                <Input type="number" min="0" step="1" value={String(editor.ticketPrice)} onChange={(e) => setEditor({ ...editor, ticketPrice: Number(e.target.value) || 0 })} />
              </FormField>
              <FormField label="Prize pool (BDT)">
                <Input type="number" min="0" step="1000" value={String(editor.prizePool)} onChange={(e) => setEditor({ ...editor, prizePool: Number(e.target.value) || 0 })} />
              </FormField>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <FormField label="Next draw at">
                <Input type="datetime-local" value={editor.drawsAt ?? ''} onChange={(e) => setEditor({ ...editor, drawsAt: e.target.value })} />
              </FormField>
              <FormField label="Accent">
                <Select value={editor.accent} onChange={(e) => setEditor({ ...editor, accent: e.target.value as Accent })}>
                  <option value="yellow">Yellow</option>
                  <option value="blue">Blue</option>
                  <option value="red">Red</option>
                  <option value="royal">Royal</option>
                </Select>
              </FormField>
              <FormField label="Position">
                <Input type="number" min="0" value={String(editor.position)} onChange={(e) => setEditor({ ...editor, position: Number(e.target.value) || 0 })} />
              </FormField>
            </div>
            <p className="text-xs text-brand-inkMute">
              Tickets are now generated automatically when a deposit is approved. Manual purchase is not supported.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" type="button" onClick={() => setEditor(null)}>Cancel</Button>
              <Button type="submit" loading={busy}>Save</Button>
            </div>
          </form>
        ) : null}
      </Modal>

      <Modal open={!!settling} onOpenChange={(v) => { if (!v) { setSettling(null); setDiagnose(null); } }} title="Settle Draw" size="md">
        {settling ? (
          <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); void settle(); }}>
            <div className="rounded-xl border border-neon/10 bg-base-deep/50 p-3 text-sm">
              <p className="text-ink-mid">Draw</p>
              <p className="font-extrabold text-ink-hi">{settling.draw.name}</p>
              <p className="text-xs text-ink-lo">{settling.draw.schedule}</p>
            </div>
            <FormField label="Winning 4-digit number" required hint="Digits only, e.g. 1234 or 1111.">
              <Input
                value={settling.winningNumber}
                onChange={(e) => setSettling({ ...settling, winningNumber: e.target.value.replace(/\D/g, '').slice(0, 4) })}
                inputMode="numeric"
                placeholder="1234"
                maxLength={4}
              />
            </FormField>
            <div className="grid gap-3 md:grid-cols-3">
              <FormField label="Ticket base value">
                <Input type="number" min="1" value={settling.ticketBaseValue} onChange={(e) => setSettling({ ...settling, ticketBaseValue: e.target.value })} />
              </FormField>
              <FormField label="1st prize ×">
                <Input type="number" min="1" value={settling.prize1xMult} onChange={(e) => setSettling({ ...settling, prize1xMult: e.target.value })} />
              </FormField>
              <FormField label="2nd prize ×">
                <Input type="number" min="1" value={settling.prize2xMult} onChange={(e) => setSettling({ ...settling, prize2xMult: e.target.value })} />
              </FormField>
              <FormField label="3rd prize ×">
                <Input type="number" min="1" value={settling.prize3xMult} onChange={(e) => setSettling({ ...settling, prize3xMult: e.target.value })} />
              </FormField>
              <FormField label="Special ×">
                <Input type="number" min="1" value={settling.prizeSpecialMult} onChange={(e) => setSettling({ ...settling, prizeSpecialMult: e.target.value })} />
              </FormField>
              <FormField label="Consolation ×">
                <Input type="number" min="1" value={settling.prizeConsoMult} onChange={(e) => setSettling({ ...settling, prizeConsoMult: e.target.value })} />
              </FormField>
            </div>

            <div className="rounded-xl border border-amber-300/30 bg-amber-300/5 p-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-amber-200">Public display - extra prize numbers (optional)</p>
              <p className="mt-1 text-[11px] text-brand-inkMute">
                The settlement engine derives every prize tier from the winning number above. These extra numbers are display-only on the public result history card.
              </p>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <FormField label="2nd prize number">
                  <Input
                    value={settling.second}
                    onChange={(e) => setSettling({ ...settling, second: e.target.value.replace(/\D/g, '').slice(0, 4) })}
                    inputMode="numeric"
                    placeholder="e.g. 5678"
                    maxLength={4}
                  />
                </FormField>
                <FormField label="3rd prize number">
                  <Input
                    value={settling.third}
                    onChange={(e) => setSettling({ ...settling, third: e.target.value.replace(/\D/g, '').slice(0, 4) })}
                    inputMode="numeric"
                    placeholder="e.g. 1234"
                    maxLength={4}
                  />
                </FormField>
                <FormField label="Special prize numbers" hint="Comma-separated 4-digit list">
                  <Input
                    value={settling.specials}
                    onChange={(e) => setSettling({ ...settling, specials: e.target.value })}
                    placeholder="0123, 4567, 8901"
                  />
                </FormField>
                <FormField label="Consolation prize numbers" hint="Comma-separated 4-digit list">
                  <Input
                    value={settling.consolations}
                    onChange={(e) => setSettling({ ...settling, consolations: e.target.value })}
                    placeholder="0231, 4576, 8910"
                  />
                </FormField>
              </div>
            </div>

            <FormField label="Claim mode for this settlement" hint="Inherit follows SystemSetting `lotto_claim_mode`. Manual writes pending winnings that the player claims explicitly.">
              <Select value={settling.claimMode} onChange={(e) => setSettling({ ...settling, claimMode: e.target.value as SettleDraft['claimMode'] })}>
                <option value="inherit">Inherit from settings</option>
                <option value="auto">Auto-credit lotto balance</option>
                <option value="manual">Manual claim required</option>
              </Select>
            </FormField>

            <p className="text-xs text-brand-inkMute">
              All 6 tiers are derived from the winning number above. Each ticket is paid at most once; highest tier wins. Click <span className="font-semibold text-brand-ink">Diagnose</span> below to dry-run before publishing. Re-settling the same draw is blocked.
            </p>

            {diagnose ? (
              <div className="rounded-xl border border-neon/15 bg-base-deep/60 p-3 text-sm">
                <p className="text-xs uppercase tracking-wider text-ink-lo">Dry-run preview</p>
                <p className="mt-1 text-ink-mid">
                  {diagnose.ticketCount} ticket{diagnose.ticketCount === 1 ? '' : 's'} in draw . <span className="font-semibold text-ink-hi">{diagnose.totalWinners}</span> winner{diagnose.totalWinners === 1 ? '' : 's'} across <span className="font-semibold text-ink-hi">{diagnose.uniqueWinners}</span> user{diagnose.uniqueWinners === 1 ? '' : 's'} . total payout <span className="font-semibold text-gradient-gold">{formatBDT(diagnose.totalPaid)}</span>
                </p>
                <ul className="mt-2 grid gap-1 text-xs sm:grid-cols-2">
                  {diagnose.breakdown.map((b) => (
                    <li key={b.tier} className={b.count > 0 ? 'text-ink-hi' : 'text-ink-lo'}>
                      <span className="font-mono">{b.label}</span>: {b.count} ({formatBDT(b.paid)})
                    </li>
                  ))}
                </ul>
                {diagnose.alreadySettled ? (
                  <p className="mt-2 text-xs text-signal-warn">This draw is already settled. The Publish + Settle button will fail.</p>
                ) : null}
              </div>
            ) : null}

            <div className="flex flex-wrap justify-end gap-2 pt-2">
              <Button variant="ghost" type="button" onClick={() => { setSettling(null); setDiagnose(null); }}>Cancel</Button>
              <Button
                type="button"
                variant="neon"
                leftIcon={<Wand2 className="h-3.5 w-3.5" />}
                loading={generateBusy}
                onClick={runGenerate}
                title="Server picks 23 random winning numbers per tier (1st, 2nd, 3rd, 10 specials, 10 consolations). Review and edit before publishing."
              >
                Generate
              </Button>
              <Button
                type="button"
                variant="neon"
                leftIcon={<Stethoscope className="h-3.5 w-3.5" />}
                loading={diagnoseBusy}
                disabled={!/^\d{4}$/.test(settling.winningNumber)}
                onClick={runDiagnose}
              >
                Diagnose
              </Button>
              <Button type="submit" variant="gold" loading={busy} disabled={!/^\d{4}$/.test(settling.winningNumber)}>
                Publish + Settle
              </Button>
            </div>
          </form>
        ) : null}
      </Modal>

      {/* View All Tickets browser */}
      <Modal
        open={ticketsOpen}
        onOpenChange={(v) => { if (!v) { setTicketsOpen(false); setTicketsList([]); setTicketsTotal(0); } }}
        title="All lottery tickets"
        size="xl"
      >
        <div className="space-y-3">
          <div className="grid gap-2 sm:grid-cols-4">
            <FormField label="Draw">
              <Select
                value={ticketsFilters.drawId}
                onChange={(e) => setTicketsFilters((p) => ({ ...p, drawId: e.target.value }))}
              >
                <option value="">All draws</option>
                {draws.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </Select>
            </FormField>
            <FormField label="Status">
              <Select
                value={ticketsFilters.status}
                onChange={(e) => setTicketsFilters((p) => ({ ...p, status: e.target.value }))}
              >
                <option value="">All statuses</option>
                <option value="issued">Issued (active)</option>
                <option value="won">Won</option>
                <option value="lost">Lost</option>
                <option value="void">Void</option>
              </Select>
            </FormField>
            <FormField label="Number contains">
              <Input
                value={ticketsFilters.number}
                onChange={(e) => setTicketsFilters((p) => ({ ...p, number: e.target.value.replace(/\D/g, '').slice(0, 4) }))}
                placeholder="e.g. 1234"
                inputMode="numeric"
                maxLength={4}
              />
            </FormField>
            <div className="flex items-end">
              <Button variant="gold" loading={ticketsBusy} onClick={() => void loadTickets()} className="w-full">
                Search
              </Button>
            </div>
          </div>
          <p className="text-xs text-ink-mid">
            Showing {ticketsList.length} of {ticketsTotal} tickets. Capped at 200 per page; tighten filters to find specific rows.
          </p>
          {ticketsList.length === 0 ? (
            <Card padding="lg"><EmptyState title="No tickets" description="No tickets match the current filters." /></Card>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-base-deep/40 text-xs uppercase tracking-wider text-ink-lo">
                  <tr>
                    <th className="px-3 py-2 text-left">Number</th>
                    <th className="px-3 py-2 text-left">User</th>
                    <th className="px-3 py-2 text-left">Draw</th>
                    <th className="px-3 py-2 text-left">Status</th>
                    <th className="px-3 py-2 text-left">Source</th>
                    <th className="px-3 py-2 text-left">Issued</th>
                  </tr>
                </thead>
                <tbody>
                  {ticketsList.map((t) => (
                    <tr key={t.id} className="border-b border-neon/10">
                      <td className="px-3 py-2 font-mono font-bold tabular-nums text-ink-hi">{t.number}</td>
                      <td className="px-3 py-2 text-ink-mid">
                        {t.user ? (
                          <span>
                            <span className="font-semibold text-ink-hi">{t.user.username}</span>{' '}
                            <span className="text-[11px] text-ink-lo">{t.user.phone}</span>
                          </span>
                        ) : '-'}
                      </td>
                      <td className="px-3 py-2 text-ink-mid">{t.draw?.name ?? '-'}</td>
                      <td className="px-3 py-2">
                        <Chip tone={t.status === 'won' ? 'ok' : t.status === 'issued' ? 'warn' : 'neutral'}>{t.status}</Chip>
                      </td>
                      <td className="px-3 py-2 text-xs text-ink-mid">{t.source}</td>
                      <td className="px-3 py-2 text-xs text-ink-lo">{formatDateTime(t.generatedAt, lang)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Modal>

      {/* View Winners breakdown per draw */}
      <Modal
        open={!!winners}
        onOpenChange={(v) => { if (!v) setWinners(null); }}
        title={winners ? `Winners - ${winners.draw.name}` : 'Winners'}
        size="xl"
      >
        {winnersBusy ? (
          <p className="text-sm text-ink-mid">Loading winners...</p>
        ) : winners ? (
          <div className="space-y-4">
            {winners.result ? (
              <Card padding="md">
                <div className="flex flex-wrap items-baseline justify-between gap-3">
                  <div>
                    <p className="text-[11px] uppercase tracking-wider text-ink-lo">Winning number</p>
                    <p className="font-mono text-2xl font-extrabold tabular-nums text-gradient-gold">{winners.result.winningNumber}</p>
                  </div>
                  <div className="text-right text-sm">
                    <p className="text-ink-mid">
                      Published <span className="font-semibold text-ink-hi">{formatDateTime(winners.result.publishedAt, lang)}</span>
                    </p>
                    <p className="text-ink-mid">
                      Total paid <span className="font-semibold text-ink-hi">{formatBDT(winners.result.totalPaid)}</span> across {winners.total} winner(s)
                    </p>
                  </div>
                </div>
              </Card>
            ) : (
              <Card padding="md"><p className="text-sm text-ink-mid">Draw not yet settled.</p></Card>
            )}

            <div className="grid gap-3 md:grid-cols-2">
              <Card padding="md">
                <p className="text-[11px] uppercase tracking-wider text-ink-lo">By prize tier</p>
                <ul className="mt-2 space-y-1 text-sm">
                  {Object.entries(winners.byTier).map(([tier, agg]) => (
                    <li key={tier} className="flex items-center justify-between">
                      <span className="font-mono text-ink-hi">{tier}</span>
                      <span className="text-ink-mid">{agg.count} <span className="text-ink-lo">({formatBDT(agg.sumAmount)})</span></span>
                    </li>
                  ))}
                </ul>
              </Card>
              <Card padding="md">
                <p className="text-[11px] uppercase tracking-wider text-ink-lo">By claim status</p>
                <ul className="mt-2 space-y-1 text-sm">
                  {Object.entries(winners.byStatus).map(([status, agg]) => (
                    <li key={status} className="flex items-center justify-between">
                      <span className="text-ink-hi">{status}</span>
                      <span className="text-ink-mid">{agg.count} <span className="text-ink-lo">({formatBDT(agg.sumAmount)})</span></span>
                    </li>
                  ))}
                </ul>
              </Card>
            </div>

            {winners.winners.length === 0 ? (
              <Card padding="lg"><EmptyState title="No winners" description="This draw produced no winning tickets." /></Card>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-base-deep/40 text-xs uppercase tracking-wider text-ink-lo">
                    <tr>
                      <th className="px-3 py-2 text-left">Ticket</th>
                      <th className="px-3 py-2 text-left">Tier</th>
                      <th className="px-3 py-2 text-right">Amount</th>
                      <th className="px-3 py-2 text-left">Status</th>
                      <th className="px-3 py-2 text-left">User</th>
                      <th className="px-3 py-2 text-left">Credited</th>
                    </tr>
                  </thead>
                  <tbody>
                    {winners.winners.map((w) => (
                      <tr key={w.id} className="border-b border-neon/10">
                        <td className="px-3 py-2 font-mono font-bold tabular-nums text-ink-hi">{w.ticketNumber}</td>
                        <td className="px-3 py-2 text-xs text-ink-mid">{w.prizeTier}</td>
                        <td className="px-3 py-2 text-right font-semibold text-gradient-gold tabular-nums">{formatBDT(w.amount)}</td>
                        <td className="px-3 py-2">
                          <Chip tone={w.status === 'credited' ? 'ok' : w.status === 'cancelled' ? 'danger' : 'warn'}>{w.status}</Chip>
                        </td>
                        <td className="px-3 py-2 text-ink-mid">{w.user?.username ?? '-'}</td>
                        <td className="px-3 py-2 text-xs text-ink-lo">{w.creditedAt ? formatDateTime(w.creditedAt, lang) : '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : null}
      </Modal>
    </>
  );
}
