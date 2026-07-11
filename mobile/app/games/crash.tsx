// Built by Anointed Coder.
//
// Pasha Crash, wired to LIVE play and REAL money. The premium rising-curve
// board is kept. The backend Crash contract is a SINGLE-SHOT auto cash out:
// the player commits an auto cash out target up front, and Place Bet settles
// one round through the real bet endpoint (POST /api/native-games/crash/bet).
// The round wins when the drawn crash point reaches the target; the crash
// point, win/loss, payout and running balance all come from the server.
//
// There is no interactive "cash out while it climbs" stream in the backend, so
// this screen does not fake one - it presents the honest auto cash out model.
// Real money is wagered, so the bet is guarded by a synchronous in-flight ref,
// a stable idempotency key reused on retry, and a disabled Place Bet while the
// target or stake is out of range.

import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Svg, { Circle, Defs, Line, LinearGradient, Polygon, Polyline, Stop } from 'react-native-svg';
import { Screen, Card } from '@/components/ui';
import { formatBDT } from '@/lib/format';
import { colors } from '@/lib/theme';
import { cn } from '@/lib/cn';
import { ApiError } from '@/lib/api/client';
import { useBalance, useNativeGame, useCreateNativeSession, useCrashBet } from '@/lib/api/hooks';
import { newNativeIdempotencyKey, type CrashConfig, type CrashBetResult } from '@/lib/api/native-games';
import { useAuth } from '@/store/auth';

const VW = 320;
const VH = 180;
const STEPS = 40;

const points = Array.from({ length: STEPS + 1 }, (_, i) => {
  const t = i / STEPS;
  const x = t * VW;
  const y = VH - (VH - 22) * Math.pow(t, 1.9);
  return [x, y] as const;
});
const linePts = points.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
const areaPts = `0,${VH} ${linePts} ${VW},${VH}`;
const head = points[points.length - 1];

interface Notice {
  type: 'success' | 'error';
  text: string;
}
interface HistoryItem {
  label: string;
  win: boolean;
}

const SESSION_ERROR_CODES = new Set(['SESSION_NOT_FOUND', 'SESSION_INACTIVE', 'SESSION_NOT_OWNED']);

export default function CrashScreen() {
  const { width } = useWindowDimensions();
  const { status } = useAuth();

  const gameQuery = useNativeGame('crash');
  const balanceQuery = useBalance();
  const sessionMutation = useCreateNativeSession('crash');
  const betMutation = useCrashBet();

  const view = gameQuery.data;
  const game = view?.game;
  const available = !!view && view.enabled && !!game?.isActive;
  const minBet = game?.minBet ?? 10;
  const maxBet = game?.maxBet ?? 5_000;
  const cfg = (game?.config ?? {}) as Partial<CrashConfig>;
  const minTarget = Number.isFinite(cfg.minTargetMultiplier) ? Number(cfg.minTargetMultiplier) : 1.01;
  const maxTarget = Number.isFinite(cfg.maxTargetMultiplier) ? Number(cfg.maxTargetMultiplier) : 100;

  const balance = balanceQuery.data?.balance ?? 0;

  const [amount, setAmount] = useState(minBet);
  const [target, setTarget] = useState(2);
  const [last, setLast] = useState<CrashBetResult | null>(null);
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
    setTarget((t) => clampTarget(t, minTarget, maxTarget));
  }, [minTarget, maxTarget]);

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
  function changeTarget(next: number) {
    if (submittingRef.current) return;
    resetIdem();
    setTarget(clampTarget(next, minTarget, maxTarget));
  }

  const stakeValid = Number.isFinite(amount) && amount >= minBet && amount <= maxBet;
  const targetValid = Number.isFinite(target) && target >= minTarget && target <= maxTarget;
  const insufficient = balanceQuery.isSuccess && amount > balance;
  const canBet =
    available && status === 'authed' && stakeValid && targetValid && !insufficient && !betMutation.isPending;
  const payoutPreview = Math.round(amount * target);

  async function handleBet() {
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
      if (!idemRef.current) idemRef.current = newNativeIdempotencyKey('crash');
      let sid = sessionId;
      if (!sid) {
        const s = await sessionMutation.mutateAsync(undefined);
        sid = s.id;
        setSessionId(sid);
      }
      const res = await betMutation.mutateAsync({
        sessionId: sid,
        targetMultiplier: Number(target.toFixed(2)),
        betAmount: amount,
        idempotencyKey: idemRef.current,
      });
      idemRef.current = null;
      setLast(res);
      setHistory((prev) => [{ label: `${res.crashPoint.toFixed(2)}x`, win: res.win }, ...prev].slice(0, 12));
      setNotice({
        type: res.win ? 'success' : 'error',
        text: res.win
          ? `Crashed at ${res.crashPoint.toFixed(2)}x. Auto cashed at ${res.targetMultiplier.toFixed(2)}x for ${formatBDT(res.payout)}.`
          : `Crashed at ${res.crashPoint.toFixed(2)}x, below your ${res.targetMultiplier.toFixed(2)}x. No win this time.`,
      });
    } catch (err) {
      if (err instanceof ApiError && SESSION_ERROR_CODES.has(err.code)) {
        setSessionId(null);
        idemRef.current = null;
      }
      const text =
        err instanceof ApiError && err.message !== err.code
          ? err.message
          : 'Could not place your bet. Check your connection and try again.';
      setNotice({ type: 'error', text });
    } finally {
      submittingRef.current = false;
    }
  }

  const chartW = Math.min(width - 32, 460) - 32;
  const chartH = chartW * (VH / VW);
  const overlayColor = last ? (last.win ? colors.neon : colors.hot) : colors.neon;

  return (
    <Screen header={<GameTopBar title="Crash" subtitle="Pasha Originals" balance={balance} />} contentClassName="px-4 pt-3 gap-4">
      {!view ? (
        <LoadingBoard />
      ) : !available ? (
        <UnavailableBoard />
      ) : (
        <>
          {/* Board */}
          <Card tone="dark" className="overflow-hidden">
            <View className="mb-2 flex-row items-center justify-between">
              <View className="flex-row items-center gap-1.5">
                <View className={cn('h-2 w-2 rounded-full', last ? (last.win ? 'bg-newg' : 'bg-hot') : 'bg-newg')} />
                <Text className="text-[11px] font-black uppercase tracking-widest text-white/55">
                  {last ? (last.win ? 'Cashed Out' : 'Crashed') : 'Auto Cash Out'}
                </Text>
              </View>
              <Text className="text-[11px] font-bold text-white/50">Target {target.toFixed(2)}x</Text>
            </View>

            <View style={{ width: chartW, height: chartH }} className="relative self-center">
              <Svg width={chartW} height={chartH} viewBox={`0 0 ${VW} ${VH}`}>
                <Defs>
                  <LinearGradient id="crashFill" x1="0" y1="0" x2="0" y2="1">
                    <Stop offset="0" stopColor={overlayColor} stopOpacity={0.32} />
                    <Stop offset="1" stopColor={overlayColor} stopOpacity={0} />
                  </LinearGradient>
                </Defs>
                {[0.25, 0.5, 0.75].map((g) => (
                  <Line key={g} x1={0} y1={VH * g} x2={VW} y2={VH * g} stroke="rgba(255,255,255,0.08)" strokeWidth={1} />
                ))}
                <Polygon points={areaPts} fill="url(#crashFill)" />
                <Polyline points={linePts} fill="none" stroke={overlayColor} strokeWidth={3} strokeLinejoin="round" />
                <Circle cx={head[0]} cy={head[1]} r={6} fill={overlayColor} />
                <Circle cx={head[0]} cy={head[1]} r={11} fill={overlayColor} fillOpacity={0.22} />
              </Svg>

              <View className="absolute inset-0 items-center justify-center" pointerEvents="none">
                <Text className="text-5xl font-black" style={{ color: overlayColor }}>
                  {last ? `${last.crashPoint.toFixed(2)}x` : `${target.toFixed(2)}x`}
                </Text>
                <Text className="mt-1 text-[11px] font-bold uppercase tracking-widest text-white/50">
                  {last ? 'Crash Point' : 'Your Auto Cash Out'}
                </Text>
              </View>
            </View>
          </Card>

          {/* Auto cash out target */}
          <Card>
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center gap-2">
                <View className="h-8 w-8 items-center justify-center rounded-lg bg-gold-500/15">
                  <Ionicons name="rocket" size={16} color={colors.gold700} />
                </View>
                <View>
                  <Text className="text-xs font-bold text-ink">Auto Cash Out</Text>
                  <Text className="text-[11px] text-ink-mute">
                    {minTarget.toFixed(2)}x - {maxTarget.toFixed(0)}x
                  </Text>
                </View>
              </View>
              <View className="flex-row items-center gap-2">
                <StepButton icon="remove" onPress={() => changeTarget(target - 0.1)} />
                <View className="min-w-[74px] items-center rounded-lg border border-divider bg-surface px-3 py-1.5">
                  <Text className="text-sm font-black text-ink">{target.toFixed(2)}x</Text>
                </View>
                <StepButton icon="add" onPress={() => changeTarget(target + 0.1)} />
              </View>
            </View>
            <View className="mt-2.5 flex-row gap-2">
              {[1.5, 2, 5, 10].filter((t) => t >= minTarget && t <= maxTarget).map((t) => {
                const active = Math.abs(target - t) < 0.005;
                return (
                  <Pressable
                    key={t}
                    onPress={() => changeTarget(t)}
                    className={cn(
                      'flex-1 items-center rounded-lg border py-2 active:opacity-80',
                      active ? 'border-gold-600 bg-gold-500' : 'border-divider bg-paper',
                    )}
                  >
                    <Text className={cn('text-xs font-black', active ? 'text-ink' : 'text-ink-soft')}>{t.toFixed(2)}x</Text>
                  </Pressable>
                );
              })}
            </View>
          </Card>

          <Card className="flex-row items-center justify-between">
            <Text className="text-xs font-bold uppercase tracking-wider text-ink-mute">Win Pays</Text>
            <Text className="text-base font-black" style={{ color: colors.gold700 }}>
              {formatBDT(payoutPreview)}
            </Text>
          </Card>

          <BetControls amount={amount} onChange={changeAmount} minBet={minBet} maxBet={maxBet} balance={balance} />

          <BetButton
            label={betMutation.isPending ? 'Placing...' : 'Place Bet'}
            pending={betMutation.isPending}
            disabled={!canBet}
            onPress={handleBet}
          />

          <Notices notice={notice} insufficient={insufficient} />

          <ResultsStrip items={history} />
        </>
      )}
    </Screen>
  );
}

function clampTarget(v: number, min: number, max: number): number {
  if (!Number.isFinite(v)) return min;
  return Math.min(max, Math.max(min, Math.round(v * 100) / 100));
}

// ---------- Pieces ----------

function StepButton({ icon, onPress }: { icon: 'add' | 'remove'; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      className="h-10 w-10 items-center justify-center rounded-xl border border-divider bg-surface active:opacity-80"
    >
      <Ionicons name={icon} size={18} color={colors.ink} />
    </Pressable>
  );
}

function BetButton({
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
      <Ionicons name={pending ? 'hourglass' : 'rocket'} size={20} color={colors.ink} />
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
          <Ionicons
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
          <Ionicons name="chevron-back" size={22} color={colors.ink} />
        </Pressable>
        <View>
          <Text className="text-base font-black tracking-tight text-ink">{title}</Text>
          {subtitle ? <Text className="text-[11px] text-ink-mute">{subtitle}</Text> : null}
        </View>
      </View>
      <View className="flex-row items-center gap-1 rounded-pill border border-gold-600/30 bg-gold-500/15 py-1.5 pl-2 pr-1.5">
        <Ionicons name="wallet" size={14} color={colors.gold700} />
        <Text className="text-[11px] font-black text-ink">{formatBDT(balance)}</Text>
        <View className="h-5 w-5 items-center justify-center rounded-full bg-gold-500">
          <Ionicons name="add" size={14} color={colors.ink} />
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
          <Ionicons name="remove" size={18} color={colors.ink} />
        </Pressable>
        <View className="flex-1 flex-row items-center justify-center rounded-xl border border-divider bg-surface py-3">
          <Text className="text-lg font-black text-ink">{formatBDT(amount)}</Text>
        </View>
        <Pressable
          onPress={() => onChange(amount + step)}
          className="h-11 w-11 items-center justify-center rounded-xl border border-divider bg-surface active:opacity-80"
        >
          <Ionicons name="add" size={18} color={colors.ink} />
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

function ResultsStrip({ items }: { items: HistoryItem[] }) {
  return (
    <View className="gap-2">
      <Text className="text-xs font-bold uppercase tracking-wider text-ink-mute">Recent Crashes</Text>
      {items.length === 0 ? (
        <Text className="text-[11px] text-ink-mute">No rounds yet this session.</Text>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {items.map((r, i) => (
            <View
              key={i}
              className={cn(
                'h-10 min-w-[56px] items-center justify-center rounded-lg border px-2.5',
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
      <Ionicons name="hourglass-outline" size={30} color={colors.gold700} />
      <Text className="mt-3 text-sm font-bold text-ink-soft">Loading game...</Text>
      <Text className="mt-1 text-xs text-ink-mute">গেম লোড হচ্ছে...</Text>
    </View>
  );
}

function UnavailableBoard() {
  return (
    <View className="items-center justify-center rounded-2xl border border-gold-600/25 bg-surface px-6 py-14">
      <View className="h-16 w-16 items-center justify-center rounded-full bg-gold-500/15">
        <Ionicons name="pause-circle" size={30} color={colors.gold700} />
      </View>
      <Text className="mt-4 text-center text-base font-black text-ink">Coming soon</Text>
      <Text className="mt-1.5 text-center text-sm text-ink-soft">শীঘ্রই আসছে</Text>
      <Text className="mt-3 max-w-[280px] text-center text-xs text-ink-mute">
        This game is not available to play yet. Please check back again shortly.
      </Text>
    </View>
  );
}
