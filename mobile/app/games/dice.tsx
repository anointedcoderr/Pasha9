// Built by Anointed Coder.
//
// Pasha Dice, wired to LIVE play and REAL money. The premium dark board is
// kept; only the data source is live now. A provably-fair session is opened on
// mount, the player picks Under/Over + a target and a stake within the live
// min/max, and Roll Dice settles one round through the real bet endpoint
// (POST /api/native-games/dice/bet). The rolled number, win/loss, payout and
// the running balance all come from the server response.
//
// Real money is wagered here, so the roll is guarded three ways: a synchronous
// in-flight ref against a double-tap, a stable idempotency key reused on retry
// so the server never double-debits, and a disabled Roll button while the stake
// is out of range or the game is unavailable (the server enforces the same).

import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Icon } from '@/components/ui/Icon';
import { useRouter } from 'expo-router';
import { Screen, Card, ChipToggle, StatRow } from '@/components/ui';
import { formatBDT } from '@/lib/format';
import { colors } from '@/lib/theme';
import { cn } from '@/lib/cn';
import { ApiError } from '@/lib/api/client';
import { useBalance, useNativeGame, useCreateNativeSession, useDiceBet } from '@/lib/api/hooks';
import {
  newNativeIdempotencyKey,
  type DiceConfig,
  type DiceBetResult,
  type DiceDirection,
} from '@/lib/api/native-games';
import { useAuth } from '@/store/auth';

interface Notice {
  type: 'success' | 'error';
  text: string;
}

interface HistoryItem {
  label: string;
  win: boolean;
}

// Session errors mean the current session cannot take another bet; the screen
// drops it and opens a fresh one on the next attempt.
const SESSION_ERROR_CODES = new Set(['SESSION_NOT_FOUND', 'SESSION_INACTIVE', 'SESSION_NOT_OWNED']);

function fmtMult(v: number): string {
  return `${(Math.round(v * 100) / 100).toFixed(2)}x`;
}

export default function DiceScreen() {
  const router = useRouter();
  const { status } = useAuth();

  const gameQuery = useNativeGame('dice');
  const balanceQuery = useBalance();
  const sessionMutation = useCreateNativeSession('dice');
  const betMutation = useDiceBet();

  const view = gameQuery.data;
  const game = view?.game;
  const available = !!view && view.enabled && !!game?.isActive;
  const minBet = game?.minBet ?? 10;
  const maxBet = game?.maxBet ?? 10_000;
  const edge = (game?.houseEdgeBps ?? 0) / 10_000;
  const cfg = (game?.config ?? {}) as Partial<DiceConfig>;
  const minTarget = Number.isFinite(cfg.minTarget) ? Number(cfg.minTarget) : 2;
  const maxTarget = Number.isFinite(cfg.maxTarget) ? Number(cfg.maxTarget) : 98;

  const balance = balanceQuery.data?.balance ?? 0;

  const [amount, setAmount] = useState(minBet);
  const [direction, setDirection] = useState<DiceDirection>('under');
  const [target, setTarget] = useState(50);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [last, setLast] = useState<DiceBetResult | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);

  const submittingRef = useRef(false);
  const idemRef = useRef<string | null>(null);
  const ensuringRef = useRef(false);

  // Seed the stake to the live minimum once the config lands.
  useEffect(() => {
    if (game && amount < minBet) setAmount(minBet);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game?.minBet]);

  // Clamp the target into the live allowed band whenever the config changes.
  useEffect(() => {
    setTarget((t) => Math.min(maxTarget, Math.max(minTarget, t)));
  }, [minTarget, maxTarget]);

  // Open a provably-fair session once the game is available and the player is
  // signed in. Reused across rolls; recreated after a session error.
  useEffect(() => {
    if (!available || status !== 'authed' || sessionId || ensuringRef.current) return;
    ensuringRef.current = true;
    sessionMutation
      .mutateAsync(undefined)
      .then((s) => setSessionId(s.id))
      .catch(() => {
        /* surfaced on the first roll attempt */
      })
      .finally(() => {
        ensuringRef.current = false;
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [available, status, sessionId]);

  // Any change to the bet inputs retires the pending idempotency key so a
  // different bet never reuses a previous bet's key (which would replay the
  // stored settlement). While a bet is in flight the inputs are frozen and the
  // key is preserved, so an ambiguous-failure retry reuses the same key and can
  // never double-debit.
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
    setTarget(Math.min(maxTarget, Math.max(minTarget, Math.round(next))));
  }
  function changeDirection(next: string) {
    if (submittingRef.current) return;
    resetIdem();
    setDirection(next === 'over' ? 'over' : 'under');
  }

  const winChancePct = direction === 'over' ? 100 - target : target;
  const multiplier = winChancePct > 0 ? (100 / winChancePct) * (1 - edge) : 0;
  const payoutPreview = Math.round(amount * multiplier);

  const stakeValid = Number.isFinite(amount) && amount >= minBet && amount <= maxBet;
  const insufficient = balanceQuery.isSuccess && amount > balance;
  const canRoll =
    available && status === 'authed' && stakeValid && !insufficient && !betMutation.isPending;

  async function handleRoll() {
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
      setNotice({
        type: 'error',
        text: `Enter a stake between ${formatBDT(minBet)} and ${formatBDT(maxBet)}.`,
      });
      return;
    }
    submittingRef.current = true;
    try {
      if (!idemRef.current) idemRef.current = newNativeIdempotencyKey('dice');
      let sid = sessionId;
      if (!sid) {
        const s = await sessionMutation.mutateAsync(undefined);
        sid = s.id;
        setSessionId(sid);
      }
      const res = await betMutation.mutateAsync({
        sessionId: sid,
        target,
        direction,
        betAmount: amount,
        idempotencyKey: idemRef.current,
      });
      idemRef.current = null;
      setLast(res);
      setHistory((prev) => [{ label: res.result.toFixed(2), win: res.win }, ...prev].slice(0, 12));
      setNotice({
        type: res.win ? 'success' : 'error',
        text: res.win
          ? `Rolled ${res.result.toFixed(2)}. You won ${formatBDT(res.payout)} at ${fmtMult(res.multiplier)}.`
          : `Rolled ${res.result.toFixed(2)}. No win this time.`,
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

  return (
    <Screen header={<GameTopBar title="Dice" subtitle="Pasha Originals" balance={balance} />} contentClassName="px-4 pt-3 gap-4">
      {!view ? (
        <LoadingBoard />
      ) : !available ? (
        <UnavailableBoard />
      ) : (
        <>
          {/* Board */}
          <Card tone="dark" className="overflow-hidden">
            <View className="items-center gap-2 py-2">
              <Text className="text-[11px] font-black uppercase tracking-[3px] text-white/45">
                {last ? 'Last Roll' : 'Roll The Dice'}
              </Text>
              <Text className="text-5xl font-black" style={{ color: last ? (last.win ? colors.neon : colors.hot) : '#ffffff' }}>
                {last ? last.result.toFixed(2) : '--'}
              </Text>
              {last ? (
                <View
                  className={cn(
                    'flex-row items-center gap-1.5 rounded-pill border px-3 py-1',
                    last.win ? 'border-newg/40 bg-newg/10' : 'border-hot/40 bg-hot/10',
                  )}
                >
                  <Icon
                    name={last.win ? 'trophy' : 'close-circle'}
                    size={13}
                    color={last.win ? colors.newg : colors.hot}
                  />
                  <Text className={cn('text-[11px] font-black uppercase tracking-wider', last.win ? 'text-newg' : 'text-hot')}>
                    {last.win ? `Win +${formatBDT(last.payout)}` : 'No win'}
                  </Text>
                </View>
              ) : (
                <Text className="text-[11px] font-bold uppercase tracking-widest text-white/40">
                  Result 0.00 - 99.99
                </Text>
              )}
            </View>

            {/* Target bar */}
            <View className="mt-2 gap-2">
              <View className="flex-row items-center justify-between">
                <Text className="text-xs font-bold text-white/70">
                  Roll {direction === 'under' ? 'Under' : 'Over'}
                </Text>
                <Text className="text-sm font-black" style={{ color: colors.goldlite }}>
                  {target}
                </Text>
              </View>
              <View className="h-3 flex-row overflow-hidden rounded-full bg-white/10">
                {direction === 'under' ? (
                  <View style={{ width: `${target}%` }} className="rounded-full bg-newg/70" />
                ) : (
                  <>
                    <View style={{ width: `${target}%` }} />
                    <View style={{ width: `${100 - target}%` }} className="rounded-full bg-newg/70" />
                  </>
                )}
              </View>
              <View className="flex-row justify-between">
                <Text className="text-[10px] font-bold text-white/40">0</Text>
                <Text className="text-[10px] font-bold text-white/40">100</Text>
              </View>
            </View>
          </Card>

          {/* Prediction */}
          <View className="gap-2">
            <Text className="text-xs font-bold uppercase tracking-wider text-ink-mute">Prediction</Text>
            <ChipToggle
              options={[
                { key: 'under', label: 'Roll Under' },
                { key: 'over', label: 'Roll Over' },
              ]}
              value={direction}
              onChange={changeDirection}
            />
          </View>

          {/* Target stepper */}
          <Card>
            <View className="flex-row items-center justify-between">
              <Text className="text-xs font-bold uppercase tracking-wider text-ink-mute">Target</Text>
              <Text className="text-[11px] text-ink-mute">
                {minTarget} - {maxTarget}
              </Text>
            </View>
            <View className="mt-2.5 flex-row items-center gap-2">
              <StepButton icon="remove" onPress={() => changeTarget(target - 1)} />
              <View className="flex-1 flex-row items-center justify-center rounded-xl border border-divider bg-surface py-3">
                <Text className="text-lg font-black text-ink">{target}</Text>
              </View>
              <StepButton icon="add" onPress={() => changeTarget(target + 1)} />
            </View>
          </Card>

          <StatRow
            items={[
              { label: 'Multiplier', value: fmtMult(multiplier), valueTone: 'gold', icon: 'trending-up' },
              { label: 'Win Chance', value: `${winChancePct.toFixed(1)}%`, valueTone: 'green', icon: 'pie-chart' },
              { label: 'Payout', value: formatBDT(payoutPreview), valueTone: 'blue', icon: 'cash' },
            ]}
          />

          <BetControls
            amount={amount}
            onChange={changeAmount}
            minBet={minBet}
            maxBet={maxBet}
            balance={balance}
          />

          <RollButton
            label={betMutation.isPending ? 'Rolling...' : 'Roll Dice'}
            disabled={!canRoll}
            pending={betMutation.isPending}
            onPress={handleRoll}
          />

          <Notices notice={notice} insufficient={insufficient} />

          <ResultsStrip items={history} />
        </>
      )}
    </Screen>
  );
}

// ---------- Shared pieces ----------

function StepButton({ icon, onPress }: { icon: 'add' | 'remove'; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      className="h-11 w-11 items-center justify-center rounded-xl border border-divider bg-surface active:opacity-80"
    >
      <Icon name={icon} size={18} color={colors.ink} />
    </Pressable>
  );
}

function RollButton({
  label,
  disabled,
  pending,
  onPress,
}: {
  label: string;
  disabled: boolean;
  pending: boolean;
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
      <Icon name={pending ? 'hourglass' : 'dice'} size={20} color={colors.ink} />
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
        <StepButton icon="remove" onPress={() => onChange(amount - step)} />
        <View className="flex-1 flex-row items-center justify-center rounded-xl border border-divider bg-surface py-3">
          <Text className="text-lg font-black text-ink">{formatBDT(amount)}</Text>
        </View>
        <StepButton icon="add" onPress={() => onChange(amount + step)} />
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
      <Text className="text-xs font-bold uppercase tracking-wider text-ink-mute">Recent Rolls</Text>
      {items.length === 0 ? (
        <Text className="text-[11px] text-ink-mute">No rolls yet this session.</Text>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {items.map((r, i) => (
            <View
              key={i}
              className={cn(
                'h-10 min-w-[54px] items-center justify-center rounded-lg border px-2.5',
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
