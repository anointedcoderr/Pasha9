// Built by Anointed Coder.
//
// Pasha Keno, wired to LIVE play and REAL money. The premium 1..80 board is
// kept; the flow is now real: the player taps up to maxPicks numbers within the
// live config, and Play Keno settles one round through the real bet endpoint
// (POST /api/native-games/keno/bet). The drawn balls, the matches, the payout
// and the running balance all come from the server response.
//
// Real money is wagered here, so the play is guarded three ways: a synchronous
// in-flight ref against a double-tap, a stable idempotency key reused on retry
// so the server never double-debits, and a disabled Play button while the pick
// count or stake is out of range (the server enforces the same).

import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { Icon } from '@/components/ui/Icon';
import { useRouter } from 'expo-router';
import { Screen, Card, GhostButton } from '@/components/ui';
import { formatBDT } from '@/lib/format';
import { colors } from '@/lib/theme';
import { cn } from '@/lib/cn';
import { ApiError } from '@/lib/api/client';
import { useBalance, useNativeGame, useCreateNativeSession, useKenoBet } from '@/lib/api/hooks';
import { newNativeIdempotencyKey, type KenoConfig, type KenoBetResult } from '@/lib/api/native-games';
import { useAuth } from '@/store/auth';

interface Notice {
  type: 'success' | 'error';
  text: string;
}
interface HistoryItem {
  label: string;
  win: boolean;
}

const SESSION_ERROR_CODES = new Set(['SESSION_NOT_FOUND', 'SESSION_INACTIVE', 'SESSION_NOT_OWNED']);

export default function KenoScreen() {
  const { width } = useWindowDimensions();
  const { status } = useAuth();

  const gameQuery = useNativeGame('keno');
  const balanceQuery = useBalance();
  const sessionMutation = useCreateNativeSession('keno');
  const betMutation = useKenoBet();

  const view = gameQuery.data;
  const game = view?.game;
  const available = !!view && view.enabled && !!game?.isActive;
  const minBet = game?.minBet ?? 10;
  const maxBet = game?.maxBet ?? 5_000;
  const cfg = (game?.config ?? {}) as Partial<KenoConfig>;
  const poolSize = Number.isFinite(cfg.poolSize) ? Number(cfg.poolSize) : 80;
  const minPicks = Number.isFinite(cfg.minPicks) ? Number(cfg.minPicks) : 1;
  const maxPicks = Number.isFinite(cfg.maxPicks) ? Number(cfg.maxPicks) : 10;

  const balance = balanceQuery.data?.balance ?? 0;

  const [amount, setAmount] = useState(minBet);
  const [picks, setPicks] = useState<number[]>([]);
  const [last, setLast] = useState<KenoBetResult | null>(null);
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
  function togglePick(n: number) {
    if (submittingRef.current) return;
    resetIdem();
    setLast(null);
    setNotice(null);
    setPicks((prev) => {
      if (prev.includes(n)) return prev.filter((p) => p !== n);
      if (prev.length >= maxPicks) return prev;
      return [...prev, n];
    });
  }
  function quickPick() {
    if (submittingRef.current) return;
    resetIdem();
    setLast(null);
    setNotice(null);
    const pool = Array.from({ length: poolSize }, (_, i) => i + 1);
    for (let i = pool.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    setPicks(pool.slice(0, maxPicks).sort((a, b) => a - b));
  }
  function clearPicks() {
    if (submittingRef.current) return;
    resetIdem();
    setLast(null);
    setNotice(null);
    setPicks([]);
  }

  const stakeValid = Number.isFinite(amount) && amount >= minBet && amount <= maxBet;
  const picksValid = picks.length >= minPicks && picks.length <= maxPicks;
  const insufficient = balanceQuery.isSuccess && amount > balance;
  const canPlay =
    available && status === 'authed' && stakeValid && picksValid && !insufficient && !betMutation.isPending;

  async function handlePlay() {
    if (submittingRef.current) return;
    if (!available) {
      setNotice({ type: 'error', text: 'This game is unavailable right now. এই গেমটি এখন বন্ধ আছে।' });
      return;
    }
    if (status !== 'authed') {
      setNotice({ type: 'error', text: 'Please sign in to play. খেলতে সাইন ইন করুন।' });
      return;
    }
    if (!picksValid) {
      setNotice({ type: 'error', text: `Pick between ${minPicks} and ${maxPicks} numbers.` });
      return;
    }
    if (!stakeValid) {
      setNotice({ type: 'error', text: `Enter a stake between ${formatBDT(minBet)} and ${formatBDT(maxBet)}.` });
      return;
    }
    submittingRef.current = true;
    try {
      if (!idemRef.current) idemRef.current = newNativeIdempotencyKey('keno');
      let sid = sessionId;
      if (!sid) {
        const s = await sessionMutation.mutateAsync(undefined);
        sid = s.id;
        setSessionId(sid);
      }
      const res = await betMutation.mutateAsync({
        sessionId: sid,
        picks,
        betAmount: amount,
        idempotencyKey: idemRef.current,
      });
      idemRef.current = null;
      setLast(res);
      setHistory((prev) => [{ label: `${res.matchCount} hit${res.matchCount === 1 ? '' : 's'}`, win: res.win }, ...prev].slice(0, 10));
      setNotice({
        type: res.win ? 'success' : 'error',
        text: res.win
          ? `${res.matchCount} matches. You won ${formatBDT(res.payout)} at ${res.multiplier.toFixed(2)}x.`
          : `${res.matchCount} matches. No win this time.`,
      });
    } catch (err) {
      if (err instanceof ApiError && SESSION_ERROR_CODES.has(err.code)) {
        setSessionId(null);
        idemRef.current = null;
      }
      const text =
        err instanceof ApiError && err.message !== err.code
          ? err.message
          : 'Could not play. Check your connection and try again.';
      setNotice({ type: 'error', text });
    } finally {
      submittingRef.current = false;
    }
  }

  const GAP = 6;
  const boardW = Math.min(width - 32, 460) - 32;
  const cols = 8;
  const cell = (boardW - GAP * (cols - 1)) / cols;
  const drawSet = new Set(last?.draw ?? []);
  const pickSet = new Set(picks);

  return (
    <Screen header={<GameTopBar title="Keno" subtitle="Pasha Originals" balance={balance} />} contentClassName="px-4 pt-3 gap-4">
      {!view ? (
        <LoadingBoard />
      ) : !available ? (
        <UnavailableBoard />
      ) : (
        <>
          <Card tone="dark" className="items-center">
            <View className="mb-3 w-full flex-row items-center justify-between">
              <Text className="text-xs font-bold text-white/70">
                {picks.length}/{maxPicks} picks
              </Text>
              {last ? (
                <View className="flex-row items-center gap-1.5">
                  <View className="h-2.5 w-2.5 rounded-full bg-newg" />
                  <Text className="text-xs font-bold text-white/70">{last.matchCount} hits</Text>
                </View>
              ) : (
                <Text className="text-xs font-bold text-white/50">Tap up to {maxPicks} numbers</Text>
              )}
            </View>

            <View className="flex-row flex-wrap" style={{ width: boardW, gap: GAP }}>
              {Array.from({ length: poolSize }, (_, idx) => {
                const n = idx + 1;
                const picked = pickSet.has(n);
                const drawn = drawSet.has(n);
                const hit = picked && drawn;
                return (
                  <Pressable
                    key={n}
                    onPress={() => togglePick(n)}
                    style={{ width: cell, height: cell }}
                    className={cn(
                      'items-center justify-center rounded-lg border active:opacity-80',
                      hit
                        ? 'border-newg bg-newg/25'
                        : picked
                          ? 'border-gold-500 bg-gold-500/20'
                          : drawn
                            ? 'border-white/25 bg-white/10'
                            : 'border-white/10 bg-white/5',
                    )}
                  >
                    <Text
                      className="text-xs font-black"
                      style={{
                        color: hit ? colors.neon : picked ? colors.goldlite : drawn ? '#ffffff' : 'rgba(255,255,255,0.5)',
                      }}
                    >
                      {n}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </Card>

          {/* Live result readout */}
          <View className="flex-row gap-3">
            <Card className="flex-1 items-center">
              <Text className="text-[10px] font-black uppercase tracking-widest text-ink-mute">Matches</Text>
              <Text className="mt-1 text-2xl font-black text-ink">{last ? last.matchCount : '--'}</Text>
            </Card>
            <Card className="flex-1 items-center">
              <Text className="text-[10px] font-black uppercase tracking-widest text-ink-mute">Multiplier</Text>
              <Text className="mt-1 text-2xl font-black" style={{ color: colors.gold700 }}>
                {last ? `${last.multiplier.toFixed(2)}x` : '--'}
              </Text>
            </Card>
            <Card className="flex-1 items-center">
              <Text className="text-[10px] font-black uppercase tracking-widest text-ink-mute">Payout</Text>
              <Text
                className="mt-1 text-2xl font-black"
                style={{ color: last?.win ? colors.newg : colors.ink }}
              >
                {last ? formatBDT(last.payout) : '--'}
              </Text>
            </Card>
          </View>

          <View className="flex-row gap-3">
            <View className="flex-1">
              <GhostButton label="Quick Pick" icon="shuffle" fullWidth onPress={quickPick} />
            </View>
            <View className="flex-1">
              <GhostButton label="Clear" icon="close" fullWidth onPress={clearPicks} />
            </View>
          </View>

          <BetControls amount={amount} onChange={changeAmount} minBet={minBet} maxBet={maxBet} balance={balance} />

          <PlayButton
            label={betMutation.isPending ? 'Playing...' : 'Play Keno'}
            pending={betMutation.isPending}
            disabled={!canPlay}
            onPress={handlePlay}
          />

          <Notices notice={notice} insufficient={insufficient} />

          <ResultsStrip items={history} />
        </>
      )}
    </Screen>
  );
}

// ---------- Pieces ----------

function PlayButton({
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
      <Icon name={pending ? 'hourglass' : 'ticket'} size={20} color={colors.ink} />
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
                'h-10 min-w-[64px] items-center justify-center rounded-lg border px-2.5',
                r.win ? 'border-newg/40 bg-newg/10' : 'border-hot/40 bg-hot/10',
              )}
            >
              <Text className="text-xs font-black" style={{ color: r.win ? colors.newg : colors.hot }}>
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
