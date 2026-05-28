// Built by Anointed Coder.
//
// Pasha Native Games admin console. Two tabs:
//
//   Games  - card per gameCode with live totals (wagered / paid /
//            house result). Edit modal toggles active, sets min/max
//            bet caps and the house edge in basis points. Also
//            hosts the global subsystem on/off switch which
//            short-circuits every public /api/native-games/* call.
//
//   Rounds - filterable list of recent rounds with the option to
//            roll back any non-cancelled round (super_admin only;
//            triggers the wallet-reversal pipeline in service.ts).

'use client';

import { useCallback, useEffect, useState } from 'react';
import { PageHeader } from '@/components/site/PageHeader';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { Modal } from '@/components/ui/Modal';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs';
import { Switch } from '@/components/ui/Switch';
import { Sparkles, RefreshCw, Settings, Undo2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

interface NativeGameRow {
  gameCode: string;
  displayName: string;
  isActive: boolean;
  isFeatured: boolean;
  sortOrder: number;
  houseEdgeBps: number;
  minBet: number;
  maxBet: number;
  config: unknown;
  totals: { rounds: number; rounds24h: number; lastRoundAt: string | null; wagered: number; paid: number; houseResult: number };
}

interface AdminListResp {
  enabled: boolean;
  games: NativeGameRow[];
}

interface RoundRow {
  id: string;
  sessionId: string;
  userId: string;
  actorUsername: string | null;
  gameCode: string;
  nonce: number;
  betAmount: number;
  payoutAmount: number;
  payoutMultiplier: number;
  outcome: string;
  gameData: unknown;
  settledAt: string | null;
  createdAt: string;
}

function fmtMoney(n: number): string {
  return `BDT ${Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function outcomeTone(s: string): 'ok' | 'warn' | 'danger' | 'neutral' | 'info' {
  if (s === 'WIN' || s === 'CASHOUT') return 'ok';
  if (s === 'LOSS') return 'danger';
  if (s === 'PENDING') return 'warn';
  if (s === 'CANCELLED') return 'neutral';
  return 'info';
}

export default function AdminNativeGamesPage() {
  const [data, setData] = useState<AdminListResp | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editGame, setEditGame] = useState<NativeGameRow | null>(null);

  // Round filters
  const [filterGame, setFilterGame] = useState<string>('');
  const [filterOutcome, setFilterOutcome] = useState<string>('');
  const [filterUserId, setFilterUserId] = useState<string>('');
  const [rounds, setRounds] = useState<RoundRow[]>([]);
  const [roundsLoading, setRoundsLoading] = useState(false);
  const [rollbackTarget, setRollbackTarget] = useState<RoundRow | null>(null);
  const [rollbackNote, setRollbackNote] = useState<string>('');
  const [rollbackBusy, setRollbackBusy] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/native-games', { cache: 'no-store' });
      const j = await res.json().catch(() => null);
      if (!res.ok) throw new Error(j?.message ?? j?.code ?? `HTTP ${res.status}`);
      setData(j as AdminListResp);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const loadRounds = useCallback(async () => {
    setRoundsLoading(true);
    try {
      const url = new URL('/api/admin/native-games/rounds', window.location.origin);
      if (filterGame) url.searchParams.set('gameCode', filterGame);
      if (filterOutcome) url.searchParams.set('outcome', filterOutcome);
      if (filterUserId.trim()) url.searchParams.set('userId', filterUserId.trim());
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
  }, [filterGame, filterOutcome, filterUserId]);

  useEffect(() => { loadRounds(); }, [loadRounds]);

  const toggleGlobal = async (next: boolean) => {
    // Sends `globalEnabled` along with no other changes; the PATCH
    // route only updates the flag in this case.
    const first = data?.games?.[0];
    if (!first) return;
    try {
      const res = await fetch(`/api/admin/native-games/${first.gameCode}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ globalEnabled: next }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        setError(j?.message ?? j?.code ?? 'Update failed');
        return;
      }
      load();
    } catch { setError('Could not reach server'); }
  };

  const onRollback = async () => {
    if (!rollbackTarget) return;
    setRollbackBusy(true);
    try {
      const res = await fetch(`/api/admin/native-games/rounds/${rollbackTarget.id}/rollback`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ note: rollbackNote || undefined }),
      });
      const j = await res.json().catch(() => null);
      if (!res.ok) {
        setError(j?.message ?? j?.code ?? 'Rollback failed');
        return;
      }
      setRollbackTarget(null);
      setRollbackNote('');
      loadRounds();
      load();
    } catch { setError('Could not reach server'); }
    finally { setRollbackBusy(false); }
  };

  return (
    <>
      <PageHeader
        title="Pasha Native Games"
        subtitle="In-house provably-fair titles. Toggle availability, edit caps and audit every round."
        icon={<Sparkles className="h-5 w-5" />}
        action={
          <Button variant="ghost" leftIcon={<RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} />} onClick={() => { load(); loadRounds(); }}>
            Reload
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

      <Card padding="md" className="mb-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-ink-hi">Global switch</p>
            <p className="text-xs text-ink-mid">
              When OFF, every /api/native-games/* request returns 503 NATIVE_GAMES_DISABLED. Lobby cards render with a &quot;Temporarily unavailable&quot; chip.
            </p>
          </div>
          <Switch checked={Boolean(data?.enabled)} onChange={toggleGlobal} label="Native games global switch" />
        </div>
      </Card>

      {loading ? (
        <p className="text-sm text-ink-mid">Loading...</p>
      ) : (
        <Tabs defaultValue="games">
          <TabsList>
            <TabsTrigger value="games">Games</TabsTrigger>
            <TabsTrigger value="rounds">Rounds</TabsTrigger>
          </TabsList>

          <TabsContent value="games">
            <Card padding="md" className="mb-4 border-l-4 border-signal-warn">
              <p className="text-sm font-semibold text-ink-hi inline-flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-signal-warn" />
                Only activate a game after wallet testing.
              </p>
              <p className="mt-1 text-xs text-ink-mid">
                Place a small real-money bet end-to-end (debit + settle + GameRound row + Transaction row) before flipping isActive on. Inactive games return 503 GAME_INACTIVE and stay safely hidden from the player lobby. Use the Rounds tab to confirm a game has settled at least one real round; the &quot;Recent rounds&quot; chip below summarizes the last 24 hours.
              </p>
            </Card>

            {(data?.games ?? []).length === 0 ? (
              <Card padding="lg"><p className="text-sm text-ink-mid">No native games loaded. Run the seeder or insert NativeGameProvider rows.</p></Card>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {data!.games.map((g) => {
                  const recent = g.totals.rounds24h ?? 0;
                  const tested = (g.totals.rounds ?? 0) > 0;
                  return (
                    <Card key={g.gameCode} padding="lg">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-base font-extrabold text-ink-hi">{g.displayName}</p>
                          <p className="mt-1 font-mono text-[10px] uppercase tracking-wider text-ink-lo">{g.gameCode}</p>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <Chip tone={g.isActive ? 'ok' : 'warn'}>{g.isActive ? 'Active' : 'Disabled'}</Chip>
                          {g.isFeatured ? <Chip tone="gold">Featured</Chip> : null}
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <Chip tone={recent > 0 ? 'ok' : 'neutral'}>
                          {recent > 0 ? `${recent} round${recent === 1 ? '' : 's'} in last 24h` : 'No rounds in last 24h'}
                        </Chip>
                        <Chip tone={tested ? 'info' : 'warn'}>
                          {tested ? 'Wallet tested' : 'Not wallet tested yet'}
                        </Chip>
                        {!g.isActive && !tested ? (
                          <span className="text-[11px] font-semibold text-signal-warn">Test a real bet before activating.</span>
                        ) : null}
                      </div>
                      <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                        <Stat label="Min bet" value={fmtMoney(g.minBet)} />
                        <Stat label="Max bet" value={fmtMoney(g.maxBet)} />
                        <Stat label="House edge" value={`${(g.houseEdgeBps / 100).toFixed(2)}%`} />
                        <Stat label="Sort order" value={String(g.sortOrder)} />
                        <Stat label="Total rounds" value={g.totals.rounds.toLocaleString()} />
                        <Stat label="Wagered" value={fmtMoney(g.totals.wagered)} />
                        <Stat label="Paid out" value={fmtMoney(g.totals.paid)} />
                        <Stat label="House result" value={fmtMoney(g.totals.houseResult)} positive={g.totals.houseResult >= 0} />
                      </div>
                      <div className="mt-4 flex justify-end">
                        <Button size="sm" variant="neon" leftIcon={<Settings className="h-3.5 w-3.5" />} onClick={() => setEditGame(g)}>Edit</Button>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="rounds">
            <Card padding="md" className="mb-4">
              <div className="grid gap-3 sm:grid-cols-4">
                <SelectFilter label="Game" value={filterGame} onChange={setFilterGame} options={[
                  { value: '', label: 'All games' },
                  ...(data?.games ?? []).map((g) => ({ value: g.gameCode, label: g.displayName })),
                ]} />
                <SelectFilter label="Outcome" value={filterOutcome} onChange={setFilterOutcome} options={[
                  { value: '', label: 'Any outcome' },
                  { value: 'PENDING', label: 'PENDING' },
                  { value: 'WIN', label: 'WIN' },
                  { value: 'LOSS', label: 'LOSS' },
                  { value: 'CASHOUT', label: 'CASHOUT' },
                  { value: 'CANCELLED', label: 'CANCELLED' },
                ]} />
                <div className="sm:col-span-2">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-ink-lo">User ID</label>
                  <input
                    type="text"
                    value={filterUserId}
                    onChange={(e) => setFilterUserId(e.target.value)}
                    placeholder="cuid (optional)"
                    className="mt-1 h-9 w-full rounded-lg border border-neon/15 bg-base-panel px-3 text-sm text-ink-hi focus:outline-none"
                  />
                </div>
              </div>
            </Card>

            <Card padding="none">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[820px] text-sm">
                  <thead className="border-b border-neon/15 bg-base-elev text-left text-[11px] uppercase tracking-wider text-ink-lo">
                    <tr>
                      <th className="px-3 py-2 font-semibold">When</th>
                      <th className="px-3 py-2 font-semibold">Game</th>
                      <th className="px-3 py-2 font-semibold">User</th>
                      <th className="px-3 py-2 font-semibold">Bet</th>
                      <th className="px-3 py-2 font-semibold">Payout</th>
                      <th className="px-3 py-2 font-semibold">Mult</th>
                      <th className="px-3 py-2 font-semibold">Outcome</th>
                      <th className="px-3 py-2 font-semibold"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neon/10">
                    {roundsLoading ? (
                      <tr><td colSpan={8} className="px-3 py-5 text-center text-ink-mid">Loading...</td></tr>
                    ) : rounds.length === 0 ? (
                      <tr><td colSpan={8} className="px-3 py-5 text-center text-ink-mid">No rounds match the filters.</td></tr>
                    ) : (
                      rounds.map((r) => (
                        <tr key={r.id}>
                          <td className="px-3 py-2 text-ink-mid">{new Date(r.createdAt).toLocaleString()}</td>
                          <td className="px-3 py-2 font-mono text-ink-mid">{r.gameCode}</td>
                          <td className="px-3 py-2 text-ink-mid">
                            <p className="font-semibold text-ink-hi">{r.actorUsername ?? '(deleted)'}</p>
                            <p className="font-mono text-[10px] text-ink-lo">{r.userId}</p>
                          </td>
                          <td className="px-3 py-2 font-semibold text-ink-hi">{fmtMoney(r.betAmount)}</td>
                          <td className={cn('px-3 py-2 font-semibold', r.payoutAmount > 0 ? 'text-signal-ok' : 'text-ink-mid')}>
                            {r.payoutAmount > 0 ? fmtMoney(r.payoutAmount) : '-'}
                          </td>
                          <td className="px-3 py-2 font-mono text-ink-mid">{r.payoutMultiplier ? `${Number(r.payoutMultiplier).toFixed(4)}x` : '-'}</td>
                          <td className="px-3 py-2"><Chip tone={outcomeTone(r.outcome)}>{r.outcome}</Chip></td>
                          <td className="px-3 py-2 text-right">
                            {r.outcome !== 'CANCELLED' ? (
                              <button type="button" onClick={() => setRollbackTarget(r)} className="inline-flex h-8 items-center gap-1 rounded-lg border border-neon/15 bg-base-panel px-2 text-xs font-semibold text-signal-warn hover:border-signal-warn/40">
                                <Undo2 className="h-3 w-3" /> Rollback
                              </button>
                            ) : <span className="text-[11px] text-ink-lo">Cancelled</span>}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      )}

      <EditGameModal
        game={editGame}
        onClose={() => setEditGame(null)}
        onSaved={() => { setEditGame(null); load(); }}
      />

      <Modal
        open={!!rollbackTarget}
        onOpenChange={(v) => { if (!v) { setRollbackTarget(null); setRollbackNote(''); } }}
        title="Rollback round"
        description={rollbackTarget ? `${rollbackTarget.gameCode} . bet ${fmtMoney(rollbackTarget.betAmount)} . payout ${fmtMoney(rollbackTarget.payoutAmount)}` : ''}
        footer={
          <>
            <Button variant="ghost" onClick={() => setRollbackTarget(null)}>Cancel</Button>
            <Button variant="danger" loading={rollbackBusy} onClick={onRollback}>Confirm rollback</Button>
          </>
        }
      >
        <p className="text-sm text-ink-mid">
          This writes an adjust transaction reversing the bet/win for this round and flips the outcome to CANCELLED. Wallet delta is bet - payout (so a winning round nets out to zero; a losing round refunds the bet).
        </p>
        <label className="mt-4 block text-[10px] font-bold uppercase tracking-wider text-ink-lo">Note (optional)</label>
        <textarea
          value={rollbackNote}
          onChange={(e) => setRollbackNote(e.target.value)}
          rows={3}
          className="mt-1 w-full rounded-lg border border-neon/15 bg-base-panel px-3 py-2 text-sm text-ink-hi focus:outline-none"
        />
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

function EditGameModal({ game, onClose, onSaved }: { game: NativeGameRow | null; onClose: () => void; onSaved: () => void }) {
  const [isActive, setIsActive] = useState<boolean>(true);
  const [isFeatured, setIsFeatured] = useState<boolean>(false);
  const [sortOrder, setSortOrder] = useState<string>('0');
  const [minBet, setMinBet] = useState<string>('');
  const [maxBet, setMaxBet] = useState<string>('');
  const [houseEdgeBps, setHouseEdgeBps] = useState<string>('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!game) return;
    setIsActive(game.isActive);
    setIsFeatured(game.isFeatured);
    setSortOrder(String(game.sortOrder));
    setMinBet(String(game.minBet));
    setMaxBet(String(game.maxBet));
    setHouseEdgeBps(String(game.houseEdgeBps));
    setErr(null);
  }, [game]);

  const onSave = async () => {
    if (!game) return;
    setBusy(true); setErr(null);
    try {
      const res = await fetch(`/api/admin/native-games/${game.gameCode}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          isActive,
          isFeatured,
          sortOrder: Number(sortOrder),
          minBet: Number(minBet),
          maxBet: Number(maxBet),
          houseEdgeBps: Number(houseEdgeBps),
        }),
      });
      const j = await res.json().catch(() => null);
      if (!res.ok) {
        setErr(j?.message ?? j?.code ?? 'Save failed');
        return;
      }
      onSaved();
    } catch { setErr('Could not reach server'); }
    finally { setBusy(false); }
  };

  return (
    <Modal
      open={!!game}
      onOpenChange={(v) => { if (!v) onClose(); }}
      title={game ? `Edit ${game.displayName}` : ''}
      description="Changes take effect on the next request."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="gold" loading={busy} onClick={onSave}>Save</Button>
        </>
      }
    >
      {err ? <p className="mb-3 text-sm text-signal-danger">{err}</p> : null}
      <div className="space-y-4">
        <div className="flex items-center justify-between rounded-lg border border-neon/10 bg-base-panel/60 p-3">
          <div>
            <p className="text-sm font-semibold text-ink-hi">Active</p>
            <p className="text-xs text-ink-mid">When OFF, players see &quot;Temporarily unavailable&quot;.</p>
          </div>
          <Switch checked={isActive} onChange={setIsActive} />
        </div>
        <div className="flex items-center justify-between rounded-lg border border-neon/10 bg-base-panel/60 p-3">
          <div>
            <p className="text-sm font-semibold text-ink-hi">Featured on homepage</p>
            <p className="text-xs text-ink-mid">When ON, this game appears in the homepage Hot Games strip.</p>
          </div>
          <Switch checked={isFeatured} onChange={setIsFeatured} />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Sort order (lower first)">
            <input type="number" min={0} max={10000} step="1" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} className="h-10 w-full rounded-lg border border-neon/15 bg-base-panel px-3 text-sm text-ink-hi focus:outline-none" />
          </Field>
          <Field label="House edge (bps; 200 = 2.00%)">
            <input type="number" min={0} max={2000} step="1" value={houseEdgeBps} onChange={(e) => setHouseEdgeBps(e.target.value)} className="h-10 w-full rounded-lg border border-neon/15 bg-base-panel px-3 text-sm text-ink-hi focus:outline-none" />
          </Field>
          <Field label="Min bet (BDT)">
            <input type="number" min={0} step="1" value={minBet} onChange={(e) => setMinBet(e.target.value)} className="h-10 w-full rounded-lg border border-neon/15 bg-base-panel px-3 text-sm text-ink-hi focus:outline-none" />
          </Field>
          <Field label="Max bet (BDT)">
            <input type="number" min={0} step="1" value={maxBet} onChange={(e) => setMaxBet(e.target.value)} className="h-10 w-full rounded-lg border border-neon/15 bg-base-panel px-3 text-sm text-ink-hi focus:outline-none" />
          </Field>
        </div>
      </div>
    </Modal>
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
