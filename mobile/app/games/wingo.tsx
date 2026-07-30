// Built by Anointed Coder.
//
// Pasha WinGo game screen, wired to LIVE rounds and REAL betting. The premium
// layout is unchanged from the static mock; only the data source is now live:
//   four mode tabs -> a round card driven by the server round window (real
//   period number, a countdown derived from betCloseAt/drawsAt and resynced on
//   every poll, recent-result balls, an Open/Locked pill from the real phase)
//   -> a betting board (Green/Violet/Red, the 0-9 ball grid, Big/Small, Random,
//   X1..X100) that builds a bet slip -> a Place Bet action that debits the real
//   wallet through usePlaceWingoBet -> the Game history / Chart / My history
//   tabs backed by live results and the player's real bets.
//
// Real money is wagered here, so placement is guarded three ways: a synchronous
// in-flight ref against a double-tap, a stable idempotency key reused on retry
// so the server never double-debits, and a disabled Place Bet while the round is
// locked or the stake is out of range (the server enforces the same rules).

import { useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import Svg, { Path, Rect, Ellipse } from 'react-native-svg';
import { Icon } from '@/components/ui/Icon';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { Screen, ChipToggle, Gradient, TextField } from '@/components/ui';
import { formatBDT } from '@/lib/format';
import { colors } from '@/lib/theme';
import { cn } from '@/lib/cn';
import { ApiError } from '@/lib/api/client';
import { useBalance, useWingoState, useWingoMyBets, usePlaceWingoBet } from '@/lib/api/hooks';
import {
  WINGO_MODES,
  newIdempotencyKey,
  type WingoBetType,
  type WingoMode,
  type WingoMyBet,
  type WingoPaytable,
  type WingoResult,
} from '@/lib/api/wingo';
import { WingoBall, colorOf, sizeOf } from './_components/WingoBall';

const MODE_TABS = WINGO_MODES.map((m) => ({ key: m.key, label: m.label }));

const MULTIPLIERS = [1, 5, 10, 20, 50, 100];

// Glossy button gradients (top -> bottom), matching the web colour system.
const GRAD = {
  green: ['#5cf3bf', '#13c98d', '#054f34'],
  violet: ['#d29bff', '#a855f7', '#4f1687'],
  red: ['#ff8090', '#ec394d', '#6f0c1c'],
  big: ['#ffe08a', '#f5b400', '#a15c0a'],
  small: ['#7cc9ff', '#2f8fe0', '#0a4a8f'],
} as const;

type Tab = 'game' | 'chart' | 'mine';

// One line staged in the bet slip. Snapshots the stake + quantity active when
// the pick was added so later edits to the controls never mutate a staged line.
interface SlipLine {
  key: string;
  betType: WingoBetType;
  selection: string;
  label: string;
  stake: number;
  quantity: number;
}

interface Notice {
  type: 'success' | 'error';
  text: string;
}

type WinCeleb = { periodNumber: string; amount: number; result: number; lineCount: number };

function betLabel(betType: WingoBetType, selection: string): string {
  if (betType === 'color') return selection.charAt(0).toUpperCase() + selection.slice(1);
  if (betType === 'size') return selection === 'big' ? 'Big' : 'Small';
  return `Number ${selection}`;
}

let slipSeq = 0;

export default function WingoScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();

  const [mode, setMode] = useState<WingoMode>('wingo_30s');
  const [multiplier, setMultiplier] = useState(1);
  const [tab, setTab] = useState<Tab>('game');
  const [stakeText, setStakeText] = useState('');
  const [slip, setSlip] = useState<SlipLine[]>([]);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [winCeleb, setWinCeleb] = useState<WinCeleb | null>(null);

  // Live data.
  const stateQuery = useWingoState(mode);
  const myBetsQuery = useWingoMyBets(mode);
  const placeMutation = usePlaceWingoBet();
  const balanceQuery = useBalance();

  const state = stateQuery.data;
  const round = state?.round ?? null;
  const paytable = state?.paytable;
  const available = !!state && state.enabled && state.modeEnabled;
  const minStake = state?.minStake ?? 1;
  const maxStake = state?.maxStake ?? 100_000;
  const balance = balanceQuery.data?.balance ?? 0;

  // Synchronous guards for the money path. The idempotency key is minted once
  // per slip submission and reused on every retry of the SAME slip, so a
  // network-ambiguous retry maps to one server placement, not two debits. Any
  // edit to the slip clears it so a changed slip gets a fresh key.
  const submittingRef = useRef(false);
  const idemRef = useRef<string | null>(null);

  // Seed the stake field with the live minimum the first time it arrives.
  useEffect(() => {
    if (state && stakeText === '') setStakeText(String(state.minStake));
  }, [state, stakeText]);

  // Win celebration (#7): when a new result settles, refetch the player's bets
  // and, if any won on that period, reveal the branded congratulations popup.
  const lastResultRef = useRef<string | null>(null);
  useEffect(() => {
    const top = state?.results?.[0];
    if (!top) return;
    if (lastResultRef.current === null) {
      lastResultRef.current = top.periodNumber;
      return;
    }
    if (lastResultRef.current === top.periodNumber) return;
    lastResultRef.current = top.periodNumber;
    myBetsQuery
      .refetch()
      .then((res) => {
        const wins = (res.data?.bets ?? []).filter((b) => b.periodNumber === top.periodNumber && b.status === 'WON');
        const amount = wins.reduce((s, b) => s + (b.payoutAmount || 0), 0);
        if (amount > 0) setWinCeleb({ periodNumber: top.periodNumber, amount, result: top.result, lineCount: wins.length });
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.results]);

  // Local clock so the countdown ticks between polls. Each poll refreshes the
  // round window and the server-time anchor, so the ticking value resyncs.
  const [clock, setClock] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setClock(Date.now()), 500);
    return () => clearInterval(id);
  }, []);

  // Server-vs-device clock skew, measured at the moment this state was fetched,
  // so the countdown is anchored to the server clock, not the phone's.
  const serverOffset = useMemo(() => {
    if (!state?.serverTime || !stateQuery.dataUpdatedAt) return 0;
    const parsed = Date.parse(state.serverTime);
    return Number.isFinite(parsed) ? parsed - stateQuery.dataUpdatedAt : 0;
  }, [state?.serverTime, stateQuery.dataUpdatedAt]);

  const effNow = clock + serverOffset;
  const betCloseMs = round ? Date.parse(round.betCloseAt) : 0;
  const drawMs = round ? Date.parse(round.drawsAt) : 0;
  const isOpen = !!round && effNow < betCloseMs;
  const target = isOpen ? betCloseMs : drawMs;
  const secondsRemaining = round ? Math.max(0, Math.ceil((target - effNow) / 1000)) : 0;
  const locked = !round || !isOpen;

  const mm = String(Math.floor(secondsRemaining / 60)).padStart(2, '0');
  const ss = String(secondsRemaining % 60).padStart(2, '0');

  // 0-9 ball grid: five per row inside the padded panel.
  const ballSize = useMemo(() => {
    const inner = width - 24 - 32;
    return Math.min(58, Math.floor((inner - 10 * 4) / 5));
  }, [width]);

  const stakeValue = Number(stakeText);
  const stakeValid = Number.isFinite(stakeValue) && stakeValue >= minStake && stakeValue * multiplier <= maxStake;

  const slipTotal = useMemo(() => slip.reduce((sum, l) => sum + l.stake * l.quantity, 0), [slip]);
  const selectedNumbers = useMemo(
    () => new Set(slip.filter((l) => l.betType === 'number').map((l) => l.selection)),
    [slip],
  );
  const selectedColors = useMemo(
    () => new Set(slip.filter((l) => l.betType === 'color').map((l) => l.selection)),
    [slip],
  );
  const selectedSizes = useMemo(
    () => new Set(slip.filter((l) => l.betType === 'size').map((l) => l.selection)),
    [slip],
  );

  // Any mutation of the slip invalidates the pending idempotency key: a
  // different slip must never reuse a previous slip's key. But while a
  // placement is IN FLIGHT the key must stay frozen: if an ambiguous failure
  // (server debited, response lost) is retried, it must reuse the same key so
  // the server dedupes it. So this bails during flight, and the slip-edit
  // handlers below also bail, so the slip cannot change mid-placement.
  function resetIdem() {
    if (submittingRef.current) return;
    idemRef.current = null;
  }

  function addLine(betType: WingoBetType, selection: string) {
    if (submittingRef.current) return;
    if (!available || locked) return;
    if (!stakeValid) {
      setNotice({
        type: 'error',
        text: `Enter a stake between ${formatBDT(minStake)} and ${formatBDT(Math.floor(maxStake / multiplier))} for X${multiplier}.`,
      });
      return;
    }
    setNotice(null);
    resetIdem();
    slipSeq += 1;
    setSlip((prev) => [
      ...prev,
      {
        key: `l${slipSeq}`,
        betType,
        selection,
        label: betLabel(betType, selection),
        stake: stakeValue,
        quantity: multiplier,
      },
    ]);
  }

  function addRandom() {
    const n = Math.floor(Math.random() * 10);
    addLine('number', String(n));
  }

  function removeLine(key: string) {
    if (submittingRef.current) return;
    resetIdem();
    setNotice(null);
    setSlip((prev) => prev.filter((l) => l.key !== key));
  }

  function clearSlip() {
    if (submittingRef.current) return;
    resetIdem();
    setNotice(null);
    setSlip([]);
  }

  // Fail-open on an unresolved balance so the button is not transiently greyed
  // while the balance re-loads after a placement; the server still enforces
  // INSUFFICIENT_FUNDS. Re-validate every staged line against the CURRENT
  // min/max so a slip staged before an admin limit change is blocked here too.
  const insufficient = balanceQuery.isSuccess && slipTotal > balance;
  const slipWithinLimits = slip.every(
    (l) => l.stake >= minStake && l.stake * l.quantity <= maxStake,
  );
  const canPlace =
    available && !locked && slip.length > 0 && !insufficient && slipWithinLimits && !placeMutation.isPending;

  async function handlePlace() {
    // Synchronous double-submit guard: a second tap before the request resolves
    // is dropped, so one slip never debits twice from a fast double-press.
    if (submittingRef.current || !canPlace) return;
    submittingRef.current = true;
    try {
      if (!idemRef.current) idemRef.current = newIdempotencyKey();
      const res = await placeMutation.mutateAsync({
        mode,
        lines: slip.map((l) => ({
          betType: l.betType,
          selection: l.selection,
          stake: l.stake,
          quantity: l.quantity,
        })),
        idempotencyKey: idemRef.current,
      });
      // Success: clear the slip and retire the key so the next slip is fresh.
      setSlip([]);
      idemRef.current = null;
      setNotice({
        type: 'success',
        text: res.reused
          ? `Already placed on period ${res.periodNumber}.`
          : `Bet placed on period ${res.periodNumber}. Stake ${formatBDT(res.totalStake)}.`,
      });
    } catch (err) {
      // Surface the backend's bilingual message (insufficient funds, bet
      // closed, disabled, rate limited). Keep the slip AND the key so a retry
      // of the same slip reuses the key and cannot double-debit.
      const text =
        err instanceof ApiError
          ? err.message
          : 'Could not place your bet. Check your connection and try again.';
      setNotice({ type: 'error', text });
    } finally {
      submittingRef.current = false;
    }
  }

  return (
    <Screen
      className="!bg-darkbg"
      header={<GameHeader onBack={() => router.back()} balance={balance} />}
      contentClassName="px-3 pt-3 gap-4"
    >
      <StatusBar style="light" />

      {/* Mode tabs */}
      <ChipToggle
        options={MODE_TABS}
        value={mode}
        onChange={(k) => {
          setMode(k as WingoMode);
          clearSlip();
        }}
        scroll
      />

      {!state ? (
        <LoadingBoard />
      ) : !available ? (
        <UnavailableBoard />
      ) : (
        <>
          {/* Round card */}
          <View className="relative overflow-hidden rounded-2xl border border-gold-600/25">
            <Gradient colors={['#2a1608', '#1a0d18', '#05060a']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} radius={16} />
            <View
              pointerEvents="none"
              className="absolute -right-8 -top-10 h-40 w-40 rounded-full"
              style={{ backgroundColor: 'rgba(255,213,84,0.15)' }}
            />
            <View className="flex-row items-start justify-between gap-3 p-4">
              {/* Left: recent balls + period */}
              <View className="min-w-0 flex-1">
                <Text className="text-[10px] font-bold uppercase tracking-widest text-gold-300">Recent results</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ gap: 6, paddingVertical: 8 }}
                >
                  {state.results.length > 0 ? (
                    state.results.map((d) => <WingoBall key={d.periodNumber} n={d.result} size={26} />)
                  ) : (
                    <Text className="py-1.5 text-xs text-dink-lo">No results yet</Text>
                  )}
                </ScrollView>
                <Text className="mt-1 text-[10px] font-bold uppercase tracking-wider text-dink-lo">Period</Text>
                <Text className="font-mono text-sm font-bold text-white">
                  {round?.periodNumber ?? '--'}
                </Text>
              </View>

              {/* Right: countdown + status */}
              <View className="shrink-0 items-end">
                <Text className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-dink-lo">
                  {locked ? 'Draw in' : 'Bet closes in'}
                </Text>
                <View className="flex-row items-center gap-1">
                  <DigitCell ch={mm[0]} locked={locked} />
                  <DigitCell ch={mm[1]} locked={locked} />
                  <Text className={cn('px-0.5 text-lg font-black', locked ? 'text-hot' : 'text-gold-300')}>:</Text>
                  <DigitCell ch={ss[0]} locked={locked} />
                  <DigitCell ch={ss[1]} locked={locked} />
                </View>
                <View className="mt-2 flex-row items-center gap-1.5 rounded-pill border border-white/10 bg-black/40 px-2.5 py-1">
                  <View
                    className={cn('h-2 w-2 rounded-full', locked ? 'bg-hot' : 'bg-newg')}
                    style={{ shadowColor: locked ? colors.hot : colors.newg, shadowOpacity: 0.8, shadowRadius: 4 }}
                  />
                  <Text className={cn('text-[10px] font-bold uppercase tracking-wider', locked ? 'text-hot' : 'text-newg')}>
                    {locked ? 'Locked' : 'Open'}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* Stake + multiplier controls */}
          <View className="gap-3 rounded-2xl border border-white/10 bg-black/30 p-3">
            <View className="flex-row items-end gap-2">
              <View className="flex-1">
                <StakeField value={stakeText} onChange={(t) => setStakeText(t.replace(/[^0-9]/g, ''))} />
              </View>
              <Pressable
                onPress={addRandom}
                className="h-11 flex-row items-center gap-1.5 rounded-xl border border-gold-300/40 bg-gold-500/10 px-3.5 active:opacity-80"
              >
                <Icon name="shuffle" size={15} color={colors.gold300} />
                <Text className="text-xs font-black uppercase tracking-wider text-gold-300">Random</Text>
              </Pressable>
            </View>
            <View className="flex-row flex-wrap items-center gap-2">
              {MULTIPLIERS.map((q) => {
                const active = q === multiplier;
                return (
                  <Pressable
                    key={q}
                    onPress={() => setMultiplier(q)}
                    className={cn(
                      'h-10 min-w-[46px] items-center justify-center rounded-xl border px-2 active:opacity-80',
                      active ? 'border-gold-300 bg-gold-500/20' : 'border-white/15 bg-white/5',
                    )}
                  >
                    <Text className={cn('text-xs font-bold', active ? 'text-gold-300' : 'text-dink-mid')}>X{q}</Text>
                  </Pressable>
                );
              })}
            </View>
            <Text className="text-[10px] text-dink-lo">
              Stake {formatBDT(minStake)} - {formatBDT(maxStake)} per line. Tap a colour, number or size to add it.
            </Text>
          </View>

          {/* Board: colour buttons */}
          <View className="flex-row gap-2.5">
            <GlossyBar
              label="Green"
              sub={paytable ? `X${fmtMult(paytable.colorGreen)}` : undefined}
              grad={GRAD.green}
              selected={selectedColors.has('green')}
              onPress={() => addLine('color', 'green')}
            />
            <GlossyBar
              label="Violet"
              sub={paytable ? `X${fmtMult(paytable.colorViolet)}` : undefined}
              grad={GRAD.violet}
              selected={selectedColors.has('violet')}
              onPress={() => addLine('color', 'violet')}
            />
            <GlossyBar
              label="Red"
              sub={paytable ? `X${fmtMult(paytable.colorRed)}` : undefined}
              grad={GRAD.red}
              selected={selectedColors.has('red')}
              onPress={() => addLine('color', 'red')}
            />
          </View>

          {/* Board: 0-9 glossy balls */}
          <View className="relative overflow-hidden rounded-2xl border border-white/10 bg-black/30 p-4">
            <View className="mb-2 flex-row items-center justify-between">
              <Text className="text-[10px] font-bold uppercase tracking-widest text-gold-300/70">Select a number</Text>
              {paytable ? (
                <Text className="text-[10px] font-bold text-dink-lo">Exact number pays X{fmtMult(paytable.number)}</Text>
              ) : null}
            </View>
            <View className="flex-row flex-wrap justify-between" style={{ rowGap: 14 }}>
              {Array.from({ length: 10 }, (_, n) => (
                <WingoBall
                  key={n}
                  n={n}
                  size={ballSize}
                  selected={selectedNumbers.has(String(n))}
                  onPress={() => addLine('number', String(n))}
                />
              ))}
            </View>
          </View>

          {/* Big / Small bar */}
          <View className="flex-row gap-2.5">
            <GlossyBar
              label="Big 5-9"
              sub={paytable ? `X${fmtMult(paytable.big)}` : undefined}
              grad={GRAD.big}
              textColor="#3a1f00"
              selected={selectedSizes.has('big')}
              onPress={() => addLine('size', 'big')}
            />
            <GlossyBar
              label="Small 0-4"
              sub={paytable ? `X${fmtMult(paytable.small)}` : undefined}
              grad={GRAD.small}
              selected={selectedSizes.has('small')}
              onPress={() => addLine('size', 'small')}
            />
          </View>

          {/* Bet slip */}
          <BetSlip
            slip={slip}
            total={slipTotal}
            locked={locked}
            insufficient={insufficient}
            notice={notice}
            placing={placeMutation.isPending}
            canPlace={canPlace}
            onRemove={removeLine}
            onClear={clearSlip}
            onPlace={handlePlace}
          />
        </>
      )}

      {/* Lower history tabs */}
      <View className="rounded-2xl border border-white/10 bg-black/35 p-3">
        <View className="mb-3 flex-row gap-1 rounded-xl border border-white/10 bg-black/40 p-1">
          <TabButton label="Game history" icon="time" active={tab === 'game'} onPress={() => setTab('game')} />
          <TabButton label="Chart" icon="bar-chart" active={tab === 'chart'} onPress={() => setTab('chart')} />
          <TabButton label="My history" icon="person" active={tab === 'mine'} onPress={() => setTab('mine')} />
        </View>

        {tab === 'game' ? <GameHistory results={state?.results ?? []} /> : null}
        {tab === 'chart' ? <Chart results={state?.results ?? []} /> : null}
        {tab === 'mine' ? (
          <MyHistory bets={myBetsQuery.data?.bets ?? []} loading={myBetsQuery.isLoading} />
        ) : null}
      </View>

      <WinCelebration win={winCeleb} onClose={() => setWinCeleb(null)} />
    </Screen>
  );
}

// ---------- Win celebration (#7) ----------

// Layered white feathers for one wing, mirrored to build both sides. Numeric
// rotation + origin props are used (not transform strings) so react-native-svg
// renders them consistently across platforms.
const WINGO_WING = [
  { rx: 32, ry: 10, angle: 4, o: 1 },
  { rx: 27, ry: 9, angle: 18, o: 0.96 },
  { rx: 22, ry: 8, angle: 32, o: 0.92 },
  { rx: 17, ry: 7, angle: 46, o: 0.88 },
];

function WingoMedallion() {
  return (
    <View style={{ width: 220, height: 115 }}>
      <Svg width={220} height={115} viewBox="0 0 230 120">
        {/* Ribbon tails behind the medallion. */}
        <Path d="M96 62 L116 62 L116 104 L106 95 L96 104 Z" fill="#d94f10" />
        <Path d="M134 62 L114 62 L114 104 L124 95 L134 104 Z" fill="#d94f10" />
        <Rect x={94} y={54} width={42} height={20} rx={4} fill="#ef6a1e" />
        {/* Wings: right side then mirrored left side. */}
        {WINGO_WING.map((f, i) => (
          <Ellipse key={`r${i}`} cx={170} cy={60} rx={f.rx} ry={f.ry} fill="#ffffff" opacity={f.o} rotation={-f.angle} originX={148} originY={61} />
        ))}
        {WINGO_WING.map((f, i) => (
          <Ellipse key={`l${i}`} cx={60} cy={60} rx={f.rx} ry={f.ry} fill="#ffffff" opacity={f.o} rotation={f.angle} originX={82} originY={61} />
        ))}
      </Svg>
      {/* Rocket badge over the wings. */}
      <View
        className="absolute overflow-hidden"
        style={{ left: 78, top: 14, width: 64, height: 64, borderRadius: 32, borderWidth: 3, borderColor: 'rgba(255,255,255,0.9)' }}
      >
        <Gradient colors={['#ffe1a1', '#ffab3d', '#f2790f']} start={{ x: 0.3, y: 0.2 }} end={{ x: 0.85, y: 1 }} radius={32} />
        <View className="flex-1 items-center justify-center">
          <Icon name="rocket" size={28} color="#ffffff" />
        </View>
      </View>
    </View>
  );
}

function WinCelebration({ win, onClose }: { win: WinCeleb | null; onClose: () => void }) {
  const [shown, setShown] = useState(0);
  const [secs, setSecs] = useState(3);

  useEffect(() => {
    if (!win) {
      setShown(0);
      return;
    }
    let raf = 0;
    const start = Date.now();
    const to = win.amount;
    const step = () => {
      const t = Math.min(1, (Date.now() - start) / 800);
      setShown(Math.round(to * (1 - Math.pow(1 - t, 3))));
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [win]);

  useEffect(() => {
    if (!win) return;
    setSecs(3);
    const id = setInterval(() => setSecs((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, [win]);
  useEffect(() => {
    if (win && secs === 0) onClose();
  }, [win, secs, onClose]);

  if (!win) return null;
  const isBig = win.result >= 5;
  const sizeName = isBig ? 'Big' : 'Small';
  const colorName =
    win.result === 0 ? 'Red Violet' : win.result === 5 ? 'Green Violet' : win.result % 2 === 0 ? 'Red' : 'Green';
  const dotColor =
    win.result === 0 || win.result === 5 ? '#c026d3' : win.result % 2 === 0 ? '#ef4444' : '#22c55e';
  const pill = 'rounded-full px-3 py-1';
  const pillBg = { backgroundColor: 'rgba(198,58,48,0.92)' } as const;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View className="flex-1 items-center justify-center bg-black/70 px-6">
        <View className="w-full max-w-sm">
          {/* Orange congratulations card. */}
          <View className="relative rounded-3xl">
            <Gradient colors={['#ff9a52', '#f56a3a', '#ef5b4f']} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} radius={24} />
            <View className="items-center px-6 pb-6 pt-14">
              <Text className="text-2xl font-black text-white">Congratulations</Text>

              {/* Lottery result: colour + number + size pills. */}
              <View className="mt-4 flex-row flex-wrap items-center justify-center gap-2">
                <Text className="text-sm font-semibold text-white/90">Lottery results</Text>
                <View className={`${pill} flex-row items-center gap-1.5`} style={pillBg}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: dotColor }} />
                  <Text className="text-xs font-bold text-white">{colorName}</Text>
                </View>
                <View className={pill} style={pillBg}>
                  <Text className="text-xs font-bold text-white">{win.result}</Text>
                </View>
                <View className={pill} style={pillBg}>
                  <Text className="text-xs font-bold text-white">{sizeName}</Text>
                </View>
              </View>

              {/* Bonus receipt strip, amount counting up. */}
              <View className="mt-5 w-full rounded-2xl bg-white px-5 py-4" style={{ maxWidth: 300 }}>
                <Text className="text-xs font-extrabold uppercase" style={{ color: '#c8341f', letterSpacing: 1 }}>Bonus</Text>
                <Text className="mt-0.5 text-3xl font-black" style={{ color: '#d8452f' }}>{formatBDT(shown)}</Text>
                <Text className="mt-1 text-[11px]" style={{ color: '#737373' }}>
                  Period: {win.periodNumber}
                  {win.lineCount > 1 ? ` · ${win.lineCount} lines` : ''}
                </Text>
              </View>

              {/* Auto-close indicator. */}
              <View className="mt-4 flex-row items-center justify-center gap-2">
                <View className="items-center justify-center" style={{ width: 20, height: 20, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.6)' }}>
                  <Text className="text-[10px] font-bold text-white">{secs}</Text>
                </View>
                <Text className="text-[12px] font-semibold text-white">{secs} second{secs === 1 ? '' : 's'} auto close</Text>
              </View>
            </View>
          </View>

          {/* Winged rocket medallion overlapping the card top. */}
          <View pointerEvents="none" className="absolute left-0 right-0 items-center" style={{ top: -52 }}>
            <WingoMedallion />
          </View>

          {/* Close button below the card. */}
          <View className="mt-4 items-center">
            <Pressable
              onPress={onClose}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Close"
              className="h-10 w-10 items-center justify-center rounded-full"
              style={{ borderWidth: 1, borderColor: 'rgba(255,255,255,0.4)', backgroundColor: 'rgba(255,255,255,0.15)' }}
            >
              <Icon name="close" size={22} color="#ffffff" />
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// A multiplier can be fractional (1.5x half case). Trim a trailing .0.
function fmtMult(v: number): string {
  return Number.isInteger(v) ? String(v) : String(Math.round(v * 100) / 100);
}

// ---------- Header ----------

function GameHeader({ onBack, balance }: { onBack: () => void; balance: number }) {
  return (
    <View className="flex-row items-center justify-between border-b border-white/10 bg-darkbg px-3 py-2.5">
      <View className="flex-row items-center gap-2">
        <Pressable
          onPress={onBack}
          hitSlop={8}
          className="h-9 w-9 items-center justify-center rounded-xl active:bg-white/10"
        >
          <Icon name="chevron-back" size={22} color="#ffffff" />
        </Pressable>
        <Text className="text-lg font-black text-white">Pasha WinGo</Text>
      </View>
      <View className="flex-row items-center gap-2">
        <View className="flex-row items-center gap-1.5 rounded-pill border border-gold-600/40 bg-gold-500/15 px-2.5 py-1.5">
          <Icon name="wallet" size={13} color={colors.gold300} />
          <Text className="text-[11px] font-black text-white">{formatBDT(balance)}</Text>
        </View>
        <View className="flex-row items-center gap-1 rounded-pill border border-newg/40 bg-newg/10 px-2 py-1.5">
          <Icon name="shield-checkmark" size={12} color={colors.neon} />
          <Text className="text-[10px] font-bold uppercase text-white">Fair</Text>
        </View>
      </View>
    </View>
  );
}

// ---------- Loading + unavailable ----------

function LoadingBoard() {
  return (
    <View className="items-center justify-center rounded-2xl border border-white/10 bg-black/30 py-16">
      <Icon name="hourglass-outline" size={30} color={colors.gold300} />
      <Text className="mt-3 text-sm font-bold text-dink-mid">Loading live round...</Text>
      <Text className="mt-1 text-xs text-dink-lo">লাইভ রাউন্ড লোড হচ্ছে...</Text>
    </View>
  );
}

function UnavailableBoard() {
  return (
    <View className="items-center justify-center rounded-2xl border border-gold-600/25 bg-black/30 px-6 py-14">
      <View className="h-16 w-16 items-center justify-center rounded-full bg-gold-500/15">
        <Icon name="pause-circle" size={30} color={colors.gold300} />
      </View>
      <Text className="mt-4 text-center text-base font-black text-white">WinGo is temporarily unavailable</Text>
      <Text className="mt-1.5 text-center text-sm text-dink-mid">উইনগো সাময়িকভাবে বন্ধ আছে</Text>
      <Text className="mt-3 max-w-[280px] text-center text-xs text-dink-lo">
        This game mode is paused right now. Please check back again shortly.
      </Text>
    </View>
  );
}

// ---------- Pieces ----------

function StakeField({ value, onChange }: { value: string; onChange: (t: string) => void }) {
  return (
    <View>
      <Text className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-dink-lo">Stake per line (BDT)</Text>
      <TextField
        icon="cash"
        placeholder="Amount"
        value={value}
        onChangeText={onChange}
        keyboardType="number-pad"
      />
    </View>
  );
}

function DigitCell({ ch, locked }: { ch: string; locked: boolean }) {
  return (
    <View
      className={cn(
        'h-8 w-6 items-center justify-center rounded-md border',
        locked ? 'border-hot/60 bg-hot/15' : 'border-gold-300/40 bg-black/50',
      )}
    >
      <Text className={cn('text-lg font-black', locked ? 'text-hot' : 'text-gold-300')}>{ch}</Text>
    </View>
  );
}

function GlossyBar({
  label,
  sub,
  grad,
  textColor = '#ffffff',
  selected = false,
  onPress,
}: {
  label: string;
  sub?: string;
  grad: readonly string[];
  textColor?: string;
  selected?: boolean;
  onPress?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className={cn(
        'relative h-14 flex-1 items-center justify-center overflow-hidden rounded-2xl active:opacity-90',
        selected && 'border-2 border-gold-300',
      )}
    >
      <Gradient colors={grad} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} radius={16} />
      <View
        pointerEvents="none"
        className="absolute inset-x-0 top-0 h-1/2 rounded-t-2xl"
        style={{ backgroundColor: 'rgba(255,255,255,0.2)' }}
      />
      <Text style={{ color: textColor }} className="text-base font-black uppercase tracking-wider">
        {label}
      </Text>
      {sub ? (
        <Text style={{ color: textColor }} className="text-[10px] font-bold opacity-80">
          {sub}
        </Text>
      ) : null}
      {selected ? (
        <View className="absolute right-1.5 top-1.5 h-4 w-4 items-center justify-center rounded-full bg-gold-300">
          <Icon name="checkmark" size={11} color="#3a2800" />
        </View>
      ) : null}
    </Pressable>
  );
}

// ---------- Bet slip ----------

function BetSlip({
  slip,
  total,
  locked,
  insufficient,
  notice,
  placing,
  canPlace,
  onRemove,
  onClear,
  onPlace,
}: {
  slip: SlipLine[];
  total: number;
  locked: boolean;
  insufficient: boolean;
  notice: Notice | null;
  placing: boolean;
  canPlace: boolean;
  onRemove: (key: string) => void;
  onClear: () => void;
  onPlace: () => void;
}) {
  const hasLines = slip.length > 0;
  return (
    <View className="gap-3 rounded-2xl border border-gold-600/25 bg-black/40 p-3">
      <View className="flex-row items-center justify-between">
        <Text className="text-[11px] font-bold uppercase tracking-widest text-gold-300">Bet slip</Text>
        {hasLines ? (
          <Pressable onPress={onClear} hitSlop={6} className="flex-row items-center gap-1 active:opacity-70">
            <Icon name="trash" size={13} color={colors.dinkLo} />
            <Text className="text-[11px] font-bold text-dink-lo">Clear</Text>
          </Pressable>
        ) : null}
      </View>

      {hasLines ? (
        <View className="gap-1.5">
          {slip.map((l) => (
            <View
              key={l.key}
              className="flex-row items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2"
            >
              {l.betType === 'number' ? (
                <WingoBall n={Number(l.selection)} size={26} />
              ) : (
                <View className="h-6 w-6 items-center justify-center rounded-full border border-white/15 bg-white/10">
                  <Text className="text-[9px] font-black uppercase text-white">{l.label.slice(0, 2)}</Text>
                </View>
              )}
              <View className="min-w-0 flex-1">
                <Text className="text-xs font-bold text-white" numberOfLines={1}>
                  {l.label}
                </Text>
                <Text className="text-[10px] text-dink-lo">
                  {formatBDT(l.stake)} x{l.quantity}
                </Text>
              </View>
              <Text className="text-xs font-bold text-dink-mid">{formatBDT(l.stake * l.quantity)}</Text>
              <Pressable onPress={() => onRemove(l.key)} hitSlop={6} className="active:opacity-70">
                <Icon name="close-circle" size={18} color={colors.dinkLo} />
              </Pressable>
            </View>
          ))}
        </View>
      ) : (
        <Text className="py-1 text-xs text-dink-lo">No picks yet. Tap a colour, number or size to stake it.</Text>
      )}

      {notice ? (
        <View
          className={cn(
            'flex-row items-center gap-2 rounded-xl border px-3 py-2',
            notice.type === 'success' ? 'border-newg/40 bg-newg/10' : 'border-hot/40 bg-hot/10',
          )}
        >
          <Icon
            name={notice.type === 'success' ? 'checkmark-circle' : 'alert-circle'}
            size={15}
            color={notice.type === 'success' ? colors.newg : colors.hot}
          />
          <Text className={cn('flex-1 text-xs font-medium', notice.type === 'success' ? 'text-newg' : 'text-hot')}>
            {notice.text}
          </Text>
        </View>
      ) : null}

      {hasLines ? (
        <View className="flex-row items-center justify-between">
          <View>
            <Text className="text-[10px] font-bold uppercase tracking-wider text-dink-lo">Total stake</Text>
            <Text className="text-base font-black text-white">{formatBDT(total)}</Text>
          </View>
          <Pressable
            onPress={onPlace}
            disabled={!canPlace}
            className={cn(
              'h-12 items-center justify-center overflow-hidden rounded-pill px-8',
              canPlace ? 'active:opacity-90' : 'opacity-50',
            )}
          >
            <Gradient colors={['#FFE066', '#FFCC00', '#F5B400']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} radius={999} />
            <View className="flex-row items-center gap-2">
              <Icon name={placing ? 'hourglass' : 'rocket'} size={16} color={colors.ink} />
              <Text className="text-sm font-black uppercase tracking-wider text-ink">
                {placing ? 'Placing...' : locked ? 'Round locked' : 'Place bet'}
              </Text>
            </View>
          </Pressable>
        </View>
      ) : null}

      {insufficient && hasLines ? (
        <Text className="text-[11px] font-medium text-hot">
          Total exceeds your balance. Lower the stake or deposit to continue.
        </Text>
      ) : null}
    </View>
  );
}

function TabButton({
  label,
  icon,
  active,
  onPress,
}: {
  label: string;
  icon: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className={cn(
        'h-9 flex-1 flex-row items-center justify-center gap-1.5 rounded-lg active:opacity-80',
        active ? 'bg-gold-500/20' : '',
      )}
    >
      <Icon name={icon} size={13} color={active ? colors.gold300 : colors.dinkLo} />
      <Text
        className={cn('text-[11px] font-bold uppercase tracking-wide', active ? 'text-gold-300' : 'text-dink-lo')}
        numberOfLines={1}
      >
        {label}
      </Text>
    </Pressable>
  );
}

// ---------- Game history tab ----------

function GameHistory({ results }: { results: WingoResult[] }) {
  if (results.length === 0) {
    return (
      <View className="items-center justify-center rounded-2xl border border-white/10 bg-black/25 py-10">
        <Text className="text-xs text-dink-lo">No results yet for this mode.</Text>
      </View>
    );
  }
  return (
    <View className="overflow-hidden rounded-2xl border border-white/10 bg-black/25">
      <View className="flex-row items-center border-b border-white/10 px-4 py-2.5">
        <Text className="flex-1 text-[10px] font-bold uppercase tracking-widest text-gold-300/60">Period</Text>
        <Text className="w-12 text-center text-[10px] font-bold uppercase tracking-widest text-gold-300/60">No.</Text>
        <Text className="w-20 text-right text-[10px] font-bold uppercase tracking-widest text-gold-300/60">Result</Text>
      </View>
      {results.map((d, i) => (
        <View
          key={d.periodNumber}
          className={cn(
            'flex-row items-center px-4 py-2.5',
            i % 2 === 1 && 'bg-white/[0.02]',
            i < results.length - 1 && 'border-b border-white/[0.06]',
          )}
        >
          <Text className="flex-1 font-mono text-xs text-dink-mid">{d.periodNumber}</Text>
          <View className="w-12 items-center">
            <WingoBall n={d.result} size={30} />
          </View>
          <View className="w-20 flex-row items-center justify-end gap-1.5">
            <SizePill n={d.result} />
          </View>
        </View>
      ))}
    </View>
  );
}

// ---------- Chart tab ----------

function Chart({ results }: { results: WingoResult[] }) {
  const stats = useMemo(() => {
    let big = 0;
    let small = 0;
    let red = 0;
    let green = 0;
    let violet = 0;
    for (const d of results) {
      if (sizeOf(d.result) === 'big') big++;
      else small++;
      const id = colorOf(d.result);
      if (id === 'red' || id === 'red_violet') red++;
      if (id === 'green' || id === 'green_violet') green++;
      if (id === 'red_violet' || id === 'green_violet') violet++;
    }
    return { big, small, red, green, violet, total: results.length };
  }, [results]);

  if (results.length === 0) {
    return (
      <View className="items-center justify-center rounded-2xl border border-white/10 bg-black/25 py-10">
        <Text className="text-xs text-dink-lo">No data to chart yet.</Text>
      </View>
    );
  }

  return (
    <View className="gap-2.5">
      <View className="flex-row flex-wrap justify-between" style={{ rowGap: 10 }}>
        <StatCard label="Big" value={stats.big} total={stats.total} grad={GRAD.big} text="#ffdf9a" />
        <StatCard label="Small" value={stats.small} total={stats.total} grad={GRAD.small} text="#a9dcff" />
        <StatCard label="Violet" value={stats.violet} total={stats.total} grad={GRAD.violet} text="#d9b8ff" />
        <StatCard label="Red" value={stats.red} total={stats.total} grad={GRAD.red} text="#ffb4bf" />
        <StatCard label="Green" value={stats.green} total={stats.total} grad={GRAD.green} text="#8ff5d0" />
        <StatCard label="Draws" value={stats.total} total={stats.total} grad={GRAD.big} text="#f1e2b2" />
      </View>

      {/* Number frequency rail */}
      <View className="rounded-2xl border border-white/10 bg-black/25 p-3">
        <Text className="mb-3 text-[11px] font-bold uppercase tracking-widest text-gold-300/70">Number trend</Text>
        <View className="flex-row flex-wrap justify-between" style={{ rowGap: 10 }}>
          {results.map((d) => (
            <WingoBall key={d.periodNumber} n={d.result} size={26} />
          ))}
        </View>
      </View>
    </View>
  );
}

function StatCard({
  label,
  value,
  total,
  grad,
  text,
}: {
  label: string;
  value: number;
  total: number;
  grad: readonly string[];
  text: string;
}) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <View style={{ width: '31.5%' }} className="overflow-hidden rounded-2xl border border-white/10 bg-black/40 p-2.5">
      <View className="flex-row items-center justify-between">
        <View className="h-2.5 w-2.5 overflow-hidden rounded-full">
          <Gradient colors={grad} radius={999} />
        </View>
        <Text className="rounded-pill bg-white/10 px-1.5 py-0.5 text-[9px] font-bold text-dink-mid">{pct}%</Text>
      </View>
      <Text className="mt-1.5 text-[10px] font-bold uppercase tracking-wider text-dink-lo">{label}</Text>
      <Text className="text-xl font-black" style={{ color: text }}>
        {value}
      </Text>
      <View className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-white/10">
        <View className="h-full overflow-hidden rounded-full" style={{ width: `${pct}%` }}>
          <Gradient colors={grad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} radius={999} />
        </View>
      </View>
    </View>
  );
}

// ---------- My history tab ----------

function MyHistory({ bets, loading }: { bets: WingoMyBet[]; loading: boolean }) {
  if (loading && bets.length === 0) {
    return (
      <View className="items-center justify-center rounded-2xl border border-white/10 bg-black/25 py-10">
        <Text className="text-xs text-dink-lo">Loading your bets...</Text>
      </View>
    );
  }
  if (bets.length === 0) {
    return (
      <View className="items-center justify-center rounded-2xl border border-white/10 bg-black/25 py-10">
        <Text className="text-xs text-dink-lo">You have not placed any WinGo bets yet.</Text>
      </View>
    );
  }
  return (
    <View className="gap-2">
      {bets.map((b) => {
        const status = String(b.status).toUpperCase();
        const won = status === 'WON';
        const pending = status === 'PENDING';
        const refunded = status === 'REFUNDED';
        const isNumber = b.betType === 'number';
        return (
          <View key={b.id} className="flex-row items-center gap-3 rounded-xl border border-white/10 bg-black/30 p-3">
            {isNumber ? (
              <WingoBall n={Number(b.selection)} size={34} />
            ) : (
              <View className="h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-white/10">
                <Text className="text-[10px] font-black uppercase text-white">
                  {betLabel(b.betType as WingoBetType, b.selection).slice(0, 3)}
                </Text>
              </View>
            )}
            <View className="min-w-0 flex-1">
              <Text className="text-xs font-bold text-white" numberOfLines={1}>
                {betLabel(b.betType as WingoBetType, b.selection)}
                {b.quantity > 1 ? <Text className="text-dink-lo"> x{b.quantity}</Text> : null}
              </Text>
              <Text className="font-mono text-[10px] text-dink-lo">{b.periodNumber}</Text>
            </View>
            <View className="items-end">
              <Text className="text-xs font-bold text-dink-mid">{formatBDT(b.betAmount)}</Text>
              <Text
                className={cn(
                  'text-[11px] font-black uppercase tracking-wider',
                  won ? 'text-newg' : pending ? 'text-gold-300' : refunded ? 'text-dink-mid' : 'text-hot',
                )}
              >
                {pending
                  ? 'Pending'
                  : won
                    ? `+${formatBDT(b.payoutAmount)}`
                    : refunded
                      ? 'Refunded'
                      : 'Lost'}
              </Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

// A small Big / Small pill for the history rows.
function SizePill({ n }: { n: number }) {
  const big = sizeOf(n) === 'big';
  return (
    <View className="relative overflow-hidden rounded-pill px-2 py-0.5">
      <Gradient colors={big ? GRAD.big : GRAD.small} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} radius={999} />
      <Text className="text-[10px] font-black uppercase" style={{ color: big ? '#3a2800' : '#052436' }}>
        {big ? 'Big' : 'Small'}
      </Text>
    </View>
  );
}
