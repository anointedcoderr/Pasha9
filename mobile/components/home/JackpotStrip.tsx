// Built by Anointed Coder.
//
// JackpotStrip: the premium jackpot card, mirroring the website JackpotStrip
// (apps/web/components/site/JackpotStrip.tsx). Self-fetching via useJackpot().
//
// Honesty first (the rule that shapes this component): it renders the operator's
// real artwork (backgroundUrl), real title/subtitle, and only shows a pool
// value with formatBDT when that pool carries a real number greater than zero.
// It never fabricates or animates an invented amount. The whole strip hides when
// the section is disabled or has nothing real to show (jackpotHasContent).
//
// Visually it matches the web: a dark #0F1115 -> #1A1D24 -> #0F1115 card with a
// gold crown chip + uppercase title + a "live" subtitle pill, over a row of
// pool cards (Mini / Grand / Major) where Grand is raised and highlighted.

import { Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Crown, Sparkles, Trophy, type LucideIcon } from 'lucide-react-native';
import { Gradient } from '@/components/ui/Gradient';
import { formatBDT } from '@/lib/format';
import { colors, gradients } from '@/lib/theme';
import { cn } from '@/lib/cn';
import { useJackpot, jackpotHasContent, tierHasValue, type Jackpot, type JackpotTier } from '@/lib/api/home';

interface Pool {
  key: string;
  label: string;
  value: number;
  iconUrl: string | null;
  icon: LucideIcon;
  glow: string[];
  highlight: boolean;
}

export function JackpotStrip() {
  const { data: jackpot, isLoading } = useJackpot();

  // Hidden while loading and whenever there is nothing real to render.
  if (isLoading || !jackpot || !jackpotHasContent(jackpot)) return null;

  const title = jackpot.title?.trim() || 'Jackpot';
  const subtitle = jackpot.subtitle?.trim() || null;

  // Only pools with a real, positive value are shown, each with formatBDT.
  const pools = buildPools(jackpot);

  return (
    <View style={{ borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,204,0,0.30)' }} className="relative overflow-hidden p-4">
      <Gradient colors={gradients.darkCard} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} radius={16} />

      {/* Optional admin-uploaded artwork, kept low so the card reads first. */}
      {jackpot.backgroundUrl ? (
        <Image
          source={{ uri: jackpot.backgroundUrl }}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0.22 }}
          contentFit="cover"
          transition={200}
          cachePolicy="memory-disk"
        />
      ) : null}

      {/* Header */}
      <View className="flex-row items-center justify-between gap-2">
        <View className="flex-row items-center gap-2">
          <View className="h-7 w-7 items-center justify-center rounded-lg bg-brand-yellow-500">
            <Crown size={15} color={colors.ink} strokeWidth={2} />
          </View>
          <Text className="text-sm font-extrabold uppercase tracking-[2px]" style={{ color: colors.gold300 }} numberOfLines={1}>
            {title}
          </Text>
        </View>
        {subtitle ? (
          <View
            className="flex-row items-center gap-1.5 rounded-pill px-2.5 py-1"
            style={{ borderWidth: 1, borderColor: 'rgba(255,204,0,0.20)', backgroundColor: 'rgba(255,255,255,0.05)' }}
          >
            <View className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: '#34D399' }} />
            <Text className="text-[10px] font-bold uppercase tracking-wider text-white/75" numberOfLines={1}>
              {subtitle}
            </Text>
          </View>
        ) : null}
      </View>

      {/* Pools (only those with a real value) */}
      {pools.length > 0 ? (
        <View className="mt-4 flex-row items-end gap-2">
          {pools.map((p) => (
            <PoolCard key={p.key} pool={p} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

function buildPools(j: Jackpot): Pool[] {
  const defs: Array<{ key: string; fallback: string; tier: JackpotTier; icon: LucideIcon; glow: string[]; highlight: boolean }> = [
    { key: 'mini', fallback: 'Mini', tier: j.mini, icon: Sparkles, glow: ['#FCD34D', '#F59E0B', '#B45309'], highlight: false },
    { key: 'grand', fallback: 'Grand', tier: j.grand, icon: Crown, glow: ['#FB7185', '#F43F5E', '#B91C1C'], highlight: true },
    { key: 'major', fallback: 'Major', tier: j.major, icon: Trophy, glow: ['#38BDF8', '#3B82F6', '#1E40AF'], highlight: false },
  ];
  return defs
    .filter((d) => tierHasValue(d.tier))
    .map((d) => ({
      key: d.key,
      label: d.tier.title?.trim() || d.fallback,
      value: d.tier.value as number,
      iconUrl: d.tier.iconUrl,
      icon: d.icon,
      glow: d.glow,
      highlight: d.highlight,
    }));
}

function PoolCard({ pool }: { pool: Pool }) {
  const Icon = pool.icon;
  return (
    <View
      className="flex-1 items-center overflow-hidden rounded-xl px-3"
      style={{
        paddingVertical: pool.highlight ? 16 : 12,
        transform: [{ translateY: pool.highlight ? -4 : 0 }],
        borderWidth: 1,
        borderColor: pool.highlight ? 'rgba(255,204,0,0.55)' : 'rgba(255,255,255,0.10)',
        backgroundColor: pool.highlight ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.04)',
      }}
    >
      {/* Icon chip: operator icon if set, else a gradient glyph tile */}
      <View
        className="items-center justify-center overflow-hidden rounded-lg"
        style={{ height: pool.highlight ? 34 : 28, width: pool.highlight ? 34 : 28 }}
      >
        {pool.iconUrl ? (
          <>
            <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(255,255,255,0.10)' }} />
            <Image source={{ uri: pool.iconUrl }} style={{ width: '100%', height: '100%', padding: 4 }} contentFit="contain" />
          </>
        ) : (
          <>
            <Gradient colors={pool.glow} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} radius={8} />
            <Icon size={pool.highlight ? 16 : 14} color="#FFFFFF" strokeWidth={2} />
          </>
        )}
      </View>

      <Text
        className={cn('mt-1 text-[10px] font-bold uppercase tracking-wider')}
        style={{ color: pool.highlight ? '#FFEB99' : 'rgba(255,255,255,0.70)' }}
        numberOfLines={1}
      >
        {pool.label}
      </Text>

      <Text
        className={cn('mt-0.5 font-black', pool.highlight ? 'text-xl' : 'text-base')}
        style={{ color: pool.highlight ? '#FFE066' : '#FFFFFF' }}
        numberOfLines={1}
      >
        {formatBDT(pool.value)}
      </Text>
    </View>
  );
}
