// Built by Anointed Coder.
//
// Pasha Mines, wired to LIVE play and REAL money. The premium 5x5 board is
// kept; the flow is now the real multi-step round:
//   Start Game    -> POST /api/native-games/mines/bet   (debits the stake,
//                    leaves the round PENDING, mine layout stays server-side)
//   tap a tile    -> POST /api/native-games/mines/action { action: 'reveal' }
//                    (safe pick raises the live multiplier; a mine ends it)
//   Cash Out      -> POST /api/native-games/mines/action { action: 'cashout' }
//                    (credits stake * current multiplier)
//
// Real money is wagered here, so every action is behind a synchronous in-flight
// ref (no concurrent reveal / double cashout), the Start carries a stable
// idempotency key reused on retry so it can never double-debit, and the live
// balance is refreshed after each money move.

import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { Icon } from '@/components/ui/Icon';
import { useRouter } from 'expo-router';
import { Screen, Card, Gradient } from '@/components/ui';
import { formatBDT } from '@/lib/format';
import { colors, gradients } from '@/lib/theme';
import { cn } from '@/lib/cn';
import { ApiError } from '@/lib/api/client';
import {
  useBalance,
  useNativeGame,
  useCreateNativeSession,
  useStartMines,
  useMinesReveal,
  useMinesCashout,
} from '@/lib/api/hooks';
import { newNativeIdempotencyKey, type MinesConfig } from '@/lib/api/native-games';
import { useAuth } from '@/store/auth';

type Phase = 'idle' | 'active' | 'lost' | 'won';

interface Notice {
  type: 'success' | 'error';
  text: string;
}

interface HistoryItem {
  label: string;
  win: boolean;
}

const SESSION_ERROR_CODES = new Set(['SESSION_NOT_FOUND', 'SESSION_INACTIVE', 'SESSION_NOT_OWNED']);

export default function MinesScreen() {
  const { width } = useWindowDimensions();
  const { status } = useAuth();

  const gameQuery = useNativeGame('mines');
  const balanceQuery = useBalance();
  const sessionMutation = useCreateNativeSession('mines');
  const startMutation = useStartMines();
  const revealMutation = useMinesReveal();
  const cashoutMutation = useMinesCashout();

  const view = gameQuery.data;
  const game = view?.game;
  const available = !!view && view.enabled && !!game?.isActive;
  const minBet = game?.minBet ?? 10;
  const maxBet = game?.maxBet ?? 10_000;
  const cfg = (game?.config ?? {}) as Partial<MinesConfig>;
  const totalTiles = Number.isFinite(cfg.gridSize) ? Number(cfg.gridSize) : 25;
  const side = Math.max(2, Math.round(Math.sqrt(totalTiles)));
  const minMines = Number.isFinite(cfg.minMines) ? Number(cfg.minMines) : 1;
  const maxMines = Number.isFinite(cfg.maxMines) ? Number(cfg.maxMines) : 24;

  const balance = balanceQuery.data?.balance ?? 0;

  const [amount, setAmount] = useState(minBet);
  const [mineCount, setMineCount] = useState(3);
  const [phase, setPhase] = useState<Phase>('idle');
  const [roundId, setRoundId] = useState<string | null>(null);
  const [revealed, setRevealed] = useState<number[]>([]);
  const [minePositions, setMinePositions] = useState<number[] | null>(null);
  const [mult, setMult] = useState(1);
  const [activeBet, setActiveBet] = useState(minBet);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);

  const submittingRef = useRef(false);
  const idemRef = useRef<string | null>(null);
  const ensuringRef = useRef(false);

  useEffect(() => {
    if (game && amount < minBet) setAmount(minBet);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game?.minBet]);

  // Clamp the mine count into the live band whenever config lands.
  useEffect(() => {
    setMineCount((m) => Math.min(Math.min(maxMines, totalTiles - 1), Math.max(minMines, m)));
  }, [minMines, maxMines, totalTiles]);

  useEffect(() => {
    if (!available || status !== 'authed' || sessionId || ensuringRef.current) return;
    ensuringRef.current = true;
    sessionMutation
      .mutateAsync(undefined)
      .then((s) => setSessionId(s.id))
      .catch(() => {})
      .finally(() => {
        ensuringRef.current = false;
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [available, status, sessionId]);

  function resetIdem() {
    if (submittingRef.current) return;
    idemRef.current = null;
  }
  // The Start inputs are editable while phase is idle, so they are also frozen
  // during the Start bet's in-flight window (submittingRef). That preserves the
  // idempotency key across an ambiguous-failure retry so Start can never
  // double-debit.
  function changeAmount(next: number) {
    if (submittingRef.current || phase === 'active') return;
    resetIdem();
    setAmount(Math.min(maxBet, Math.max(minBet, Math.round(next))));
  }
  function changeMineCount(next: number) {
    if (submittingRef.current || phase === 'active') return;
    resetIdem();
    setMineCount(Math.min(Math.min(maxMines, totalTiles - 1), Math.max(minMines, next)));
  }

  function handleSessionError(err: unknown) {
    if (err instanceof ApiError && SESSION_ERROR_CODES.has(err.code)) {
      setSessionId(null);
      idemRef.current = null;
    }
  }
  function errText(err: unknown): string {
    return err instanceof ApiError && err.message !== err.code
      ? err.message
      : 'Something went wrong. Check your connection and try again.';
  }

  const stakeValid = Number.isFinite(amount) && amount >= minBet && amount <= maxBet;
  const insufficient = balanceQuery.isSuccess && amount > balance;
  const canStart =
    available && status === 'authed' && phase === 'idle' && stakeValid && !insufficient && !startMutation.isPending;
  const cashoutValue = Math.round(activeBet * mult);
  const canCashout = phase === 'active' && revealed.length > 0 && !cashoutMutation.isPending;

  function newGame() {
    setPhase('idle');
    setRoundId(null);
    setRevealed([]);
    setMinePositions(null);
    setMult(1);
    setNotice(null);
  }

  async function handleStart() {
    if (submittingRef.current) return;
    if (!available) {
      setNotice({ type: 'error', text: 'This game is unavailable right now. এই গেমটি এখন বন্ধ আছে।' });
      return;
    }
    if (status !== 'authed') {
      setNotice({ type: 'error', text: 'Please sign in to play. খেলতে সাইন ইন করুন।' });
      return;
    }
    if (!stakeValid) {
      setNotice({ type: 'error', text: `Enter a stake between ${formatBDT(minBet)} and ${formatBDT(maxBet)}.` });
      return;
    }
    submittingRef.current = true;
    try {
      if (!idemRef.current) idemRef.current = newNativeIdempotencyKey('mines');
      let sid = sessionId;
      if (!sid) {
        const s = await sessionMutation.mutateAsync(undefined);
        sid = s.id;
        setSessionId(sid);
      }
      const res = await startMutation.mutateAsync({
        sessionId: sid,
        mineCount,
        betAmount: amount,
        idempotencyKey: idemRef.current,
      });
      idemRef.current = null;
      setRoundId(res.roundId);
      setRevealed(res.revealedTiles);
      setMult(res.currentMultiplier);
      setActiveBet(amount);
      setMinePositions(null);
      setPhase('active');
      setNotice({ type: 'success', text: `Round started with ${mineCount} mines. Reveal a tile.` });
    } catch (err) {
      handleSessionError(err);
      setNotice({ type: 'error', text: errText(err) });
    } finally {
      submittingRef.current = false;
    }
  }

  async function handleReveal(tile: number) {
    if (phase !== 'active' || !roundId) return;
    if (submittingRef.current) return;
    if (revealed.includes(tile)) return;
    submittingRef.current = true;
    try {
      const res = await revealMutation.mutateAsync({ roundId, tile });
      if (res.hitMine || res.outcome === 'LOSS') {
        setMinePositions(res.minePositions ?? []);
        setRevealed(res.revealedTiles);
        setMult(0);
        setPhase('lost');
        setHistory((prev) => [{ label: '0.00x', win: false }, ...prev].slice(0, 12));
        setNotice({ type: 'error', text: `Boom! You hit a mine. Stake ${formatBDT(activeBet)} lost.` });
      } else {
        setRevealed(res.revealedTiles);
        setMult(res.currentMultiplier);
        setNotice(null);
      }
    } catch (err) {
      handleSessionError(err);
      setNotice({ type: 'error', text: errText(err) });
    } finally {
      submittingRef.current = false;
    }
  }

  async function handleCashout() {
    if (!canCashout || !roundId) return;
    if (submittingRef.current) return;
    submittingRef.current = true;
    try {
      const res = await cashoutMutation.mutateAsync({ roundId });
      setMinePositions(res.minePositions);
      setRevealed(res.revealedTiles);
      setMult(res.multiplier);
      setPhase('won');
      setHistory((prev) => [{ label: `${res.multiplier.toFixed(2)}x`, win: true }, ...prev].slice(0, 12));
      setNotice({ type: 'success', text: `Cashed out ${formatBDT(res.payout)} at ${res.multiplier.toFixed(2)}x.` });
    } catch (err) {
      handleSessionError(err);
      setNotice({ type: 'error', text: errText(err) });
    } finally {
      submittingRef.current = false;
    }
  }

  const GAP = 8;
  const boardW = Math.min(width - 32, 420) - 32;
  const cell = (boardW - GAP * (side - 1)) / side;
  const settled = phase === 'lost' || phase === 'won';
  const mineSet = new Set(minePositions ?? []);
  const revealedSet = new Set(revealed);

  const mineChoices = Array.from(
    new Set([minMines, 3, 5, 10, Math.min(maxMines, totalTiles - 1)].filter((m) => m >= minMines && m <= Math.min(maxMines, totalTiles - 1))),
  ).sort((a, b) => a - b);

  return (
    <Screen header={<GameTopBar title="Mines" subtitle="Pasha Originals" balance={balance} />} contentClassName="px-4 pt-3 gap-4">
      {!view ? (
        <LoadingBoard />
      ) : !available ? (
        <UnavailableBoard />
      ) : (
        <>
          <Card tone="dark" className="items-center">
            <View className="mb-3 w-full flex-row items-center justify-between">
              <View className="flex-row items-center gap-1.5">
                <Icon name="diamond" size={14} color={colors.neon} />
                <Text className="text-xs font-bold text-white/70">{revealed.length} safe</Text>
              </View>
              <View className="flex-row items-center gap-1.5">
                <Icon name="alert-circle" size={14} color={colors.hot} />
                <Text className="text-xs font-bold text-white/70">{mineCount} mines</Text>
              </View>
            </View>

            <View className="flex-row flex-wrap" style={{ width: boardW, gap: GAP }}>
              {Array.from({ length: totalTiles }, (_, i) => {
                const isGem = revealedSet.has(i);
                const isMine = settled && mineSet.has(i);
                const tappable = phase === 'active' && !isGem;
                return (
                  <MineTile
                    key={i}
                    kind={isGem ? 'gem' : isMine ? 'mine' : 'hidden'}
                    size={cell}
                    disabled={!tappable}
                    onPress={tappable ? () => handleReveal(i) : undefined}
                  />
                );
              })}
            </View>
          </Card>

          {/* Multiplier readout */}
          <View className="flex-row gap-3">
            <Card className="flex-1 items-center">
              <Text className="text-[10px] font-black uppercase tracking-widest text-ink-mute">Multiplier</Text>
              <Text className="mt-1 text-2xl font-black" style={{ color: phase === 'lost' ? colors.hot : colors.gold700 }}>
                {mult.toFixed(2)}x
              </Text>
            </Card>
            <Card className="flex-1 items-center">
              <Text className="text-[10px] font-black uppercase tracking-widest text-ink-mute">
                {phase === 'active' ? 'Cash Out' : 'Stake'}
              </Text>
              <Text className="mt-1 text-2xl font-black text-ink">
                {phase === 'active' ? formatBDT(cashoutValue) : formatBDT(amount)}
              </Text>
            </Card>
          </View>

          {/* Mines count */}
          <View className="gap-2">
            <Text className="text-xs font-bold uppercase tracking-wider text-ink-mute">Mines</Text>
            <View className="flex-row gap-2">
              {mineChoices.map((m) => {
                const active = mineCount === m;
                const locked = phase === 'active';
                return (
                  <Pressable
                    key={m}
                    onPress={() => changeMineCount(m)}
                    disabled={locked}
                    className={cn(
                      'flex-1 items-center rounded-xl border py-2.5 active:opacity-80',
                      active ? 'border-gold-600 bg-gold-500' : 'border-divider bg-paper',
                      locked && !active && 'opacity-50',
                    )}
                  >
                    <Text className={cn('text-sm font-black', active ? 'text-ink' : 'text-ink-soft')}>{m}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <BetControls
            amount={amount}
            onChange={changeAmount}
            minBet={minBet}
            maxBet={maxBet}
            balance={balance}
            locked={phase === 'active'}
          />

          {/* Action row */}
          {phase === 'active' ? (
            <ActionButton
              label={cashoutMutation.isPending ? 'Cashing out...' : `Cash Out ${formatBDT(cashoutValue)}`}
              icon="cash"
              disabled={!canCashout}
              onPress={handleCashout}
            />
          ) : settled ? (
            <ActionButton label="New Game" icon="refresh" tone="ghost" disabled={false} onPress={newGame} />
          ) : (
            <ActionButton
              label={startMutation.isPending ? 'Starting...' : 'Start Game'}
              icon="play"
              disabled={!canStart}
              onPress={handleStart}
            />
          )}

          <Notices notice={notice} insufficient={insufficient && phase !== 'active'} />

          <ResultsStrip items={history} />
        </>
      )}
    </Screen>
  );
}

// ---------- Pieces ----------

function MineTile({
  kind,
  size,
  disabled,
  onPress,
}: {
  kind: 'gem' | 'mine' | 'hidden';
  size: number;
  disabled: boolean;
  onPress?: () => void;
}) {
  const content =
    kind === 'gem' ? (
      <View
        style={{ width: size, height: size }}
        className="items-center justify-center rounded-xl border border-neon/40 bg-neon/10"
      >
        <Icon name="diamond" size={size * 0.42} color={colors.neon} />
      </View>
    ) : kind === 'mine' ? (
      <View
        style={{ width: size, height: size }}
        className="items-center justify-center rounded-xl border border-hot/50 bg-hot/15"
      >
        <Icon name="skull" size={size * 0.42} color={colors.hot} />
      </View>
    ) : (
      <View style={{ width: size, height: size }} className="relative overflow-hidden rounded-xl">
        <Gradient colors={gradients.darkPanel} radius={12} />
        <View className="absolute inset-0 items-center justify-center">
          <Icon name="help" size={size * 0.36} color="rgba(255,255,255,0.22)" />
        </View>
      </View>
    );
  if (onPress && !disabled) {
    return (
      <Pressable onPress={onPress} className="active:opacity-80">
        {content}
      </Pressable>
    );
  }
  return content;
}

function ActionButton({
  label,
  icon,
  disabled,
  onPress,
  tone = 'gold',
}: {
  label: string;
  icon: string;
  disabled: boolean;
  onPress: () => void;
  tone?: 'gold' | 'ghost';
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      className={cn(
        'h-14 flex-row items-center justify-center gap-2 rounded-2xl active:opacity-90',
        tone === 'gold' ? 'bg-gold-500' : 'border border-divider bg-paper',
        disabled && 'opacity-50',
      )}
    >
      <Icon name={icon} size={20} color={colors.ink} />
      <Text className="text-base font-black uppercase tracking-wider text-ink">{label}</Text>
    </Pressable>
  );
}

function Notices({ notice, insufficient }: { notice: Notice | null; insufficient: boolean }) {
  if (!notice && !insufficient) return null;
  return (
    <View className="gap-2">
      {notice ? (
        <View
          className={cn(
            'flex-row items-center gap-2 rounded-xl border px-3 py-2.5',
            notice.type === 'success' ? 'border-newg/40 bg-newg/10' : 'border-hot/40 bg-hot/10',
          )}
        >
          <Icon
            name={notice.type === 'success' ? 'checkmark-circle' : 'alert-circle'}
            size={16}
            color={notice.type === 'success' ? colors.newg : colors.hot}
          />
          <Text className={cn('flex-1 text-xs font-medium', notice.type === 'success' ? 'text-newg' : 'text-hot')}>
            {notice.text}
          </Text>
        </View>
      ) : null}
      {insufficient ? (
        <Text className="text-[11px] font-medium text-hot">
          Stake exceeds your balance. Lower it or deposit to continue.
        </Text>
      ) : null}
    </View>
  );
}

function GameTopBar({ title, subtitle, balance }: { title: string; subtitle?: string; balance: number }) {
  const router = useRouter();
  return (
    <View className="flex-row items-center justify-between border-b border-divider bg-paper px-3 py-2.5">
      <View className="flex-row items-center gap-1.5">
        <Pressable
          onPress={() => router.back()}
          hitSlop={8}
          className="h-9 w-9 items-center justify-center rounded-xl active:bg-surfaceAlt"
        >
          <Icon name="chevron-back" size={22} color={colors.ink} />
        </Pressable>
        <View>
          <Text className="text-base font-black tracking-tight text-ink">{title}</Text>
          {subtitle ? <Text className="text-[11px] text-ink-mute">{subtitle}</Text> : null}
        </View>
      </View>
      <View className="flex-row items-center gap-1 rounded-pill border border-gold-600/30 bg-gold-500/15 py-1.5 pl-2 pr-1.5">
        <Icon name="wallet" size={14} color={colors.gold700} />
        <Text className="text-[11px] font-black text-ink">{formatBDT(balance)}</Text>
        <View className="h-5 w-5 items-center justify-center rounded-full bg-gold-500">
          <Icon name="add" size={14} color={colors.ink} />
        </View>
      </View>
    </View>
  );
}

function BetControls({
  amount,
  onChange,
  minBet,
  maxBet,
  balance,
  locked,
}: {
  amount: number;
  onChange: (n: number) => void;
  minBet: number;
  maxBet: number;
  balance: number;
  locked: boolean;
}) {
  const chips = [minBet, minBet * 5, 100, 500, 1000].filter((c, i, a) => c <= maxBet && a.indexOf(c) === i);
  const step = Math.max(1, minBet);
  return (
    <Card className={cn(locked && 'opacity-60')}>
      <View className="flex-row items-center justify-between">
        <Text className="text-xs font-bold uppercase tracking-wider text-ink-mute">Bet Amount</Text>
        <Text className="text-[11px] text-ink-mute">Bal {formatBDT(balance)}</Text>
      </View>
      <View className="mt-2.5 flex-row items-center gap-2">
        <Pressable
          onPress={() => onChange(amount - step)}
          disabled={locked}
          className="h-11 w-11 items-center justify-center rounded-xl border border-divider bg-surface active:opacity-80"
        >
          <Icon name="remove" size={18} color={colors.ink} />
        </Pressable>
        <View className="flex-1 flex-row items-center justify-center rounded-xl border border-divider bg-surface py-3">
          <Text className="text-lg font-black text-ink">{formatBDT(amount)}</Text>
        </View>
        <Pressable
          onPress={() => onChange(amount + step)}
          disabled={locked}
          className="h-11 w-11 items-center justify-center rounded-xl border border-divider bg-surface active:opacity-80"
        >
          <Icon name="add" size={18} color={colors.ink} />
        </Pressable>
      </View>
      <View className="mt-2.5 flex-row gap-2">
        {chips.map((c) => {
          const active = amount === c;
          return (
            <Pressable
              key={c}
              onPress={() => onChange(c)}
              disabled={locked}
              className={cn(
                'flex-1 items-center rounded-lg border py-2 active:opacity-80',
                active ? 'border-gold-600 bg-gold-500' : 'border-divider bg-paper',
              )}
            >
              <Text className={cn('text-xs font-black', active ? 'text-ink' : 'text-ink-soft')}>{c}</Text>
            </Pressable>
          );
        })}
      </View>
    </Card>
  );
}

function ResultsStrip({ items }: { items: HistoryItem[] }) {
  return (
    <View className="gap-2">
      <Text className="text-xs font-bold uppercase tracking-wider text-ink-mute">Recent Results</Text>
      {items.length === 0 ? (
        <Text className="text-[11px] text-ink-mute">No rounds yet this session.</Text>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {items.map((r, i) => (
            <View
              key={i}
              className={cn(
                'h-10 min-w-[52px] items-center justify-center rounded-lg border px-2.5',
                r.win ? 'border-newg/40 bg-newg/10' : 'border-hot/40 bg-hot/10',
              )}
            >
              <Text className="text-sm font-black" style={{ color: r.win ? colors.newg : colors.hot }}>
                {r.label}
              </Text>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

function LoadingBoard() {
  return (
    <View className="items-center justify-center rounded-2xl border border-divider bg-surface py-16">
      <Icon name="hourglass-outline" size={30} color={colors.gold700} />
      <Text className="mt-3 text-sm font-bold text-ink-soft">Loading game...</Text>
      <Text className="mt-1 text-xs text-ink-mute">গেম লোড হচ্ছে...</Text>
    </View>
  );
}

function UnavailableBoard() {
  return (
    <View className="items-center justify-center rounded-2xl border border-gold-600/25 bg-surface px-6 py-14">
      <View className="h-16 w-16 items-center justify-center rounded-full bg-gold-500/15">
        <Icon name="pause-circle" size={30} color={colors.gold700} />
      </View>
      <Text className="mt-4 text-center text-base font-black text-ink">Coming soon</Text>
      <Text className="mt-1.5 text-center text-sm text-ink-soft">শীঘ্রই আসছে</Text>
      <Text className="mt-3 max-w-[280px] text-center text-xs text-ink-mute">
        This game is not available to play yet. Please check back again shortly.
      </Text>
    </View>
  );
}
