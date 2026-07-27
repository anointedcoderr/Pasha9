// Built by Anointed Coder.
//
// Lotto, wired to the live backend and rebuilt to mirror the website
// (apps/web/components/site/LottoBabuLayout.tsx). Pasha9 lotto tickets are
// ACCRUED from approved deposits (ticketsPerBlock per blockAmount), not bought
// with a number pick, so there is no buy-ticket endpoint. The screen shows, in
// the site's order: the banner carousel, the Winner-of-the-Day prize cards +
// Special / Consolation number grids (from the latest published result), the
// next-draw countdown, the lotto wallet with a real transfer action, the
// deposit-accrual progress, per-player stats, a past-results browser, a rules
// accordion, and quick links to My Tickets / My Winnings. Copy is EN/BN.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, RefreshControl, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen, Gradient, Badge, PrimaryButton, EmptyState, HeroCarousel, ChipToggle } from '@/components/ui';
import { Icon } from '@/components/ui/Icon';
import { AppHeader } from '@/components/AppHeader';
import {
  useLottoMe,
  useTransferLotto,
  useLottoResults,
  useLottoBanners,
  MIN_LOTTO_TRANSFER,
  type LottoMe,
  type LottoResult,
} from '@/lib/api/lotto';
import { absoluteMediaUrl } from '@/lib/api/home';
import { resolveHref } from '@/lib/nav';
import { useAppLang } from '@/lib/lang';
import { ApiError } from '@/lib/api/client';
import { formatBDT } from '@/lib/format';
import { gradients, colors } from '@/lib/theme';
import type { BannerAccent, HeroBanner } from '@/lib/mock/banners';

function pad(n: number) {
  return n.toString().padStart(2, '0');
}

function winnerDate(iso: string | null): string {
  const d = iso ? new Date(iso) : new Date();
  return `${d.getDate()}/${d.getMonth() + 1}`;
}

function isoDate(iso: string | null): string {
  if (!iso) return '----';
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// Live countdown to an ISO draw time. Returns { d, h, m, s, done, none }.
function useCountdown(iso: string | null) {
  const target = useMemo(() => (iso ? new Date(iso).getTime() : null), [iso]);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (target == null) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [target]);

  if (target == null) return { d: 0, h: 0, m: 0, s: 0, done: true, none: true };
  const diff = Math.max(0, target - now);
  const s = Math.floor(diff / 1000) % 60;
  const m = Math.floor(diff / 60000) % 60;
  const h = Math.floor(diff / 3600000) % 24;
  const d = Math.floor(diff / 86400000);
  return { d, h, m, s, done: diff === 0, none: false };
}

export default function LottoScreen() {
  const router = useRouter();
  const { lang } = useAppLang();
  const bn = lang === 'bn';

  const meQuery = useLottoMe();
  const resultsQuery = useLottoResults();
  const bannersQuery = useLottoBanners();
  const transfer = useTransferLotto();
  const me = meQuery.data;

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([meQuery.refetch(), resultsQuery.refetch(), bannersQuery.refetch()]);
    } finally {
      setRefreshing(false);
    }
  }, [meQuery, resultsQuery, bannersQuery]);

  const transferInFlight = useRef(false);
  const onTransfer = useCallback(() => {
    if (!me) return;
    const amount = Math.floor(me.lottoBalance);
    if (amount < MIN_LOTTO_TRANSFER) {
      Alert.alert(
        bn ? 'ট্রান্সফারের কিছু নেই' : 'Nothing to transfer',
        bn
          ? `মূল ওয়ালেটে নিতে অন্তত ${formatBDT(MIN_LOTTO_TRANSFER)} লটো ব্যালেন্স দরকার।`
          : `You need at least ${formatBDT(MIN_LOTTO_TRANSFER)} in your lotto balance to move it to your main wallet.`,
      );
      return;
    }
    Alert.alert(
      bn ? 'মূল ওয়ালেটে ট্রান্সফার' : 'Transfer to main wallet',
      bn
        ? `লটো ব্যালেন্স থেকে ${formatBDT(amount)} মূল ওয়ালেটে নেবেন? এরপর Wallet থেকে উইথড্র করতে পারবেন।`
        : `Move ${formatBDT(amount)} from your lotto balance to your main wallet? You can then withdraw it from Wallet.`,
      [
        { text: bn ? 'বাতিল' : 'Cancel', style: 'cancel' },
        {
          text: bn ? 'ট্রান্সফার' : 'Transfer',
          onPress: () => {
            if (transferInFlight.current || transfer.isPending) return;
            transferInFlight.current = true;
            transfer.mutate(amount, {
              onSuccess: (res) => {
                Alert.alert(bn ? 'ট্রান্সফার সম্পন্ন' : 'Transfer complete', bn ? `${formatBDT(res.amount)} এখন মূল ওয়ালেটে।` : `${formatBDT(res.amount)} is now in your main wallet.`);
              },
              onError: (err) => {
                const msg = err instanceof ApiError ? err.message : bn ? 'ট্রান্সফার ব্যর্থ হয়েছে।' : 'Transfer failed. Please try again.';
                Alert.alert(bn ? 'ট্রান্সফার ব্যর্থ' : 'Transfer failed', msg);
              },
              onSettled: () => {
                transferInFlight.current = false;
              },
            });
          },
        },
      ],
    );
  }, [me, transfer, bn]);

  const results = resultsQuery.data ?? [];
  const latest = results[0] ?? null;

  const banners = bannersQuery.data ?? [];
  const heroBanners: HeroBanner[] = useMemo(() => {
    const accents: BannerAccent[] = ['gold', 'neon', 'royal', 'hot', 'blue'];
    return banners
      .map((b, i) => {
        const uri = absoluteMediaUrl(b.imageUrl ?? b.posterUrl);
        if (!uri) return null;
        return {
          id: b.id,
          imageUrl: uri,
          title: (bn ? b.titleBn ?? b.title : b.title) || 'Lotto',
          subtitle: '',
          ctaLabel: bn ? 'খেলুন' : 'Play',
          accent: accents[i % accents.length],
        } as HeroBanner;
      })
      .filter((b): b is HeroBanner => b !== null);
  }, [banners, bn]);

  if (meQuery.isLoading) {
    return (
      <Screen header={<AppHeader />} contentClassName="px-4 pt-3 gap-4">
        <SkeletonCard />
        <SkeletonCard />
      </Screen>
    );
  }

  if (meQuery.isError || !me) {
    const msg = meQuery.error instanceof ApiError ? meQuery.error.message : bn ? 'লটো লোড করা যায়নি।' : 'We could not load the lotto right now.';
    return (
      <Screen header={<AppHeader />} contentClassName="px-4 pt-3 gap-4">
        <EmptyState
          icon="alert-circle-outline"
          title={bn ? 'লটো অনুপলব্ধ' : 'Lotto unavailable'}
          message={msg}
          actionLabel={bn ? 'আবার চেষ্টা করুন' : 'Try again'}
          onAction={() => meQuery.refetch()}
        />
      </Screen>
    );
  }

  return (
    <Screen
      header={<AppHeader />}
      contentClassName="px-4 pt-3 gap-4"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.gold600} />}
    >
      {heroBanners.length > 0 ? (
        <HeroCarousel
          banners={heroBanners}
          onPress={(hb) => {
            const orig = banners.find((x) => x.id === hb.id);
            if (orig?.ctaUrl) router.push(resolveHref(orig.ctaUrl, '/lotto') as never);
          }}
        />
      ) : null}

      {/* Winner of the Day */}
      <WinnerBlock
        bn={bn}
        result={latest}
        heading={latest ? (bn ? `দিনের বিজয়ী ${winnerDate(latest.publishedAt)}` : `Winner of the Day ${winnerDate(latest.publishedAt)}`) : bn ? 'প্রথম ড্রয়ের অপেক্ষায়' : 'Awaiting first draw'}
      />

      <DrawCard me={me} bn={bn} />
      <LottoWalletCard bn={bn} balance={me.lottoBalance} onTransfer={onTransfer} transferring={transfer.isPending} />
      <ProgressCard me={me} bn={bn} />
      <StatsGrid me={me} bn={bn} />

      {/* Past results browser */}
      {results.length > 0 ? <PastResults bn={bn} results={results} /> : null}

      {/* Rules / FAQ */}
      <RulesAccordion bn={bn} me={me} />

      {/* Quick links */}
      <View className="flex-row gap-3">
        <LinkTile icon="receipt-outline" label={bn ? 'আমার টিকেট' : 'My Tickets'} hint={bn ? `${me.summary.activeTicketsCount} অ্যাক্টিভ` : `${me.summary.activeTicketsCount} active`} onPress={() => router.push('/lotto/my-tickets')} />
        <LinkTile icon="trophy-outline" label={bn ? 'আমার জয়' : 'My Winnings'} hint={me.summary.winningCount > 0 ? (bn ? `${me.summary.winningCount} জয়` : `${me.summary.winningCount} wins`) : bn ? 'পুরস্কার' : 'Prizes'} onPress={() => router.push('/lotto/my-winnings')} />
      </View>
    </Screen>
  );
}

// ---------------------------------------------------------------------------
// Winner-of-the-Day: 1st/2nd/3rd prize cards + Special / Consolation grids
// ---------------------------------------------------------------------------

function PrizeCard({ label, number, tone }: { label: string; number: string | null; tone: 'gold' | 'amber' | 'sand' }) {
  const grad = tone === 'gold' ? ['#F5B400', '#D89E00'] : tone === 'amber' ? ['#F5C649', '#E0A922'] : ['#F9DD9B', '#E7C269'];
  return (
    <View style={{ flex: 1 }} className="overflow-hidden rounded-xl border border-divider bg-paper">
      <View className="relative px-1.5 py-2">
        <Gradient colors={grad} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} />
        <Text className="text-center text-[11px] font-bold uppercase tracking-wider" style={{ color: '#3A1F00' }} numberOfLines={1}>
          {label}
        </Text>
      </View>
      <View className="items-center justify-center px-1 py-4">
        <Text className="text-2xl font-black text-ink" style={{ fontVariant: ['tabular-nums'] }}>
          {number ?? '----'}
        </Text>
      </View>
    </View>
  );
}

function NumberGrid({ title, numbers, bn }: { title: string; numbers: string[]; bn: boolean }) {
  return (
    <View className="overflow-hidden rounded-xl border border-divider bg-paper">
      <View className="px-3 py-2" style={{ backgroundColor: colors.navInk }}>
        <Text className="text-center text-xs font-bold uppercase tracking-[2px] text-white">{title}</Text>
      </View>
      {numbers.length === 0 ? (
        <Text className="px-3 py-5 text-center text-xs text-ink-mute">{bn ? 'এখনও কোনো নম্বর নেই।' : 'No numbers yet.'}</Text>
      ) : (
        <View className="flex-row flex-wrap px-2 py-3">
          {numbers.slice(0, 10).map((n, i) => (
            <View key={`${n}-${i}`} style={{ width: '20%' }} className="items-center py-1">
              <Text className="text-base font-black text-ink" style={{ fontVariant: ['tabular-nums'] }}>
                {n}
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

function WinnerBlock({ bn, result, heading }: { bn: boolean; result: LottoResult | null; heading: string }) {
  return (
    <View className="gap-2">
      <Text className="text-lg font-extrabold text-ink">{heading}</Text>
      <View className="flex-row gap-2">
        <PrizeCard label={bn ? '১ম পুরস্কার' : '1st Prize'} number={result?.winningNumber || null} tone="gold" />
        <PrizeCard label={bn ? '২য় পুরস্কার' : '2nd Prize'} number={result?.second ?? null} tone="amber" />
        <PrizeCard label={bn ? '৩য় পুরস্কার' : '3rd Prize'} number={result?.third ?? null} tone="sand" />
      </View>
      <NumberGrid title={bn ? 'বিশেষ' : 'Special'} numbers={result?.specials ?? []} bn={bn} />
      <NumberGrid title={bn ? 'সান্ত্বনা' : 'Consolation'} numbers={result?.consolations ?? []} bn={bn} />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Past results browser (date picker chips -> selected result block)
// ---------------------------------------------------------------------------

function PastResults({ bn, results }: { bn: boolean; results: LottoResult[] }) {
  const [selectedId, setSelectedId] = useState<string>(results[0]?.id ?? '');
  const selected = useMemo(() => results.find((r) => r.id === selectedId) ?? results[0] ?? null, [results, selectedId]);

  return (
    <View className="gap-2 rounded-2xl border border-divider bg-paper p-4 shadow-sm shadow-black/5">
      <Text className="text-base font-extrabold text-ink">{bn ? 'অতীত ফলাফল' : 'Past Results'}</Text>
      <ChipToggle
        scroll
        options={results.map((r) => ({ key: r.id, label: isoDate(r.publishedAt) }))}
        value={selectedId || results[0]?.id}
        onChange={setSelectedId}
      />
      {selected ? (
        <View className="mt-1">
          <WinnerBlock
            bn={bn}
            result={selected}
            heading={selected.drawName ? selected.drawName : bn ? `ফলাফল ${winnerDate(selected.publishedAt)}` : `Result ${winnerDate(selected.publishedAt)}`}
          />
        </View>
      ) : null}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Rules / FAQ accordion
// ---------------------------------------------------------------------------

function RulesAccordion({ bn, me }: { bn: boolean; me: LottoMe }) {
  const { ticketsPerBlock, blockAmount, drawTimeLabel } = me.rules;
  const items = [
    {
      q: bn ? 'টিকিট কীভাবে পাব?' : 'How do I get tickets?',
      a: bn
        ? `প্রতি ${formatBDT(blockAmount)} অনুমোদিত ডিপোজিটে স্বয়ংক্রিয়ভাবে ${ticketsPerBlock}টি টিকিট পাবেন। আলাদা করে কিনতে হয় না।`
        : `Every ${formatBDT(blockAmount)} of approved deposits automatically earns you ${ticketsPerBlock} ticket(s). No separate purchase needed.`,
    },
    {
      q: bn ? 'ড্র কখন হয়?' : 'When is the draw?',
      a: bn ? `ড্র হয় ${drawTimeLabel}। উপরের কাউন্টডাউনে পরবর্তী ড্রয়ের সময় দেখা যায়।` : `Draws run ${drawTimeLabel}. The countdown above shows the next draw time.`,
    },
    {
      q: bn ? 'জিতলে কী হয়?' : 'What happens if I win?',
      a: bn
        ? 'জেতা পুরস্কার আপনার লটো ব্যালেন্সে যোগ হয়। সেখান থেকে মূল ওয়ালেটে ট্রান্সফার করে উইথড্র করতে পারবেন।'
        : 'Winnings land in your lotto balance. Transfer them to your main wallet to withdraw.',
    },
  ];
  return (
    <View className="overflow-hidden rounded-2xl border border-divider bg-paper shadow-sm shadow-black/5">
      <View className="border-b border-divider px-4 py-3">
        <Text className="text-base font-extrabold text-ink">{bn ? 'নিয়ম ও প্রশ্নোত্তর' : 'Rules and FAQ'}</Text>
      </View>
      {items.map((it, i) => (
        <AccordionRow key={it.q} q={it.q} a={it.a} first={i === 0} />
      ))}
    </View>
  );
}

function AccordionRow({ q, a, first }: { q: string; a: string; first: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <View className={first ? '' : 'border-t border-divider'}>
      <Pressable
        onPress={() => setOpen((v) => !v)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        className="flex-row items-center justify-between px-4 py-3 active:bg-surface"
      >
        <Text className="flex-1 pr-2 text-sm font-bold text-ink">{q}</Text>
        <Icon name={open ? 'chevron-up' : 'chevron-down'} size={16} color={colors.inkMute} />
      </Pressable>
      {open ? <Text className="px-4 pb-3 text-xs leading-5 text-ink-mute">{a}</Text> : null}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Existing cards (kept, localized)
// ---------------------------------------------------------------------------

function DrawCard({ me, bn }: { me: LottoMe; bn: boolean }) {
  const time = useCountdown(me.nextDrawAt);
  return (
    <View className="relative overflow-hidden rounded-2xl border border-gold-600/20">
      <Gradient colors={gradients.darkPanel} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} radius={16} />
      <View className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-gold-500/15" />

      <View className="relative p-4">
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-2">
            <View className="h-2 w-2 rounded-full bg-neon" />
            <Text className="text-xs font-black uppercase tracking-widest text-white/70">{bn ? 'পরবর্তী লটো ড্র' : 'Next Lotto Draw'}</Text>
          </View>
          <Badge label={me.rules.enabled ? (bn ? 'লাইভ' : 'LIVE') : bn ? 'বন্ধ' : 'PAUSED'} variant={me.rules.enabled ? 'new' : 'neutral'} />
        </View>

        <Text className="mt-3 text-[10px] font-bold uppercase tracking-widest text-white/50">{me.rules.drawTimeLabel}</Text>

        {time.none ? (
          <Text className="mt-2 text-lg font-black text-white/80">{bn ? 'এখনও ড্র নির্ধারিত হয়নি' : 'No draw scheduled yet'}</Text>
        ) : (
          <View className="mt-3 flex-row gap-2">
            {[
              { label: bn ? 'দিন' : 'Days', value: time.d },
              { label: bn ? 'ঘণ্টা' : 'Hrs', value: time.h },
              { label: bn ? 'মিনিট' : 'Min', value: time.m },
              { label: bn ? 'সেকেন্ড' : 'Sec', value: time.s },
            ].map((u) => (
              <View key={u.label} className="flex-1 items-center rounded-xl border border-white/10 bg-white/5 py-2">
                <Text className="text-xl font-black" style={{ color: colors.dinkHi }}>
                  {pad(u.value)}
                </Text>
                <Text className="text-[9px] font-bold uppercase tracking-widest text-white/45">{u.label}</Text>
              </View>
            ))}
          </View>
        )}
      </View>
    </View>
  );
}

function LottoWalletCard({ bn, balance, onTransfer, transferring }: { bn: boolean; balance: number; onTransfer: () => void; transferring: boolean }) {
  const canTransfer = Math.floor(balance) >= MIN_LOTTO_TRANSFER;
  return (
    <View className="relative overflow-hidden rounded-2xl border border-gold-600/20">
      <Gradient colors={gradients.darkCard} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} radius={16} />
      <View className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-gold-500/15" />
      <View className="relative p-4">
        <Text className="text-[10px] font-bold uppercase tracking-widest text-white/55">{bn ? 'লটো ব্যালেন্স' : 'Lotto balance'}</Text>
        <Text className="mt-1 text-3xl font-black" style={{ color: colors.gold300 }}>
          {formatBDT(balance)}
        </Text>
        <Text className="mt-0.5 text-[11px] text-white/45">{bn ? 'জেতা পুরস্কার এখানে আসে। উইথড্র করতে মূল ওয়ালেটে নিন।' : 'Prize winnings land here. Move them to your main wallet to withdraw.'}</Text>
        <PrimaryButton
          label={transferring ? (bn ? 'ট্রান্সফার হচ্ছে...' : 'Transferring...') : bn ? 'মূল ওয়ালেটে ট্রান্সফার' : 'Transfer to main wallet'}
          icon="swap-horizontal"
          fullWidth
          className="mt-3"
          loading={transferring}
          disabled={!canTransfer || transferring}
          onPress={onTransfer}
        />
        {!canTransfer ? <Text className="mt-2 text-center text-[10px] text-white/40">{bn ? `সর্বনিম্ন ট্রান্সফার ${formatBDT(MIN_LOTTO_TRANSFER)}` : `Minimum transfer is ${formatBDT(MIN_LOTTO_TRANSFER)}`}</Text> : null}
      </View>
    </View>
  );
}

function ProgressCard({ me, bn }: { me: LottoMe; bn: boolean }) {
  const { earnedTickets, toNextBlock, blockAmount, ticketsPerBlock, totalApprovedDeposits } = me.progress;
  const filled = blockAmount > 0 ? Math.max(0, Math.min(1, (blockAmount - toNextBlock) / blockAmount)) : 0;
  return (
    <View className="rounded-2xl border border-divider bg-paper p-4 shadow-sm shadow-black/5">
      <View className="mb-1 flex-row items-center justify-between">
        <Text className="text-base font-extrabold text-ink">{bn ? 'টিকিট অর্জন' : 'Earn tickets'}</Text>
        <View className="flex-row items-center gap-1.5">
          <Icon name="ticket" size={14} color={colors.gold700} />
          <Text className="text-sm font-black text-gold-700">{earnedTickets}</Text>
        </View>
      </View>
      <Text className="text-xs text-ink-mute">
        {bn ? `প্রতি ${formatBDT(blockAmount)} ডিপোজিটে স্বয়ংক্রিয়ভাবে ${ticketsPerBlock}টি টিকিট।` : `Every ${formatBDT(blockAmount)} deposited earns you ${ticketsPerBlock} ${ticketsPerBlock === 1 ? 'ticket' : 'tickets'} automatically.`}
      </Text>

      <View className="mt-3 h-2.5 overflow-hidden rounded-full bg-surfaceAlt">
        <View className="h-full rounded-full bg-gold-500" style={{ width: `${filled * 100}%` }} />
      </View>
      <View className="mt-1.5 flex-row items-center justify-between">
        <Text className="text-[11px] text-ink-mute">{bn ? `${formatBDT(totalApprovedDeposits)} ডিপোজিট` : `${formatBDT(totalApprovedDeposits)} deposited`}</Text>
        <Text className="text-[11px] font-bold text-ink-soft">
          {bn ? `পরের টিকিটে ${formatBDT(toNextBlock)}` : `${formatBDT(toNextBlock)} to next ${ticketsPerBlock === 1 ? 'ticket' : `${ticketsPerBlock} tickets`}`}
        </Text>
      </View>
    </View>
  );
}

function StatsGrid({ me, bn }: { me: LottoMe; bn: boolean }) {
  const cells = [
    { label: bn ? 'অ্যাক্টিভ টিকিট' : 'Active tickets', value: String(me.summary.activeTicketsCount), icon: 'ticket-outline' as const },
    { label: bn ? 'আজ জিতেছেন' : 'Won today', value: formatBDT(me.summary.wonToday, false), icon: 'sparkles-outline' as const },
    { label: bn ? 'মোট জয়' : 'Won lifetime', value: formatBDT(me.summary.wonLifetime, false), icon: 'trophy-outline' as const },
    { label: bn ? 'গত ড্রয়ের জয়' : 'Last draw wins', value: String(me.summary.lastDrawWinningTicketsCount), icon: 'flame-outline' as const },
  ];
  return (
    <View className="flex-row flex-wrap gap-3">
      {cells.map((c) => (
        <View key={c.label} className="min-w-[45%] flex-1 rounded-2xl border border-divider bg-paper p-3.5 shadow-sm shadow-black/5">
          <Icon name={c.icon} size={18} color={colors.gold700} />
          <Text className="mt-2 text-lg font-black text-ink" numberOfLines={1}>
            {c.value}
          </Text>
          <Text className="text-[11px] font-bold uppercase tracking-wider text-ink-mute">{c.label}</Text>
        </View>
      ))}
    </View>
  );
}

function LinkTile({ icon, label, hint, onPress }: { icon: string; label: string; hint: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} className="flex-1 flex-row items-center gap-3 rounded-2xl border border-divider bg-paper p-3.5 shadow-sm shadow-black/5 active:opacity-90">
      <View className="h-10 w-10 items-center justify-center rounded-xl bg-gold-500/15">
        <Icon name={icon} size={20} color={colors.gold700} />
      </View>
      <View className="flex-1">
        <Text className="text-sm font-extrabold text-ink" numberOfLines={1}>
          {label}
        </Text>
        <Text className="text-[11px] text-ink-mute" numberOfLines={1}>
          {hint}
        </Text>
      </View>
      <Icon name="chevron-forward" size={16} color={colors.inkMute} />
    </Pressable>
  );
}

function SkeletonCard() {
  return <View className="h-40 rounded-2xl border border-divider bg-surfaceAlt/40" />;
}
