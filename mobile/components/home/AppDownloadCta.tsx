// Built by Anointed Coder.
//
// AppDownloadCta: the Android APK download promo, mirroring
// apps/web/components/site/AppDownloadSection.tsx. Self-fetching via useApk().
// The download link is admin-set (SystemSetting apk_download_url); until an
// operator publishes a build the whole section stays hidden rather than
// showing a dead button. The Download button opens the APK url in the in-app
// browser (expo-web-browser) and the version chip shows the published build.
//
// States: hidden while loading, on error, and whenever no url is set.

import { Pressable, Text, View } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import Svg, { Defs, LinearGradient as SvgLinearGradient, Rect, Circle, Stop } from 'react-native-svg';
import { Download, Smartphone } from 'lucide-react-native';
import { Gradient } from '@/components/ui';
import { colors, gradients } from '@/lib/theme';
import { useApk } from '@/lib/api/homepage';

// Static labels copied 1:1 from the web i18n dictionary (en.json home.app).
const COPY = {
  kicker: 'Pasha 9 App',
  title: 'Pasha 9 mobile app, fast and smooth',
  subtitle: 'Download the Android app for one-tap login, faster deposits and live notifications.',
  download: 'Download Now',
  android: 'Available on Android',
} as const;

export function AppDownloadCta() {
  const { data, isLoading, isError } = useApk();

  // No published build yet (or still loading / errored): render nothing.
  if (isLoading || isError || !data?.url) return null;

  const url = data.url;

  return (
    <View className="overflow-hidden rounded-2xl border border-brand-divider bg-brand-paper px-5 py-6">
      <View className="flex-row items-center gap-4">
        <View className="flex-1">
          <Text className="font-en text-[11px] font-bold uppercase tracking-wider text-brand-yellow-700">
            {COPY.kicker}
          </Text>
          <Text className="mt-1.5 text-xl font-extrabold leading-tight text-brand-ink">{COPY.title}</Text>
          <Text className="mt-2 text-sm leading-relaxed text-brand-inkSoft">{COPY.subtitle}</Text>
        </View>
        <PhoneMock />
      </View>

      <View className="mt-4 flex-row flex-wrap items-center gap-3">
        <Pressable
          onPress={() => WebBrowser.openBrowserAsync(url, { enableBarCollapsing: true, showTitle: true }).catch(() => {})}
          className="h-11 overflow-hidden rounded-lg active:opacity-90"
        >
          <Gradient colors={gradients.gold} radius={8} />
          <View className="h-11 flex-row items-center gap-2 px-5">
            <Download size={16} color={colors.ink} strokeWidth={2} />
            <Text className="font-en text-sm font-bold text-brand-ink">{COPY.download}</Text>
          </View>
        </Pressable>
        <View className="h-11 flex-row items-center gap-2 rounded-lg border border-brand-divider bg-brand-surface px-4">
          <Smartphone size={16} color={colors.inkSoft} strokeWidth={2} />
          <Text className="text-xs font-semibold text-brand-inkSoft">
            {data.version ? `v${data.version}` : COPY.android}
          </Text>
        </View>
      </View>
    </View>
  );
}

// The phone-mock artwork, ported from the web PhoneMock SVG.
function PhoneMock() {
  return (
    <View style={{ width: 92, height: 150 }}>
      <Svg width="100%" height="100%" viewBox="0 0 160 260">
        <Defs>
          <SvgLinearGradient id="phoneGrad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#1659C2" />
            <Stop offset="1" stopColor="#0F1115" />
          </SvgLinearGradient>
          <SvgLinearGradient id="phoneScr" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#FFCC00" />
            <Stop offset="1" stopColor="#F5B400" />
          </SvgLinearGradient>
        </Defs>
        <Rect x="4" y="4" width="152" height="252" rx="20" fill="url(#phoneGrad)" />
        <Rect x="14" y="22" width="132" height="216" rx="8" fill="#0F1115" />
        <Rect x="20" y="32" width="120" height="60" rx="6" fill="url(#phoneScr)" />
        <Rect x="20" y="100" width="56" height="56" rx="6" fill="rgba(255,204,0,0.3)" />
        <Rect x="84" y="100" width="56" height="56" rx="6" fill="rgba(30,115,232,0.4)" />
        <Rect x="20" y="164" width="120" height="14" rx="4" fill="rgba(255,255,255,0.12)" />
        <Rect x="20" y="184" width="120" height="14" rx="4" fill="rgba(255,255,255,0.10)" />
        <Rect x="20" y="204" width="80" height="14" rx="4" fill="rgba(255,255,255,0.08)" />
        <Circle cx="80" cy="248" r="4" fill="rgba(255,255,255,0.4)" />
      </Svg>
    </View>
  );
}
