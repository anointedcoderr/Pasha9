// Built by Anointed Coder.
//
// Pasha Roulette, wired to LIVE play and REAL money. The premium European wheel
// and felt are kept, trimmed to the bet types the backend actually settles:
// straight (tap any number 0..36, pays 36x) and the even-money outside bets
// red / black / odd / even / 1-18 / 19-36 (pay 2x). One selection settles one
// round through the real bet endpoint (POST /api/native-games/roulette/bet);
// the drawn number, colour, win/loss and payout come from the server.
//
// Dozens and multi-chip felt betting are intentionally omitted: the backend
// contract supports exactly one bet type per round, so faking a full felt would
// be dishonest. Real money is wagered, so the spin is guarded by a synchronous
// in-flight ref, a stable idempotency key reused on retry, and a disabled Spin
// while no bet is selected or the stake is out of range.

import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { Icon } from '@/components/ui/Icon';
import { useRouter } from 'expo-router';
import Svg, { Circle, G, Path, Polygon, Text as SvgText } from 'react-native-svg';
import { Screen, Card } from '@/components/ui';
import { formatBDT } from '@/lib/format';
import { colors } from '@/lib/theme';
import { cn } from '@/lib/cn';
import { ApiError } from '@/lib/api/client';
import { useBalance, useNativeGame, useCreateNativeSession, useRouletteBet } from '@/lib/api/hooks';
import { newNativeIdempotencyKey, type RouletteBetType, type RouletteBetResult } from '@/lib/api/native-games';
import { useAuth } from '@/store/auth';

const WHEEL = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9,
  22, 18, 29, 7, 28, 12, 35, 3, 26,
];
const RED = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
const SEG = 360 / WHEEL.length;
const CX = 100;
const CY = 100;
const RO = 96;
const RI = 58;
const RT = 79;

function polar(r: number, deg: number) {
  const a = ((deg - 90) * Math.PI) / 180;
  return { x: CX + r * Math.cos(a), y: CY + r * Math.sin(a) };
}
function segPath(a0: number, a1: number) {
  const p1 = polar(RO, a1);
  const p2 = polar(RO, a0);
  const p3 = polar(RI, a0);
  const p4 = polar(RI, a1);
  const large = a1 - a0 <= 180 ? 0 : 1;
  return `M ${p1.x} ${p1.y} A ${RO} ${RO} 0 ${large} 0 ${p2.x} ${p2.y} L ${p3.x} ${p3.y} A ${RI} ${RI} 0 ${large} 1 ${p4.x} ${p4.y} Z`;
}
function pocketFill(n: number) {
  return n === 0 ? '#1FA15A' : RED.has(n) ? '#D4342E' : '#181b22';
}

// Outside bets the backend supports, mapped to the RouletteBetType.
const OUTSIDE: { label: string; type: RouletteBetType }[] = [
  { label: '1-18', type: 'low' },
  { label: 'EVEN', type: 'even' },
  { label: 'RED', type: 'red' },
  { label: 'BLACK', type: 'black' },
  { label: 'ODD', type: 'odd' },
  { label: '19-36', type: 'high' },
];

interface Selection {
  type: RouletteBetType;
  straightNumber?: number;
}
interface Notice {
  type: 'success' | 'error';
  text: string;
}
interface HistoryItem {
  n: number;
  win: boolean;
}

const SESSION_ERROR_CODES = new Set(['SESSION_NOT_FOUND', 'SESSION_INACTIVE', 'SESSION_NOT_OWNED']);

function selectionLabel(sel: Selection): string {
  if (sel.type === 'straight') return `Straight ${sel.straightNumber}`;
  const found = OUTSIDE.find((o) => o.type === sel.type);
  return found ? found.label : sel.type;
}
function selectionMultiplier(sel: Selection): number {
  return sel.type === 'straight' ? 36 : 2;
}

export default function RouletteScreen() {
  const { width } = useWindowDimensions();
  const { status } = useAuth();

  const gameQuery = useNativeGame('roulette');
  const balanceQuery = useBalance();
  const sessionMutation = useCreateNativeSession('roulette');
  const betMutation = useRouletteBet();

  const view = gameQuery.data;
  const game = view?.game;
  const available = !!view && view.enabled && !!game?.isActive;
  const minBet = game?.minBet ?? 10;
  const maxBet = game?.maxBet ?? 10_000;

  const balance = balanceQuery.data?.balance ?? 0;

  const [amount, setAmount] = useState(minBet);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [last, setLast] = useState<RouletteBetResult | null>(null);
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

  // While a bet is in flight the inputs are frozen and the idempotency key is
  // preserved, so an ambiguous-failure retry reuses the same key and can never
  // double-debit.
  function resetIdem() {
    if (submittingRef.current) return;
    idemRef.current = null;
  }
  function changeAmount(next: number) {
    if (submittingRef.current) return;
    resetIdem();
    setAmount(Math.min(maxBet, Math.max(minBet, Math.round(next))));
  }
  function pickStraight(n: number) {
    if (submittingRef.current) return;
    resetIdem();
    setNotice(null);
    setSelection((prev) =>
      prev && prev.type === 'straight' && prev.straightNumber === n ? null : { type: 'straight', straightNumber: n },
    );
  }
  function pickOutside(type: RouletteBetType) {
    if (submittingRef.current) return;
    resetIdem();
    setNotice(null);
    setSelection((prev) => (prev && prev.type === type ? null : { type }));
  }

  const stakeValid = Number.isFinite(amount) && amount >= minBet && amount <= maxBet;
  const insufficient = balanceQuery.isSuccess && amount > balance;
  const canSpin =
    available && status === 'authed' && !!selection && stakeValid && !insufficient && !betMutation.isPending;

  async function handleSpin() {
    if (submittingRef.current) return;
    if (!available) {
      setNotice({ type: 'error', text: 'This game is unavailable right now. এই গেমটি এখন বন্ধ আছে।' });
      return;
    }
    if (status !== 'authed') {
      setNotice({ type: 'error', text: 'Please sign in to play. খেলতে সাইন ইন করুন।' });
      return;
    }
    if (!selection) {
      setNotice({ type: 'error', text: 'Select a number or an outside bet first.' });
      return;
    }
    if (!stakeValid) {
      setNotice({ type: 'error', text: `Enter a stake between ${formatBDT(minBet)} and ${formatBDT(maxBet)}.` });
      return;
    }
    submittingRef.current = true;
    try {
      if (!idemRef.current) idemRef.current = newNativeIdempotencyKey('roulette');
      let sid = sessionId;
      if (!sid) {
        const s = await sessionMutation.mutateAsync(undefined);
        sid = s.id;
        setSessionId(sid);
      }
      const res = await betMutation.mutateAsync({
        sessionId: sid,
        betType: selection.type,
        straightNumber: selection.type === 'straight' ? selection.straightNumber : undefined,
        betAmount: amount,
        idempotencyKey: idemRef.current,
      });
      idemRef.current = null;
      setLast(res);
      setHistory((prev) => [{ n: res.result, win: res.win }, ...prev].slice(0, 12));
      setNotice({
        type: res.win ? 'success' : 'error',
        text: res.win
          ? `Landed on ${res.result} ${res.resultColor}. You won ${formatBDT(res.payout)}.`
          : `Landed on ${res.result} ${res.resultColor}. No win this time.`,
      });
    } catch (err) {
      if (err instanceof ApiError && SESSION_ERROR_CODES.has(err.code)) {
        setSessionId(null);
        idemRef.current = null;
      }
      const text =
        err instanceof ApiError && err.message !== err.code
          ? err.message
          : 'Could not spin. Check your connection and try again.';
      setNotice({ type: 'error', text });
    } finally {
      submittingRef.current = false;
    }
  }

  const wheelSize = Math.min(width - 32 - 32, 300);
  const gridW = width - 32 - 32;
  const NG = 6;
  const numCell = (gridW - NG * 5) / 6;
  const isStraight = (n: number) => selection?.type === 'straight' && selection.straightNumber === n;

  return (
    <Screen header={<GameTopBar title="Roulette" subtitle="Pasha Originals" balance={balance} />} contentClassName="px-4 pt-3 gap-4">
      {!view ? (
        <LoadingBoard />
      ) : !available ? (
        <UnavailableBoard />
      ) : (
        <>
          {/* Wheel */}
          <Card tone="dark" className="items-center overflow-hidden">
            <View style={{ width: wheelSize, height: wheelSize }}>
              <Svg width={wheelSize} height={wheelSize} viewBox="0 0 200 200">
                <Circle cx={CX} cy={CY} r={RO + 2} fill={colors.gold600} />
                {WHEEL.map((n, i) => {
                  const a0 = i * SEG;
                  const a1 = (i + 1) * SEG;
                  const mid = polar(RT, a0 + SEG / 2);
                  return (
                    <G key={n}>
                      <Path d={segPath(a0, a1)} fill={pocketFill(n)} stroke="#00000030" strokeWidth={0.4} />
                      <SvgText x={mid.x} y={mid.y + 2.4} fontSize={6.4} fontWeight="bold" fill="#ffffff" textAnchor="middle">
                        {n}
                      </SvgText>
                    </G>
                  );
                })}
                <Circle cx={CX} cy={CY} r={RI - 2} fill={colors.darkbg} stroke={colors.gold600} strokeWidth={1.5} />
                <SvgText x={CX} y={CY + 4} fontSize={16} fontWeight="bold" fill={colors.goldlite} textAnchor="middle">
                  P9
                </SvgText>
                <Circle cx={polar(RO - 7, 12).x} cy={polar(RO - 7, 12).y} r={4} fill="#ffffff" />
                <Polygon points="100,2 94,14 106,14" fill={colors.goldlite} />
              </Svg>
            </View>

            <View className="mt-3 flex-row items-center gap-2">
              <Text className="text-xs font-bold uppercase tracking-widest text-white/50">Last</Text>
              {last ? (
                <Text className="text-lg font-black" style={{ color: colors.goldlite }}>
                  {last.result} {last.resultColor}
                </Text>
              ) : (
                <Text className="text-lg font-black text-white/40">--</Text>
              )}
            </View>
          </Card>

          {/* Number layout */}
          <Card className="gap-2">
            <Pressable
              onPress={() => pickStraight(0)}
              className={cn('items-center justify-center rounded-lg py-2.5 active:opacity-80', isStraight(0) && 'border-2 border-gold-300')}
              style={{ backgroundColor: '#1FA15A' }}
            >
              <Text className="text-sm font-black text-white">0</Text>
            </Pressable>

            <View className="flex-row flex-wrap" style={{ gap: NG }}>
              {Array.from({ length: 36 }, (_, i) => {
                const n = i + 1;
                const red = RED.has(n);
                const sel = isStraight(n);
                return (
                  <Pressable
                    key={n}
                    onPress={() => pickStraight(n)}
                    style={{ width: numCell, height: numCell, backgroundColor: red ? '#D4342E' : '#181b22' }}
                    className={cn('items-center justify-center rounded-lg active:opacity-80', sel && 'border-2 border-gold-300')}
                  >
                    <Text className="text-xs font-black text-white">{n}</Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Outside bets (supported types only) */}
            <View className="flex-row flex-wrap" style={{ gap: 8 }}>
              {OUTSIDE.map((o) => {
                const isRed = o.type === 'red';
                const isBlack = o.type === 'black';
                const sel = selection?.type === o.type;
                return (
                  <Pressable
                    key={o.label}
                    onPress={() => pickOutside(o.type)}
                    style={{
                      width: (gridW - 16) / 3,
                      backgroundColor: isRed ? '#D4342E' : isBlack ? '#181b22' : undefined,
                    }}
                    className={cn(
                      'items-center rounded-lg border py-2.5 active:opacity-80',
                      isRed || isBlack ? 'border-transparent' : 'border-divider bg-surface',
                      sel && 'border-2 border-gold-500',
                    )}
                  >
                    <Text className={cn('text-[11px] font-black', isRed || isBlack ? 'text-white' : 'text-ink-soft')}>
                      {o.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </Card>

          {/* Selection readout */}
          <Card className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-2">
              <View className="h-8 w-8 items-center justify-center rounded-lg bg-gold-500/15">
                <Icon name="ellipse" size={16} color={colors.gold700} />
              </View>
              <View>
                <Text className="text-xs font-bold text-ink">Your Bet</Text>
                <Text className="text-[11px] text-ink-mute">
                  {selection ? selectionLabel(selection) : 'Tap a number or outside bet'}
                </Text>
              </View>
            </View>
            <View className="rounded-lg border border-divider bg-surface px-3 py-1.5">
              <Text className="text-sm font-black text-ink">
                {selection ? `${selectionMultiplier(selection)}.00x` : '--'}
              </Text>
            </View>
          </Card>

          <BetControls amount={amount} onChange={changeAmount} minBet={minBet} maxBet={maxBet} balance={balance} />

          <SpinButton
            label={betMutation.isPending ? 'Spinning...' : 'Spin'}
            pending={betMutation.isPending}
            disabled={!canSpin}
            onPress={handleSpin}
          />

          <Notices notice={notice} insufficient={insufficient} />

          {/* Recent numbers */}
          <View className="gap-2">
            <Text className="text-xs font-bold uppercase tracking-wider text-ink-mute">Recent Numbers</Text>
            {history.length === 0 ? (
              <Text className="text-[11px] text-ink-mute">No spins yet this session.</Text>
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                {history.map((r, i) => (
                  <View
                    key={i}
                    style={{ backgroundColor: pocketFill(r.n) }}
                    className={cn('h-10 w-10 items-center justify-center rounded-full', r.win && 'border-2 border-gold-300')}
                  >
                    <Text className="text-sm font-black text-white">{r.n}</Text>
                  </View>
                ))}
              </ScrollView>
            )}
          </View>
        </>
      )}
    </Screen>
  );
}

// ---------- Pieces ----------

function SpinButton({
  label,
  pending,
  disabled,
  onPress,
}: {
  label: string;
  pending: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      className={cn(
        'h-14 flex-row items-center justify-center gap-2 rounded-2xl bg-gold-500 active:opacity-90',
        disabled && 'opacity-50',
      )}
    >
      <Icon name={pending ? 'hourglass' : 'sync'} size={20} color={colors.ink} />
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
}: {
  amount: number;
  onChange: (n: number) => void;
  minBet: number;
  maxBet: number;
  balance: number;
}) {
  const chips = [minBet, minBet * 5, 100, 500, 1000].filter((c, i, a) => c <= maxBet && a.indexOf(c) === i);
  const step = Math.max(1, minBet);
  return (
    <Card>
      <View className="flex-row items-center justify-between">
        <Text className="text-xs font-bold uppercase tracking-wider text-ink-mute">Bet Amount</Text>
        <Text className="text-[11px] text-ink-mute">Bal {formatBDT(balance)}</Text>
      </View>
      <View className="mt-2.5 flex-row items-center gap-2">
        <Pressable
          onPress={() => onChange(amount - step)}
          className="h-11 w-11 items-center justify-center rounded-xl border border-divider bg-surface active:opacity-80"
        >
          <Icon name="remove" size={18} color={colors.ink} />
        </Pressable>
        <View className="flex-1 flex-row items-center justify-center rounded-xl border border-divider bg-surface py-3">
          <Text className="text-lg font-black text-ink">{formatBDT(amount)}</Text>
        </View>
        <Pressable
          onPress={() => onChange(amount + step)}
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
