// Built by Anointed Coder.
//
// Promotions (live), rebuilt to mirror the website (apps/web/app/(site)/
// promotions/page.tsx). Above the list: the promotion banner slider (or a
// section header fallback) and the promo-code redeem card. Then filter chips
// with a results counter, then rich promo cards matching the web card exactly:
// a 16:9 gradient/artwork header with the category tag + headline payout badge
// + type icon, the name + description + effective sentence, a 2x2 stats grid
// (Min Deposit / Max Bonus / Turnover / Validity), collapsible terms from the
// real termsEn/Bn, and a Live label + claim CTA whose behavior follows the
// backend claimAction:
//   - credit   -> POST the claim, credit the bonus, invalidate the wallet
//   - deposit  -> open the deposit screen PREFILLED with the suggested amount
//   - redirect -> POST the claim, then open the returned URL in a browser
//   - disabled -> the CTA is inert with a reason line
// Both the per-card claim and the redeem are guarded against double-submit with
// a synchronous useRef. Copy is EN/BN via useAppLang.

import { useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import {
  Screen,
  SectionHeader,
  ChipToggle,
  Badge,
  PrimaryButton,
  TextField,
  EmptyState,
  HeroCarousel,
  Gradient,
} from '@/components/ui';
import { AppHeader } from '@/components/AppHeader';
import { Icon } from '@/components/ui/Icon';
import { ApiError } from '@/lib/api/client';
import {
  usePromotions,
  usePromotionBanners,
  useClaimPromotion,
  useRedeemPromoCode,
  type Promotion,
} from '@/lib/api/promotions';
import { absoluteMediaUrl } from '@/lib/api/home';
import { resolveHref } from '@/lib/nav';
import { useAppLang } from '@/lib/lang';
import { formatBDT } from '@/lib/format';
import { colors } from '@/lib/theme';
import type { BannerAccent, HeroBanner } from '@/lib/mock/banners';

const FILTERS = [
  { key: 'all', en: 'All', bn: 'সব' },
  { key: 'first_deposit_bonus', en: 'Deposit', bn: 'ডিপোজিট' },
  { key: 'daily_bonus', en: 'Daily', bn: 'দৈনিক' },
  { key: 'weekly_reward', en: 'Weekly', bn: 'সাপ্তাহিক' },
  { key: 'referral_bonus', en: 'Referral', bn: 'রেফারেল' },
  { key: 'vip_reward', en: 'VIP', bn: 'ভিআইপি' },
  { key: 'invite_friend_offer', en: 'Invite', bn: 'ইনভাইট' },
];

// Per-type icon (Icon shim name) + accent gradient, mirroring the web ICON /
// ACCENT maps so each card reads the same as the site.
const TYPE_ICON: Record<string, string> = {
  first_deposit: 'sparkles',
  daily: 'repeat',
  weekly: 'gift',
  referral: 'people',
  vip: 'diamond',
  invite: 'send',
  reload: 'repeat',
  manual: 'add-circle',
  promo: 'star',
};
const TYPE_ACCENT: Record<string, string[]> = {
  first_deposit: ['#FFD633', '#F5B400', '#FF7A1A'],
  daily: ['#34D399', '#059669', '#0F766E'],
  weekly: ['#38BDF8', '#1659C2', '#10449A'],
  referral: ['#E879F9', '#7C3AED', '#3730A3'],
  vip: ['#FBBF24', '#F97316', '#E11D48'],
  invite: ['#FB7185', '#E11D48', '#EA580C'],
  reload: ['#22D3EE', '#0891B2', '#1D4ED8'],
  manual: ['#64748B', '#334155', '#0F172A'],
  promo: ['#F472B6', '#F43F5E', '#DC2626'],
};
const typeIcon = (t: string) => TYPE_ICON[t] ?? 'star';
const typeAccent = (t: string) => TYPE_ACCENT[t] ?? TYPE_ACCENT.promo;

function categoryLabel(category: string, bn: boolean): string {
  switch (category) {
    case 'first_deposit_bonus':
      return bn ? 'ফার্স্ট ডিপোজিট' : 'First Deposit';
    case 'daily_bonus':
      return bn ? 'দৈনিক' : 'Daily';
    case 'weekly_reward':
      return bn ? 'সাপ্তাহিক' : 'Weekly';
    case 'referral_bonus':
      return bn ? 'রেফারেল' : 'Referral';
    case 'vip_reward':
      return bn ? 'ভিআইপি' : 'VIP';
    case 'invite_friend_offer':
      return bn ? 'বন্ধু আমন্ত্রণ' : 'Invite Friend';
    default:
      return bn ? 'অন্যান্য' : 'Other';
  }
}

interface Feedback {
  id: string;
  kind: 'ok' | 'err';
  text: string;
}

export default function PromotionsScreen() {
  const router = useRouter();
  const { lang } = useAppLang();
  const bn = lang === 'bn';
  const [filter, setFilter] = useState('all');

  const promosQuery = usePromotions();
  const bannersQuery = usePromotionBanners();
  const claim = useClaimPromotion();
  const redeem = useRedeemPromoCode();

  const claimInFlight = useRef<string | null>(null);
  const redeemInFlight = useRef(false);

  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [code, setCode] = useState('');
  const [redeemMsg, setRedeemMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  const list = useMemo(() => {
    const all = promosQuery.data ?? [];
    return filter === 'all' ? all : all.filter((p) => p.category === filter);
  }, [promosQuery.data, filter]);

  const banners = bannersQuery.data ?? [];
  const heroBanners: HeroBanner[] = useMemo(() => {
    const accents: BannerAccent[] = ['gold', 'royal', 'hot', 'neon', 'blue'];
    return banners
      .map((b, i) => {
        const uri = absoluteMediaUrl(b.imageUrl);
        if (!uri) return null;
        return {
          id: b.id,
          imageUrl: uri,
          title: (bn ? b.titleBn ?? b.title : b.title) || 'Pasha9',
          subtitle: bn ? b.subtitleBn ?? b.subtitle : b.subtitle,
          ctaLabel: bn ? 'দেখুন' : 'View',
          accent: accents[i % accents.length],
        } as HeroBanner;
      })
      .filter((b): b is HeroBanner => b !== null);
  }, [banners, bn]);

  async function onClaim(p: Promotion) {
    if (claimInFlight.current) return;
    if (p.claimAction === 'disabled' || p.claimed) return;

    // Deposit-gated: hand the deposit screen the suggested amount so the field
    // is prefilled and the bonus preview applies. (The old code pushed /deposit
    // with no context, losing the promotion/amount entirely.)
    if (p.claimAction === 'deposit') {
      const suggested = p.requiredDepositAmount > 0 ? p.requiredDepositAmount : p.minDeposit;
      if (suggested > 0) {
        router.push({ pathname: '/deposit', params: { amount: String(Math.floor(suggested)) } });
      } else {
        router.push('/deposit');
      }
      return;
    }

    claimInFlight.current = p.id;
    setFeedback(null);
    try {
      const res = await claim.mutateAsync(p.id);
      if (res.action === 'redirect' && res.url) {
        await WebBrowser.openBrowserAsync(res.url, { enableBarCollapsing: true, showTitle: true });
      } else if (typeof res.amount === 'number' && res.amount > 0) {
        setFeedback({ id: p.id, kind: 'ok', text: bn ? `${formatBDT(res.amount)} বোনাস যোগ হয়েছে।` : `Claimed ${formatBDT(res.amount)} bonus.` });
      } else {
        setFeedback({ id: p.id, kind: 'ok', text: bn ? 'রিওয়ার্ড দাবি করা হয়েছে।' : 'Reward claimed.' });
      }
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : bn ? 'দাবি করা যায়নি।' : 'Could not claim this promotion. Please try again.';
      setFeedback({ id: p.id, kind: 'err', text: msg });
    } finally {
      claimInFlight.current = null;
    }
  }

  async function onRedeem() {
    if (redeemInFlight.current) return;
    if (code.trim().length < 2) {
      setRedeemMsg({ kind: 'err', text: bn ? 'একটি সঠিক প্রোমো কোড দিন।' : 'Enter a valid promo code.' });
      return;
    }
    redeemInFlight.current = true;
    setRedeemMsg(null);
    try {
      const res = await redeem.mutateAsync(code);
      const label = res.amount > 0 ? (bn ? `${formatBDT(res.amount)} যোগ হয়েছে।` : `Redeemed ${formatBDT(res.amount)}.`) : bn ? 'কোড রিডিম হয়েছে।' : 'Promo code redeemed.';
      setRedeemMsg({ kind: 'ok', text: label });
      setCode('');
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : bn ? 'কোড রিডিম করা যায়নি।' : 'Could not redeem that code. Please try again.';
      setRedeemMsg({ kind: 'err', text: msg });
    } finally {
      redeemInFlight.current = false;
    }
  }

  return (
    <Screen header={<AppHeader />} contentClassName="px-4 pt-3 gap-4">
      {heroBanners.length > 0 ? (
        <HeroCarousel
          banners={heroBanners}
          onPress={(hb) => {
            const orig = banners.find((x) => x.id === hb.id);
            if (orig?.ctaUrl) router.push(resolveHref(orig.ctaUrl, '/promotions') as never);
          }}
        />
      ) : (
        <SectionHeader title={bn ? 'প্রমোশন' : 'Promotions'} subtitle={bn ? 'আপনার জন্য বাছাই করা বোনাস' : 'Bonuses picked for you'} icon="gift" />
      )}

      {/* Promo code redeem */}
      <View className="rounded-2xl border border-divider bg-paper p-4 shadow-sm shadow-black/5">
        <Text className="text-sm font-extrabold text-ink">{bn ? 'প্রোমো কোড আছে?' : 'Have a promo code?'}</Text>
        <Text className="mt-0.5 text-[11px] text-ink-mute">{bn ? 'রিওয়ার্ড ওয়ালেটে যোগ করতে নিচে কোডটি দিন।' : 'Enter it below to add the reward to your wallet.'}</Text>
        <View className="mt-3 flex-row items-end gap-2">
          <TextField
            className="flex-1"
            placeholder="e.g. WELCOME10"
            icon="pricetag-outline"
            value={code}
            onChangeText={(t) => setCode(t)}
            autoCapitalize="characters"
          />
          <PrimaryButton
            label={bn ? 'রিডিম' : 'Redeem'}
            size="md"
            loading={redeem.isPending}
            disabled={redeem.isPending || code.trim().length < 2}
            onPress={onRedeem}
          />
        </View>
        {redeemMsg ? (
          <Text className="mt-2 text-[12px] font-semibold" style={{ color: redeemMsg.kind === 'ok' ? colors.gold700 : colors.hot }}>
            {redeemMsg.text}
          </Text>
        ) : null}
      </View>

      {/* Filters + results counter */}
      <View className="gap-1.5">
        <ChipToggle options={FILTERS.map((f) => ({ key: f.key, label: bn ? f.bn : f.en }))} value={filter} onChange={setFilter} scroll />
        {!promosQuery.isLoading && !promosQuery.isError ? (
          <Text className="px-1 text-right text-[11px] text-ink-mute">
            {list.length} {bn ? 'টি ফলাফল' : list.length === 1 ? 'result' : 'results'}
          </Text>
        ) : null}
      </View>

      {promosQuery.isLoading ? (
        <View className="items-center py-16">
          <ActivityIndicator color={colors.gold700} />
          <Text className="mt-3 text-sm text-ink-mute">{bn ? 'প্রমোশন লোড হচ্ছে' : 'Loading promotions'}</Text>
        </View>
      ) : promosQuery.isError ? (
        <EmptyState
          icon="cloud-offline-outline"
          title={bn ? 'প্রমোশন লোড করা যায়নি' : 'Could not load promotions'}
          message={promosQuery.error instanceof ApiError ? promosQuery.error.message : bn ? 'সংযোগ দেখে আবার চেষ্টা করুন।' : 'Check your connection and try again.'}
          actionLabel={bn ? 'আবার' : 'Retry'}
          onAction={() => promosQuery.refetch()}
        />
      ) : list.length === 0 ? (
        <EmptyState
          icon="pricetags-outline"
          title={bn ? 'এখানে এখনও কোনো প্রমোশন নেই' : 'No promotions here yet'}
          message={bn ? 'অন্য ফিল্টার দেখুন। প্রতি সপ্তাহে নতুন অফার আসে।' : 'Try a different filter. Fresh offers drop every week.'}
        />
      ) : (
        <View className="gap-4">
          {list.map((p) => (
            <PromoCard
              key={p.id}
              bn={bn}
              promo={p}
              busy={claim.isPending && claimInFlight.current === p.id}
              feedback={feedback && feedback.id === p.id ? feedback : null}
              onClaim={() => onClaim(p)}
            />
          ))}
        </View>
      )}

      {/* Static terms footer, mirroring the web */}
      <View className="rounded-2xl border border-divider bg-paper p-4">
        <Text className="text-base font-extrabold text-ink">{bn ? 'শর্তাবলী' : 'Terms and conditions'}</Text>
        <Text className="mt-1.5 text-xs leading-5 text-ink-mute">
          {bn
            ? 'সব বোনাসের নিজস্ব যোগ্যতা ও টার্নওভার শর্ত আছে। বিস্তারিত প্রতিটি অফারের কার্ডে দেখুন। পাশা৯ যেকোনো সময় প্রমোশন পরিবর্তন বা বন্ধ করার অধিকার রাখে।'
            : 'Every bonus has its own eligibility and turnover terms. See each offer card for the details. Pasha9 may change or end any promotion at any time.'}
        </Text>
      </View>
    </Screen>
  );
}

function claimLabel(p: Promotion, bn: boolean, busy: boolean): string {
  if (p.claimed) return bn ? 'দাবি করা হয়েছে' : 'Claimed';
  if (busy) return bn ? 'প্রসেসিং...' : 'Processing...';
  switch (p.claimAction) {
    case 'deposit':
      return bn ? 'ডিপোজিট করে দাবি করুন' : 'Deposit to Claim';
    case 'redirect':
      return bn ? 'অফার দেখুন' : 'View Offer';
    case 'disabled':
      return bn ? 'উপলব্ধ নয়' : 'Unavailable';
    default:
      return bn ? 'দাবি করুন' : 'Claim';
  }
}

function PromoCard({
  bn,
  promo,
  busy,
  feedback,
  onClaim,
}: {
  bn: boolean;
  promo: Promotion;
  busy: boolean;
  feedback: Feedback | null;
  onClaim: () => void;
}) {
  const [showTerms, setShowTerms] = useState(false);
  const image = absoluteMediaUrl(promo.bannerMobileUrl ?? promo.bannerUrl ?? promo.thumbnailUrl ?? promo.backgroundUrl);
  const name = bn ? promo.nameBn ?? promo.name : promo.name;
  const description = bn ? promo.descriptionBn ?? promo.description : promo.description;
  const terms = (bn ? promo.termsBn ?? promo.termsEn : promo.termsEn) ?? (promo.turnoverX > 0 ? (bn ? `রিলিজের আগে ${promo.turnoverX}x টার্নওভার।` : `Wagering ${promo.turnoverX}x before release.`) : null);
  const headline = promo.percentage > 0 ? `${promo.percentage}%` : promo.amount > 0 ? formatBDT(promo.amount) : bn ? 'অফার' : 'Offer';
  const disabled = promo.claimAction === 'disabled' || promo.claimed === true;

  const disabledMessage = promo.claimed
    ? bn ? 'এই সময়ের জন্য ইতিমধ্যে দাবি করা হয়েছে' : 'Already claimed for this period'
    : promo.disabledReason === 'config_error'
      ? bn ? 'এই অফারটি আপডেট হচ্ছে। শীঘ্রই দেখুন।' : 'This offer is being updated. Check back soon.'
      : promo.disabledReason
        ? bn ? 'আপনার অ্যাকাউন্টে এখনও উপলব্ধ নয়।' : 'Not available for your account yet.'
        : null;

  return (
    <View className="overflow-hidden rounded-2xl border border-divider bg-paper shadow-sm shadow-black/5">
      {/* 16:9 header: gradient accent + optional artwork + wash + tag/headline + icon */}
      <View style={{ width: '100%', aspectRatio: 16 / 9 }} className="relative">
        <Gradient colors={typeAccent(promo.type)} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />
        {image ? <Image source={{ uri: image }} style={{ position: 'absolute', width: '100%', height: '100%' }} contentFit="cover" transition={200} /> : null}
        {promo.claimed ? (
          <View className="absolute left-2.5 top-2.5">
            <Badge label={bn ? 'দাবি হয়েছে' : 'CLAIMED'} variant="new" />
          </View>
        ) : null}
        <View className="absolute right-2.5 top-2.5 h-11 w-11 items-center justify-center rounded-xl bg-white/20">
          <Icon name={typeIcon(promo.type)} size={20} color="#FFFFFF" />
        </View>
        <View className="absolute inset-x-0 bottom-0 flex-row items-center justify-between gap-2 px-3 pb-2.5 pt-8">
          <Gradient colors={['rgba(0,0,0,0.6)', 'rgba(0,0,0,0.35)', 'rgba(0,0,0,0)']} start={{ x: 0, y: 1 }} end={{ x: 0, y: 0 }} />
          <Text className="text-[10px] font-black uppercase tracking-wider text-white" numberOfLines={1} style={{ textShadowColor: 'rgba(0,0,0,0.5)', textShadowRadius: 3 }}>
            {categoryLabel(promo.category, bn)}
          </Text>
          <View className="rounded-full bg-black/40 px-2.5 py-1">
            <Text className="text-[11px] font-black text-white">{headline}</Text>
          </View>
        </View>
      </View>

      <View className="gap-3 p-4">
        <View>
          <Text className="text-base font-extrabold text-ink" numberOfLines={2}>
            {name}
          </Text>
          {description ? <Text className="mt-1 text-sm text-ink-mute">{description}</Text> : null}
          {promo.effective ? <Text className="mt-1.5 text-[11px] text-ink-mute">{promo.effective}</Text> : null}
        </View>

        {/* 2x2 stats grid */}
        <View className="flex-row flex-wrap" style={{ gap: 8 }}>
          <StatCell label={bn ? 'সর্বনিম্ন ডিপোজিট' : 'Min Deposit'} value={promo.minDeposit > 0 ? formatBDT(promo.minDeposit) : '-'} />
          <StatCell label={bn ? 'সর্বোচ্চ বোনাস' : 'Max Bonus'} value={promo.maxBonus > 0 ? formatBDT(promo.maxBonus) : bn ? 'সীমা নেই' : 'No cap'} />
          <StatCell label={bn ? 'টার্নওভার' : 'Turnover'} value={promo.turnoverX > 0 ? `${promo.turnoverX}x` : bn ? 'নেই' : 'None'} />
          <StatCell label={bn ? 'মেয়াদ' : 'Validity'} value={promo.validityDays > 0 ? `${promo.validityDays} ${bn ? 'দিন' : 'd'}` : bn ? 'মেয়াদহীন' : 'No expiry'} />
        </View>

        {/* Collapsible terms from the real terms text */}
        {terms ? (
          <View className="rounded-xl border border-divider bg-surface">
            <Pressable
              onPress={() => setShowTerms((v) => !v)}
              accessibilityRole="button"
              accessibilityState={{ expanded: showTerms }}
              className="flex-row items-center justify-between px-3 py-2.5 active:opacity-80"
            >
              <Text className="text-xs font-bold text-ink">{bn ? 'শর্তাবলী' : 'Terms and conditions'}</Text>
              <Icon name={showTerms ? 'chevron-up' : 'chevron-down'} size={15} color={colors.inkMute} />
            </Pressable>
            {showTerms ? <Text className="px-3 pb-3 text-[11px] leading-5 text-ink-soft">{terms}</Text> : null}
          </View>
        ) : null}

        {disabledMessage ? (
          <View className="flex-row items-center gap-1.5">
            <Icon name="lock-closed-outline" size={13} color={colors.inkMute} />
            <Text className="flex-1 text-[11px] text-ink-mute">{disabledMessage}</Text>
          </View>
        ) : null}

        {feedback ? (
          <Text className="text-[12px] font-semibold" style={{ color: feedback.kind === 'ok' ? colors.gold700 : colors.hot }}>
            {feedback.text}
          </Text>
        ) : null}

        <View className="flex-row items-center justify-between gap-2">
          <View className="flex-row items-center gap-1.5">
            <View className="h-2 w-2 rounded-full bg-newg" />
            {/* Darker green than the dot so the label meets AA on white. */}
            <Text className="text-xs font-bold" style={{ color: '#047857' }}>
              {bn ? 'সক্রিয়' : 'Live'}
            </Text>
          </View>
          <PrimaryButton
            label={claimLabel(promo, bn, busy)}
            size="sm"
            loading={busy}
            disabled={disabled || busy}
            onPress={onClaim}
          />
        </View>
      </View>
    </View>
  );
}

function StatCell({ label, value }: { label: string; value: string }) {
  return (
    <View className="rounded-xl border border-divider bg-surface p-2.5" style={{ width: '48%' }}>
      <Text className="text-[10px] font-bold uppercase tracking-wider text-ink-mute" numberOfLines={1}>
        {label}
      </Text>
      <Text className="mt-0.5 text-sm font-black text-ink" numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}
