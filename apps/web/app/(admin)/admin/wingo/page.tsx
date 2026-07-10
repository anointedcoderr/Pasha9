// Built by Anointed Coder.
//
// Pasha WinGo admin console. Three tabs:
//
//   Settings - the global on/off switch (ships OFF), a per-mode on/off
//              row for each of the four streams, and the min/max stake
//              caps. Backed by the SystemSetting keys in lib/wingo/flag.
//
//   Rounds   - filterable list of recent rounds with the drawn result,
//              bet count and staked/paid money totals. Click a row to
//              drill into every bet line for that round.
//
//   Modes    - per-mode audit summary (settled rounds, 24h volume,
//              staked, paid, house result).
//
// Read-only audit plus config only. No settlement or wallet logic lives
// here; the engine owns all money movement. Strings are bilingual
// (English + Bangla) to match the native-games surfaces.

'use client';

import { useCallback, useEffect, useState } from 'react';
import { PageHeader } from '@/components/site/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { Modal } from '@/components/ui/Modal';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs';
import { Switch } from '@/components/ui/Switch';
import { Dices, RefreshCw, AlertCircle, Save } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

// ---------- Types (mirror the /api/admin/wingo response shapes) ----------

interface ModeTotals {
  mode: string;
  labelEn: string;
  labelBn: string;
  enabled: boolean;
  rounds: number;
  rounds24h: number;
  lastDrawAt: string | null;
  totalStake: number;
  totalPayout: number;
  houseResult: number;
}

interface Paytable {
  colorGreen: number;
  colorRed: number;
  colorViolet: number;
  colorHalf: number;
  number: number;
  big: number;
  small: number;
}

interface Overview {
  settings: {
    enabled: boolean;
    modes: Record<string, boolean>;
    minStake: number;
    maxStake: number;
    paytable: Paytable;
    homepageImageUrl: string | null;
  };
  modes: ModeTotals[];
}

// The bet-type rows of the editable paytable, in display order. `key`
// maps to the Paytable field; `half` marks the special 1.5x color case.
const PAYTABLE_FIELDS: Array<{ key: keyof Paytable; en: string; bn: string }> = [
  { key: 'colorGreen', en: 'Green', bn: 'সবুজ' },
  { key: 'colorRed', en: 'Red', bn: 'লাল' },
  { key: 'colorViolet', en: 'Violet', bn: 'বেগুনি' },
  { key: 'colorHalf', en: 'Color on 0 or 5 (half)', bn: '০ বা ৫-এ রঙ (হাফ)' },
  { key: 'number', en: 'Number (exact)', bn: 'নম্বর (সঠিক)' },
  { key: 'big', en: 'Big (5-9)', bn: 'বড় (৫-৯)' },
  { key: 'small', en: 'Small (0-4)', bn: 'ছোট (০-৪)' },
];

const DEFAULT_PAYTABLE: Paytable = {
  colorGreen: 2,
  colorRed: 2,
  colorViolet: 4.5,
  colorHalf: 1.5,
  number: 9,
  big: 2,
  small: 2,
};

interface RoundRow {
  id: string;
  mode: string;
  periodNumber: string;
  status: string;
  result: number | null;
  resultColor: string | null;
  resultSize: string | null;
  betCount: number;
  totalStake: number;
  totalPayout: number;
  serverSeedHash: string;
  serverSeed?: string | null;
  paytable?: Paytable | null;
  drawsAt: string;
  drawnAt: string | null;
  settledAt: string | null;
}

interface BetRow {
  id: string;
  userId: string;
  username: string | null;
  betType: string;
  betValue: string;
  unitAmount: number;
  quantity: number;
  betAmount: number;
  status: string;
  payoutMultiplier: number;
  payoutAmount: number;
  createdAt: string;
}

interface RoundDetail {
  round: RoundRow;
  bets: BetRow[];
}

const MODE_ORDER = ['wingo_30s', 'wingo_1m', 'wingo_3m', 'wingo_5m'];

function fmtMoney(n: number): string {
  return `BDT ${Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function roundStatusTone(s: string): 'ok' | 'warn' | 'info' | 'neutral' {
  if (s === 'settled') return 'ok';
  if (s === 'drawn') return 'info';
  if (s === 'closed') return 'warn';
  return 'neutral';
}

function betStatusTone(s: string): 'ok' | 'danger' | 'warn' | 'neutral' {
  if (s === 'WON') return 'ok';
  if (s === 'LOST') return 'danger';
  if (s === 'PENDING') return 'warn';
  return 'neutral';
}

// The visual identity of a drawn digit. 0 = red+violet, 5 = green+violet,
// evens red, odds green; matches the paytable colour map.
function ballClasses(result: number | null): string {
  if (result === null) return 'bg-base-panel text-ink-mid';
  if (result === 0) return 'bg-gradient-to-br from-signal-danger to-purple-500 text-white';
  if (result === 5) return 'bg-gradient-to-br from-signal-ok to-purple-500 text-white';
  return result % 2 === 0 ? 'bg-signal-danger text-white' : 'bg-signal-ok text-white';
}

export default function AdminWingoPage() {
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Local editable copy of settings.
  const [enabled, setEnabled] = useState(false);
  const [modeFlags, setModeFlags] = useState<Record<string, boolean>>({});
  const [minStake, setMinStake] = useState('1');
  const [maxStake, setMaxStake] = useState('100000');
  // Editable paytable, held as strings so the inputs stay controlled.
  const [paytable, setPaytable] = useState<Record<keyof Paytable, string>>(() => {
    const init = {} as Record<keyof Paytable, string>;
    for (const f of PAYTABLE_FIELDS) init[f.key] = String(DEFAULT_PAYTABLE[f.key]);
    return init;
  });
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  // Rounds tab.
  const [filterMode, setFilterMode] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [rounds, setRounds] = useState<RoundRow[]>([]);
  const [roundsLoading, setRoundsLoading] = useState(false);
  const [detail, setDetail] = useState<RoundDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const applyOverview = useCallback((o: Overview) => {
    setData(o);
    setEnabled(o.settings.enabled);
    setModeFlags({ ...o.settings.modes });
    setMinStake(String(o.settings.minStake));
    setMaxStake(String(o.settings.maxStake));
    const pt = o.settings.paytable ?? DEFAULT_PAYTABLE;
    const next = {} as Record<keyof Paytable, string>;
    for (const f of PAYTABLE_FIELDS) next[f.key] = String(pt[f.key] ?? DEFAULT_PAYTABLE[f.key]);
    setPaytable(next);
  }, []);

  const load = useCallback(async () => {
    setRefreshing(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/wingo', { cache: 'no-store' });
      const j = await res.json().catch(() => null);
      if (!res.ok) throw new Error(j?.message ?? j?.code ?? `HTTP ${res.status}`);
      applyOverview(j as Overview);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  }, [applyOverview]);

  useEffect(() => { load(); }, [load]);

  const loadRounds = useCallback(async () => {
    setRoundsLoading(true);
    try {
      const url = new URL('/api/admin/wingo/rounds', window.location.origin);
      if (filterMode) url.searchParams.set('mode', filterMode);
      if (filterStatus) url.searchParams.set('status', filterStatus);
      url.searchParams.set('limit', '100');
      const res = await fetch(url.toString(), { cache: 'no-store' });
      const j = await res.json().catch(() => null);
      if (res.ok && Array.isArray(j?.rounds)) setRounds(j.rounds as RoundRow[]);
      else setRounds([]);
    } catch {
      setRounds([]);
    } finally {
      setRoundsLoading(false);
    }
  }, [filterMode, filterStatus]);

  useEffect(() => { loadRounds(); }, [loadRounds]);

  const openDetail = async (roundId: string) => {
    setDetailLoading(true);
    setDetail(null);
    try {
      const res = await fetch(`/api/admin/wingo/rounds/${roundId}`, { cache: 'no-store' });
      const j = await res.json().catch(() => null);
      if (res.ok) setDetail(j as RoundDetail);
    } catch {
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  };

  const saveSettings = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/wingo', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          enabled,
          modes: modeFlags,
          minStake: Number(minStake),
          maxStake: Number(maxStake),
          paytable: PAYTABLE_FIELDS.reduce((acc, f) => {
            acc[f.key] = Number(paytable[f.key]);
            return acc;
          }, {} as Record<keyof Paytable, number>),
        }),
      });
      const j = await res.json().catch(() => null);
      if (!res.ok) {
        setError(j?.message ?? j?.code ?? 'Save failed');
        return;
      }
      applyOverview(j as Overview);
      setSavedAt(Date.now());
    } catch {
      setError('Could not reach server');
    } finally {
      setSaving(false);
    }
  };

  const orderedModes = (data?.modes ?? []).slice().sort((a, b) => MODE_ORDER.indexOf(a.mode) - MODE_ORDER.indexOf(b.mode));

  return (
    <>
      <PageHeader
        title="Pasha WinGo"
        subtitle="Colour prediction game. Config, per-mode switches and full round audit. English and Bangla. রঙ অনুমান গেম, কনফিগ ও রাউন্ড অডিট।"
        icon={<Dices className="h-5 w-5" />}
        action={
          <Button variant="ghost" leftIcon={<RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} />} onClick={() => { load(); loadRounds(); }}>
            Reload / রিলোড
          </Button>
        }
      />

      {error ? (
        <Card padding="md" className="mb-4">
          <p className="inline-flex items-center gap-2 text-sm text-signal-danger">
            <AlertCircle className="h-4 w-4" /> {error}
          </p>
        </Card>
      ) : null}

      {loading ? (
        <p className="text-sm text-ink-mid">Loading... / লোড হচ্ছে...</p>
      ) : (
        <Tabs defaultValue="settings">
          <TabsList>
            <TabsTrigger value="settings">Settings / সেটিংস</TabsTrigger>
            <TabsTrigger value="rounds">Rounds / রাউন্ড</TabsTrigger>
            <TabsTrigger value="modes">Modes / মোড</TabsTrigger>
          </TabsList>

          {/* ---------------- Settings ---------------- */}
          <TabsContent value="settings">
            <Card padding="md" className="mb-4 border-l-4 border-signal-warn">
              <p className="text-sm font-semibold text-ink-hi inline-flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-signal-warn" />
                Ships disabled. Turn on only after wallet testing. / ওয়ালেট পরীক্ষার পরেই চালু করুন।
              </p>
              <p className="mt-1 text-xs text-ink-mid">
                While the global switch is OFF, every /api/games/wingo request returns a disabled state and players cannot bet. Place a small real-money bet end to end and confirm settlement in the Rounds tab before enabling publicly. / গ্লোবাল সুইচ বন্ধ থাকলে খেলোয়াড়রা বাজি ধরতে পারবে না।
              </p>
            </Card>

            <Card padding="md" className="mb-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-ink-hi">Global switch / গ্লোবাল সুইচ</p>
                  <p className="text-xs text-ink-mid">
                    Master on/off for the whole WinGo game. / পুরো উইনগো গেমের প্রধান সুইচ।
                  </p>
                </div>
                <Switch checked={enabled} onChange={setEnabled} label="WinGo global switch" />
              </div>
            </Card>

            <Card padding="md" className="mb-4">
              <p className="mb-3 text-sm font-semibold text-ink-hi">Modes / মোড</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {orderedModes.map((m) => (
                  <div key={m.mode} className="flex items-center justify-between rounded-lg border border-neon/10 bg-base-panel/60 p-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-ink-hi">{m.labelEn}</p>
                      <p className="truncate text-xs text-ink-mid">{m.labelBn}</p>
                    </div>
                    <Switch
                      checked={modeFlags[m.mode] ?? true}
                      onChange={(v) => setModeFlags((prev) => ({ ...prev, [m.mode]: v }))}
                      label={`${m.labelEn} switch`}
                    />
                  </div>
                ))}
              </div>
              <p className="mt-2 text-[11px] text-ink-lo">
                A mode is playable only when both the global switch and its own switch are on. / গ্লোবাল ও নিজস্ব সুইচ দুটোই চালু থাকলেই মোডটি খেলা যাবে।
              </p>
            </Card>

            <Card padding="md" className="mb-4">
              <p className="mb-3 text-sm font-semibold text-ink-hi">Stake limits / বাজির সীমা</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Min stake (BDT) / সর্বনিম্ন বাজি">
                  <input type="number" min={1} max={100000} step="1" value={minStake} onChange={(e) => setMinStake(e.target.value)} className="h-10 w-full rounded-lg border border-neon/15 bg-base-panel px-3 text-sm text-ink-hi focus:outline-none" />
                </Field>
                <Field label="Max stake (BDT) / সর্বোচ্চ বাজি">
                  <input type="number" min={1} max={100000} step="1" value={maxStake} onChange={(e) => setMaxStake(e.target.value)} className="h-10 w-full rounded-lg border border-neon/15 bg-base-panel px-3 text-sm text-ink-hi focus:outline-none" />
                </Field>
              </div>
              <p className="mt-2 text-[11px] text-ink-lo">
                Clamped to the engine bounds (1 to 100000 BDT). Max applies to a bet line after the quantity chip. / ইঞ্জিন সীমার মধ্যে সীমাবদ্ধ (১ থেকে ১০০০০০ টাকা)।
              </p>
            </Card>

            <Card padding="md" className="mb-4">
              <p className="mb-1 text-sm font-semibold text-ink-hi">Paytable / পেআউট</p>
              <p className="mb-3 text-xs text-ink-mid">
                Total-return multiplier per winning bet type: a win pays the stake times this number. Example: bet 100 at 2 returns 200, at 1.5 returns 150, at 0.5 returns 50. / প্রতিটি জয়ী বাজির মোট রিটার্ন গুণিতক: স্টেক গুণ এই সংখ্যা। যেমন ১০০ বাজি, ২ হলে ২০০, ১.৫ হলে ১৫০, ০.৫ হলে ৫০।
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                {PAYTABLE_FIELDS.map((f) => (
                  <Field key={f.key} label={`${f.en} / ${f.bn}`}>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step="0.1"
                      value={paytable[f.key]}
                      onChange={(e) => setPaytable((prev) => ({ ...prev, [f.key]: e.target.value }))}
                      className="h-10 w-full rounded-lg border border-neon/15 bg-base-panel px-3 text-sm text-ink-hi focus:outline-none"
                    />
                  </Field>
                ))}
              </div>
              <p className="mt-2 text-[11px] text-ink-lo">
                The half rate applies only when the result is 0 or 5 (Red on 0, Green on 5). Each value can be 0 to 100 and is frozen onto every round when it opens, so a change applies to the next rounds, never to bets already placed. / হাফ রেট শুধু ফলাফল ০ বা ৫ হলে প্রযোজ্য (০-এ লাল, ৫-এ সবুজ)। প্রতিটি মান ০ থেকে ১০০ হতে পারে এবং রাউন্ড শুরুতেই ফ্রিজ হয়, তাই পরিবর্তন পরের রাউন্ডে প্রযোজ্য, আগে রাখা বাজিতে নয়।
              </p>
            </Card>

            <div className="flex items-center justify-end gap-3">
              {savedAt ? <span className="text-xs text-signal-ok">Saved / সংরক্ষিত</span> : null}
              <Button variant="gold" leftIcon={<Save className="h-4 w-4" />} loading={saving} onClick={saveSettings}>
                Save settings / সংরক্ষণ
              </Button>
            </div>
          </TabsContent>

          {/* ---------------- Rounds ---------------- */}
          <TabsContent value="rounds">
            <Card padding="md" className="mb-4">
              <div className="grid gap-3 sm:grid-cols-3">
                <SelectFilter
                  label="Mode / মোড"
                  value={filterMode}
                  onChange={setFilterMode}
                  options={[
                    { value: '', label: 'All modes / সব মোড' },
                    ...orderedModes.map((m) => ({ value: m.mode, label: m.labelEn })),
                  ]}
                />
                <SelectFilter
                  label="Status / অবস্থা"
                  value={filterStatus}
                  onChange={setFilterStatus}
                  options={[
                    { value: '', label: 'Any status / যেকোনো' },
                    { value: 'open', label: 'open' },
                    { value: 'closed', label: 'closed' },
                    { value: 'drawn', label: 'drawn' },
                    { value: 'settled', label: 'settled' },
                  ]}
                />
              </div>
            </Card>

            <Card padding="none">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[820px] text-sm">
                  <thead className="border-b border-neon/15 bg-base-elev text-left text-[11px] uppercase tracking-wider text-ink-lo">
                    <tr>
                      <th className="px-3 py-2 font-semibold">Period / পিরিয়ড</th>
                      <th className="px-3 py-2 font-semibold">Mode</th>
                      <th className="px-3 py-2 font-semibold">Result</th>
                      <th className="px-3 py-2 font-semibold">Status</th>
                      <th className="px-3 py-2 font-semibold">Bets</th>
                      <th className="px-3 py-2 font-semibold">Staked</th>
                      <th className="px-3 py-2 font-semibold">Paid</th>
                      <th className="px-3 py-2 font-semibold">House</th>
                      <th className="px-3 py-2 font-semibold"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neon/10">
                    {roundsLoading ? (
                      <tr><td colSpan={9} className="px-3 py-5 text-center text-ink-mid">Loading... / লোড হচ্ছে...</td></tr>
                    ) : rounds.length === 0 ? (
                      <tr><td colSpan={9} className="px-3 py-8 text-center text-ink-mid">No rounds match the filters. / কোনো রাউন্ড নেই।</td></tr>
                    ) : (
                      rounds.map((r) => (
                        <tr key={r.id}>
                          <td className="px-3 py-2 font-mono text-[11px] text-ink-mid">{r.periodNumber}</td>
                          <td className="px-3 py-2 font-mono text-[11px] text-ink-mid">{r.mode}</td>
                          <td className="px-3 py-2">
                            <span className={cn('inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-extrabold', ballClasses(r.result))}>
                              {r.result === null ? '-' : r.result}
                            </span>
                          </td>
                          <td className="px-3 py-2"><Chip tone={roundStatusTone(r.status)}>{r.status}</Chip></td>
                          <td className="px-3 py-2 text-ink-mid">{r.betCount}</td>
                          <td className="px-3 py-2 font-semibold text-ink-hi">{fmtMoney(r.totalStake)}</td>
                          <td className={cn('px-3 py-2 font-semibold', r.totalPayout > 0 ? 'text-signal-ok' : 'text-ink-mid')}>
                            {r.totalPayout > 0 ? fmtMoney(r.totalPayout) : '-'}
                          </td>
                          <td className={cn('px-3 py-2 font-semibold', r.totalStake - r.totalPayout >= 0 ? 'text-ink-hi' : 'text-signal-danger')}>
                            {fmtMoney(r.totalStake - r.totalPayout)}
                          </td>
                          <td className="px-3 py-2 text-right">
                            <button type="button" onClick={() => openDetail(r.id)} className="inline-flex h-8 items-center rounded-lg border border-neon/15 bg-base-panel px-3 text-xs font-semibold text-ink-mid hover:border-neon/30 hover:text-ink-hi">
                              View bets / বাজি দেখুন
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </TabsContent>

          {/* ---------------- Modes ---------------- */}
          <TabsContent value="modes">
            <div className="grid gap-3 md:grid-cols-2">
              {orderedModes.map((m) => (
                <Card key={m.mode} padding="lg">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="break-words text-base font-extrabold text-ink-hi">{m.labelEn}</p>
                      <p className="text-xs text-ink-mid">{m.labelBn}</p>
                      <p className="mt-1 font-mono text-[10px] uppercase tracking-wider text-ink-lo">{m.mode}</p>
                    </div>
                    <Chip tone={m.enabled ? 'ok' : 'warn'}>{m.enabled ? 'On / চালু' : 'Off / বন্ধ'}</Chip>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                    <Stat label="Settled rounds / সেটল রাউন্ড" value={m.rounds.toLocaleString()} />
                    <Stat label="Last 24h / গত ২৪ ঘণ্টা" value={m.rounds24h.toLocaleString()} />
                    <Stat label="Staked / বাজি" value={fmtMoney(m.totalStake)} />
                    <Stat label="Paid / পরিশোধ" value={fmtMoney(m.totalPayout)} />
                    <Stat label="House result / হাউস ফল" value={fmtMoney(m.houseResult)} positive={m.houseResult >= 0} />
                    <Stat label="Last draw / শেষ ড্র" value={m.lastDrawAt ? new Date(m.lastDrawAt).toLocaleString() : '-'} />
                  </div>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      )}

      {/* ---------------- Round drill-in ---------------- */}
      <Modal
        open={!!detail || detailLoading}
        onOpenChange={(v) => { if (!v) { setDetail(null); } }}
        size="lg"
        title="Round bets / রাউন্ডের বাজি"
        description={detail ? `${detail.round.periodNumber} . ${detail.round.mode}` : ''}
      >
        {detailLoading ? (
          <p className="text-sm text-ink-mid">Loading... / লোড হচ্ছে...</p>
        ) : !detail ? (
          <p className="text-sm text-ink-mid">No data. / কোনো তথ্য নেই।</p>
        ) : (
          <div>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span className={cn('inline-flex h-8 w-8 items-center justify-center rounded-full text-sm font-extrabold', ballClasses(detail.round.result))}>
                {detail.round.result === null ? '-' : detail.round.result}
              </span>
              <Chip tone={roundStatusTone(detail.round.status)}>{detail.round.status}</Chip>
              {detail.round.resultColor ? <Chip tone="info">{detail.round.resultColor}</Chip> : null}
              {detail.round.resultSize ? <Chip tone="neutral">{detail.round.resultSize}</Chip> : null}
              <span className="text-xs text-ink-mid">Staked {fmtMoney(detail.round.totalStake)} . Paid {fmtMoney(detail.round.totalPayout)}</span>
            </div>
            <p className="mb-1 break-all font-mono text-[10px] text-ink-lo">Seed hash / সিড হ্যাশ: {detail.round.serverSeedHash}</p>
            {detail.round.serverSeed ? (
              <p className="mb-3 break-all font-mono text-[10px] text-signal-ok">
                Revealed seed / প্রকাশিত সিড: {detail.round.serverSeed}
              </p>
            ) : (
              <p className="mb-3 font-mono text-[10px] text-ink-lo">
                Seed reveals once settled / সেটল হলে সিড প্রকাশ পাবে
              </p>
            )}
            {detail.round.paytable ? (
              <p className="mb-3 text-[10px] text-ink-lo">
                Frozen paytable / ফ্রিজ করা পেআউট:{' '}
                <span className="font-mono text-ink-mid">
                  {PAYTABLE_FIELDS.map((f) => `${f.en} ${detail.round.paytable?.[f.key]}x`).join(' . ')}
                </span>
              </p>
            ) : null}
            {detail.bets.length === 0 ? (
              <p className="rounded-lg border border-neon/10 bg-base-panel/60 p-4 text-sm text-ink-mid">No bets on this round. / এই রাউন্ডে কোনো বাজি নেই।</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-sm">
                  <thead className="border-b border-neon/15 text-left text-[10px] uppercase tracking-wider text-ink-lo">
                    <tr>
                      <th className="px-2 py-2 font-semibold">Player</th>
                      <th className="px-2 py-2 font-semibold">Pick</th>
                      <th className="px-2 py-2 font-semibold">Stake</th>
                      <th className="px-2 py-2 font-semibold">Status</th>
                      <th className="px-2 py-2 font-semibold">Payout</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neon/10">
                    {detail.bets.map((b) => (
                      <tr key={b.id}>
                        <td className="px-2 py-2">
                          <p className="font-semibold text-ink-hi">{b.username ?? '(deleted)'}</p>
                          <p className="font-mono text-[10px] text-ink-lo">{b.userId}</p>
                        </td>
                        <td className="px-2 py-2 text-ink-mid">
                          <span className="font-mono text-[11px]">{b.betType}:{b.betValue}</span>
                          <span className="ml-1 text-[10px] text-ink-lo">x{b.quantity}</span>
                        </td>
                        <td className="px-2 py-2 font-semibold text-ink-hi">{fmtMoney(b.betAmount)}</td>
                        <td className="px-2 py-2"><Chip tone={betStatusTone(b.status)}>{b.status}</Chip></td>
                        <td className={cn('px-2 py-2 font-semibold', b.payoutAmount > 0 ? 'text-signal-ok' : 'text-ink-mid')}>
                          {b.payoutAmount > 0 ? fmtMoney(b.payoutAmount) : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </Modal>
    </>
  );
}

function Stat({ label, value, positive }: { label: string; value: string; positive?: boolean }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-wider text-ink-lo">{label}</p>
      <p className={cn('mt-0.5 font-semibold', positive === false ? 'text-signal-danger' : 'text-ink-hi')}>{value}</p>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[10px] font-bold uppercase tracking-wider text-ink-lo">{label}</label>
      <div className="mt-1">{children}</div>
    </div>
  );
}

function SelectFilter({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <div>
      <label className="text-[10px] font-bold uppercase tracking-wider text-ink-lo">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 h-9 w-full rounded-lg border border-neon/15 bg-base-panel px-3 text-sm text-ink-hi focus:outline-none"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}
