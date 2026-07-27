// Built by Anointed Coder.
//
// Betting Pass, wired to the live backend and rebuilt to mirror the website
// (apps/web/app/(site)/betting-pass/page.tsx): the banner carousel (or a season
// header fallback), a success/error flash, three KPI cards (Current tier / Pass
// points / Next reward), a progress bar that hides at the top tier, then the
// tier reward cards as a grid of 4:3 art panels (amber when unlocked, blue when
// locked, the operator iconUrl as cover art) with the requirement, reward line,
// bdt_balance turnover note, description and a Claim / Claimed / Locked button.
// Claims are double-submit guarded, credit the wallet server-side, and refetch
// the pass. Copy is EN/BN.

import { useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Screen, Gradient, Badge, PrimaryButton, EmptyState, HeroCarousel } from '@/components/ui';
import { Icon } from '@/components/ui/Icon';
import { AppHeader } from '@/components/AppHeader';
import { gradients, colors } from '@/lib/theme';
import { formatBDT, titleCase } from '@/lib/format';
import { ApiError } from '@/lib/api/client';
import {
  useBettingPassMe,
  useBettingPassBanners,
  useClaimBettingPassTier,
  type BettingPassTier,
  type RewardKind,
} from '@/lib/api/betting-pass';
import { absoluteMediaUrl } from '@/lib/api/home';
import { resolveHref } from '@/lib/nav';
import { useAppLang } from '@/lib/lang';
import type { BannerAccent, HeroBanner } from '@/lib/mock/banners';

type IconName = string;

function rewardIcon(kind: RewardKind): IconName {
  switch (kind) {
    case 'coins':
      return 'cash';
    case 'bdt_balance':
      return 'wallet';
    case 'freebet':
      return 'ticket';
    case 'bonus':
      return 'gift';
    case 'physical':
      return 'cube';
    default:
      return 'gift';
  }
}

function prettyRewardKind(kind: RewardKind, bn: boolean): string {
  switch (kind) {
    case 'bdt_balance':
      return bn ? 'বিডিটি ব্যালেন্স' : 'BDT Balance';
    case 'coins':
      return bn ? 'কয়েন' : 'coins';
    case 'bonus':
      return bn ? 'বোনাস' : 'bonus';
    case 'freebet':
      return bn ? 'ফ্রিবেট' : 'freebet';
    case 'physical':
      return bn ? 'ফিজিক্যাল রিওয়ার্ড' : 'physical reward';
    default:
      return String(kind);
  }
}

export default function BettingPassScreen() {
  const router = useRouter();
  const { lang } = useAppLang();
  const bn = lang === 'bn';

  const query = useBettingPassMe();
  const bannersQuery = useBettingPassBanners();
  const claim = useClaimBettingPassTier();

  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [flash, setFlash] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const submittingRef = useRef(false);

  async function onClaim(tier: BettingPassTier) {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setClaimingId(tier.id);
    setFlash(null);
    try {
      const res = await claim.mutateAsync(tier.id);
      const kindLabel = prettyRewardKind(res.rewardKind, bn);
      const turnoverNote =
        res.turnoverRequired > 0
          ? res.rewardKind === 'bdt_balance'
            ? bn
              ? ` উইথড্রয়ালের আগে ৳${res.turnoverRequired.toLocaleString('en-US')} টার্নওভার সম্পূর্ণ করুন।`
              : ` Complete ${res.turnoverRequired.toLocaleString('en-US')} BDT turnover before withdrawal.`
            : bn
              ? ` টার্নওভার প্রয়োজন ৳${res.turnoverRequired.toLocaleString('en-US')}।`
              : ` Turnover required ৳${res.turnoverRequired.toLocaleString('en-US')}.`
          : '';
      setFlash({
        kind: 'ok',
        text: bn
          ? `রিওয়ার্ড দাবি সম্পন্ন। +${res.rewardAmount.toLocaleString('en-US')} ${kindLabel}.${turnoverNote}`
          : `Reward claimed. +${res.rewardAmount.toLocaleString('en-US')} ${kindLabel}.${turnoverNote}`,
      });
    } catch (err) {
      setFlash({ kind: 'err', text: err instanceof ApiError ? err.message : bn ? 'রিওয়ার্ড দাবি করা যায়নি।' : 'Could not claim this reward. Please try again.' });
    } finally {
      submittingRef.current = false;
      setClaimingId(null);
    }
  }

  const banners = bannersQuery.data ?? [];
  const heroBanners: HeroBanner[] = useMemo(() => {
    const accents: BannerAccent[] = ['gold', 'royal', 'blue', 'neon', 'hot'];
    return banners
      .map((b, i) => {
        const uri = absoluteMediaUrl(b.imageUrl);
        if (!uri) return null;
        // showOverlay off (issue #1): keep the artwork clean, no title/subtitle.
        return {
          id: b.id,
          imageUrl: uri,
          title: b.showOverlay ? (bn ? b.titleBn ?? b.title : b.title) || 'Betting Pass' : '',
          subtitle: b.showOverlay ? bn ? b.subtitleBn ?? b.subtitle : b.subtitle : '',
          ctaLabel: bn ? 'দেখুন' : 'View',
          accent: accents[i % accents.length],
        } as HeroBanner;
      })
      .filter((b): b is HeroBanner => b !== null);
  }, [banners, bn]);

  const refreshControl = (
    <RefreshControl
      refreshing={query.isRefetching && !query.isLoading}
      onRefresh={() => {
        query.refetch();
        bannersQuery.refetch();
      }}
      tintColor={colors.gold600}
    />
  );

  if (query.isLoading) {
    return (
      <Screen header={<AppHeader />} contentClassName="px-4 pt-3 gap-4">
        <View className="h-40 rounded-2xl border border-divider bg-surfaceAlt" />
        {[0, 1, 2, 3].map((i) => (
          <View key={i} className="h-20 rounded-2xl border border-divider bg-surfaceAlt" />
        ))}
      </Screen>
    );
  }

  if (query.isError || !query.data) {
    return (
      <Screen header={<AppHeader />} contentClassName="px-4 pt-3">
        <EmptyState
          icon="cloud-offline"
          title={bn ? 'বেটিং পাস লোড করা যায়নি' : 'Could not load your Betting Pass'}
          message={bn ? 'সিজনে পৌঁছাতে সমস্যা হয়েছে। রিফ্রেশ করুন বা আবার চেষ্টা করুন।' : 'Something went wrong reaching the season. Pull to refresh or try again.'}
          actionLabel={bn ? 'আবার চেষ্টা করুন' : 'Try again'}
          onAction={() => query.refetch()}
        />
      </Screen>
    );
  }

  const { enabled, seasonKey, progress, ladder } = query.data;
  const seasonName = titleCase(seasonKey);
  const level = progress.currentTier;
  const showProgress = progress.nextTierRequirement != null && progress.nextTierRequirement > 0 && progress.pointsToNextTier > 0;
  const pct = showProgress ? Math.min(100, Math.round((progress.pointsTotal / (progress.nextTierRequirement as number)) * 100)) : 100;

  return (
    <Screen header={<AppHeader />} contentClassName="px-4 pt-3 gap-4" refreshControl={refreshControl}>
      {heroBanners.length > 0 ? (
        <HeroCarousel
          banners={heroBanners}
          onPress={(hb) => {
            const orig = banners.find((x) => x.id === hb.id);
            if (orig?.ctaUrl) router.push(resolveHref(orig.ctaUrl, '/betting-pass') as never);
          }}
        />
      ) : (
        <View className="relative overflow-hidden rounded-2xl border border-gold-600/20">
          <Gradient colors={gradients.darkCard} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} radius={16} />
          <View className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-gold-500/15" />
          <View className="relative p-4">
            <Text className="text-[10px] font-bold uppercase tracking-widest text-white/55">{bn ? 'বেটিং পাস' : 'Betting Pass'}</Text>
            <Text className="text-xl font-black text-white">{seasonName}</Text>
            <Text className="mt-0.5 text-[11px] text-white/60">{bn ? 'ডিপোজিট ও বেট করে পয়েন্ট জমান, স্তর আনলক করুন।' : 'Earn points from deposits and bets, unlock tiers.'}</Text>
          </View>
        </View>
      )}

      {/* Success / error flash */}
      {flash ? (
        <View
          className="flex-row items-start gap-2 rounded-xl border px-3 py-2.5"
          style={{
            borderColor: flash.kind === 'ok' ? 'rgba(4,120,87,0.4)' : 'rgba(255,78,58,0.35)',
            backgroundColor: flash.kind === 'ok' ? 'rgba(4,120,87,0.08)' : 'rgba(255,78,58,0.08)',
          }}
        >
          <Icon name={flash.kind === 'ok' ? 'checkmark-circle' : 'alert-circle'} size={16} color={flash.kind === 'ok' ? '#047857' : colors.hot} />
          <Text className="flex-1 text-xs font-semibold" style={{ color: flash.kind === 'ok' ? '#047857' : colors.hot }}>
            {flash.text}
          </Text>
        </View>
      ) : null}

      {/* KPI cards */}
      <View className="flex-row gap-2.5">
        <KpiCard icon="ribbon" title={bn ? 'বর্তমান স্তর' : 'Current tier'} value={progress.currentTierName ?? (bn ? 'এখনও নেই' : 'Not yet')} />
        <KpiCard icon="star" title={bn ? 'পাস পয়েন্ট' : 'Pass points'} value={progress.pointsTotal.toLocaleString('en-US')} />
        <KpiCard icon="flash" title={bn ? 'পরবর্তী রিওয়ার্ড' : 'Next reward'} value={progress.nextTierName ?? (bn ? 'সর্বোচ্চ স্তর' : 'Top tier')} />
      </View>

      {/* Progress bar (hidden at top tier) */}
      {showProgress ? (
        <View className="rounded-2xl border border-divider bg-paper p-4 shadow-sm shadow-black/5">
          <View className="flex-row items-baseline justify-between">
            <Text className="text-[11px] font-bold uppercase tracking-wider text-ink-mute">{bn ? 'পরবর্তী স্তরের অগ্রগতি' : 'Progress to next tier'}</Text>
            <Text className="text-[11px] font-bold text-ink">
              {progress.pointsTotal.toLocaleString('en-US')} / {(progress.nextTierRequirement as number).toLocaleString('en-US')}
            </Text>
          </View>
          <View className="mt-2 h-2.5 overflow-hidden rounded-full bg-surfaceAlt">
            <View className="relative h-full overflow-hidden rounded-full" style={{ width: `${pct}%` }}>
              <Gradient colors={gradients.gold} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} radius={999} />
            </View>
          </View>
          <Text className="mt-2 text-[11px] text-ink-mute">
            {bn ? `${progress.pointsToNextTier.toLocaleString('en-US')} পয়েন্ট বাকি` : `${progress.pointsToNextTier.toLocaleString('en-US')} points to go`}
          </Text>
        </View>
      ) : null}

      {/* Disabled notice */}
      {!enabled ? (
        <View className="flex-row items-start gap-2.5 rounded-2xl border border-gold-600/30 bg-gold-500/10 p-3.5">
          <Icon name="lock-closed" size={18} color={colors.gold700} />
          <View className="flex-1">
            <Text className="text-sm font-extrabold text-ink">{bn ? 'বেটিং পাস সাময়িক বন্ধ' : 'Betting Pass is paused'}</Text>
            <Text className="mt-0.5 text-[12px] leading-5 text-ink-mute">
              {bn ? 'এখন দাবি নেওয়া হচ্ছে না। আপনার পয়েন্ট নিরাপদ, আবার চালু হলে দাবি করতে পারবেন।' : 'The season pass is not accepting claims right now. Your points are safe and rewards can be claimed once it reopens.'}
            </Text>
          </View>
        </View>
      ) : null}

      {/* Reward tier cards */}
      {ladder.length === 0 ? (
        <EmptyState
          icon="trophy-outline"
          title={bn ? 'এখনও কোনো স্তর নেই' : 'No reward tiers yet'}
          message={bn ? 'অপারেটর এখনও কোনো স্তর প্রকাশ করেননি। শীঘ্রই দেখুন।' : 'The operator has not published any Betting Pass tiers for this season. Check back soon.'}
        />
      ) : (
        <View className="gap-3">
          {ladder.map((t) => (
            <TierCard key={t.id} bn={bn} tier={t} enabled={enabled} claiming={claimingId === t.id} disabledAll={claimingId !== null} onClaim={() => onClaim(t)} level={level} />
          ))}
        </View>
      )}
    </Screen>
  );
}

function KpiCard({ icon, title, value }: { icon: IconName; title: string; value: string }) {
  return (
    <View className="flex-1 rounded-2xl border border-divider bg-paper p-3 shadow-sm shadow-black/5">
      <View className="h-9 w-9 items-center justify-center rounded-xl bg-blue-500/12">
        <Icon name={icon} size={17} color={colors.blue600} />
      </View>
      <Text className="mt-2 text-[10px] font-bold uppercase tracking-wider text-ink-mute" numberOfLines={1}>
        {title}
      </Text>
      <Text className="text-sm font-black text-ink" numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

function TierCard({
  bn,
  tier,
  enabled,
  claiming,
  disabledAll,
  onClaim,
}: {
  bn: boolean;
  tier: BettingPassTier;
  enabled: boolean;
  claiming: boolean;
  disabledAll: boolean;
  onClaim: () => void;
  level: number;
}) {
  const claimed = tier.claimed;
  const claimable = enabled && tier.claimable && !claimed;
  const unlocked = tier.unlocked || claimed;
  const art = absoluteMediaUrl(tier.iconUrl);
  const name = bn ? tier.nameBn ?? tier.nameEn : tier.nameEn;
  const description = bn ? tier.descriptionBn ?? tier.descriptionEn : tier.descriptionEn;

  return (
    <View className={'overflow-hidden rounded-2xl border bg-paper ' + (unlocked ? 'border-gold-600/60' : 'border-divider')}>
      {/* 4:3 art panel */}
      <View style={{ width: '100%', aspectRatio: 4 / 3 }} className="relative">
        <Gradient colors={unlocked ? ['#B45309', '#78350F'] : [colors.blue600, colors.blue700]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />
        {art ? <Image source={{ uri: art }} style={{ position: 'absolute', width: '100%', height: '100%', opacity: 0.8 }} contentFit="cover" transition={200} /> : null}
        <View className="absolute inset-0 items-center justify-center">
          <Icon name={claimed ? 'checkmark-circle' : unlocked ? 'ribbon' : 'lock-closed'} size={26} color={unlocked ? '#FFFFFF' : colors.gold300} />
          <Text className="mt-1.5 text-[10px] font-bold uppercase tracking-wider text-white" style={{ textShadowColor: 'rgba(0,0,0,0.5)', textShadowRadius: 3 }}>
            {bn ? `স্তর ${tier.tier}` : `Tier ${tier.tier}`}
          </Text>
          <Text className="text-lg font-black text-white" style={{ textShadowColor: 'rgba(0,0,0,0.5)', textShadowRadius: 3 }} numberOfLines={1}>
            {name}
          </Text>
        </View>
        {claimed ? (
          <View className="absolute right-2.5 top-2.5">
            <Badge label={bn ? 'দাবি হয়েছে' : 'CLAIMED'} variant="new" />
          </View>
        ) : null}
      </View>

      {/* Details */}
      <View className="p-4">
        <Text className="text-[10px] font-bold uppercase tracking-wider text-ink-mute">{bn ? 'প্রয়োজন' : 'Requirement'}</Text>
        <Text className="mt-0.5 text-sm font-bold text-ink">
          {tier.pointsRequired.toLocaleString('en-US')} {bn ? 'পয়েন্ট' : 'points'}
        </Text>

        <Text className="mt-2 text-[10px] font-bold uppercase tracking-wider text-ink-mute">{bn ? 'পুরস্কার' : 'Reward'}</Text>
        <View className="mt-0.5 flex-row items-center gap-1.5">
          <Icon name={rewardIcon(tier.rewardKind)} size={14} color={colors.gold700} />
          <Text className="text-sm font-bold text-ink">
            {tier.rewardAmount.toLocaleString('en-US')} {prettyRewardKind(tier.rewardKind, bn)}
          </Text>
        </View>
        {tier.rewardKind === 'bdt_balance' && tier.turnoverX > 0 ? (
          <Text className="mt-1 text-[10px] text-ink-mute">
            {bn ? `উইথড্রয়ালের আগে ${tier.turnoverX}x টার্নওভার প্রয়োজন।` : `Requires ${tier.turnoverX}x turnover before withdrawal.`}
          </Text>
        ) : null}
        {description ? <Text className="mt-2 text-[11px] leading-5 text-ink-mute">{description}</Text> : null}

        <View className="mt-3">
          {claimed ? (
            <View className="h-10 flex-row items-center justify-center gap-1.5 rounded-xl border border-divider bg-surface">
              <Icon name="checkmark" size={15} color={colors.inkMute} />
              <Text className="text-xs font-bold uppercase tracking-wider text-ink-mute">{bn ? 'দাবি করা হয়েছে' : 'Claimed'}</Text>
            </View>
          ) : claimable ? (
            claiming ? (
              <View className="h-10 items-center justify-center rounded-xl bg-gold-500/15">
                <ActivityIndicator color={colors.gold700} size="small" />
              </View>
            ) : (
              <PrimaryButton label={bn ? 'রিওয়ার্ড দাবি করুন' : 'Claim reward'} fullWidth size="md" disabled={disabledAll} onPress={onClaim} />
            )
          ) : (
            <View className="h-10 flex-row items-center justify-center gap-1.5 rounded-xl border border-divider bg-surface">
              <Icon name="lock-closed" size={14} color={colors.inkMute} />
              <Text className="text-xs font-bold uppercase tracking-wider text-ink-mute">{bn ? 'লক করা' : 'Locked'}</Text>
            </View>
          )}
        </View>
      </View>
    </View>
  );
}
