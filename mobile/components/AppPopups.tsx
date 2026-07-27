// Built by Anointed Coder.
//
// Global targeted announcement popup for the app (#9). Mounted once in the root
// layout. Reads the active popups and shows the first one that matches the
// current route and has not been seen at its configured frequency. Each popup
// can carry an image, a CTA, and an uploaded voice message (opened in the
// in-app browser, since the app has no native audio player wired for this).

import { useEffect, useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { usePathname, useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import * as SecureStore from 'expo-secure-store';
import { Icon } from '@/components/ui/Icon';
import { PrimaryButton, GhostButton } from '@/components/ui';
import { usePopups, type PopupItem } from '@/lib/api/popups';
import { absoluteMediaUrl } from '@/lib/api/home';
import { resolveHref } from '@/lib/nav';
import { useAppLang } from '@/lib/lang';
import { colors } from '@/lib/theme';

// Popups shown this app session (covers 'always' + 'once_per_session').
const sessionSeen = new Set<string>();
const storeKey = (id: string) => `pasha9popup_${id}`;
function todayStr() {
  const d = new Date();
  return `${d.getUTCFullYear()}-${d.getUTCMonth() + 1}-${d.getUTCDate()}`;
}

async function isSeen(p: PopupItem): Promise<boolean> {
  if (sessionSeen.has(p.id)) return true;
  try {
    if (p.frequency === 'once_per_day') return (await SecureStore.getItemAsync(storeKey(p.id))) === todayStr();
    if (p.frequency === 'once_per_user') return (await SecureStore.getItemAsync(storeKey(p.id))) === '1';
  } catch {
    /* store blocked */
  }
  return false;
}

async function markSeen(p: PopupItem) {
  sessionSeen.add(p.id);
  try {
    if (p.frequency === 'once_per_day') await SecureStore.setItemAsync(storeKey(p.id), todayStr());
    else if (p.frequency === 'once_per_user') await SecureStore.setItemAsync(storeKey(p.id), '1');
  } catch {
    /* store blocked */
  }
}

function matchesRoute(p: PopupItem, pathname: string): boolean {
  switch (p.target) {
    case 'all_pages':
      return true;
    case 'entry':
      return true;
    case 'homepage':
      return pathname === '/' || pathname === '/index';
    case 'deposit_page':
    case 'deposit_click': // no click observer on native; show on the deposit screen
      return pathname.startsWith('/deposit');
    case 'withdrawal_page':
      return pathname.startsWith('/withdraw');
    case 'auth_page':
      return pathname.startsWith('/auth');
    case 'custom_url':
      return Boolean(p.targetUrl && (pathname === p.targetUrl || pathname.startsWith(p.targetUrl + '/')));
    default:
      return false;
  }
}

export function AppPopups() {
  const { data: popups } = usePopups();
  const pathname = usePathname();
  const router = useRouter();
  const { lang } = useAppLang();
  const bn = lang === 'bn';
  const [active, setActive] = useState<PopupItem | null>(null);

  useEffect(() => {
    if (active || !popups || popups.length === 0) return;
    let cancelled = false;
    (async () => {
      for (const p of popups) {
        if (!matchesRoute(p, pathname)) continue;
        if (await isSeen(p)) continue;
        if (!cancelled) setActive(p);
        return;
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [popups, pathname, active]);

  const close = () => {
    if (active) void markSeen(active);
    setActive(null);
  };
  const onCta = () => {
    if (!active?.ctaHref) return;
    const href = resolveHref(active.ctaHref, '/');
    close();
    router.push(href as never);
  };
  const onListen = () => {
    const uri = absoluteMediaUrl(active?.audioUrl ?? null);
    if (uri) void WebBrowser.openBrowserAsync(uri);
  };

  if (!active) return null;
  const img = absoluteMediaUrl(active.imageUrl);

  return (
    <Modal visible transparent animationType="fade" onRequestClose={close}>
      <View className="flex-1 items-center justify-center bg-black/60 px-6">
        <View className="w-full max-w-sm overflow-hidden rounded-3xl bg-paper">
          {img ? <Image source={{ uri: img }} style={{ width: '100%', aspectRatio: 5 / 3 }} contentFit="cover" transition={150} /> : null}
          <View className="gap-3 p-5">
            <View className="flex-row items-start justify-between gap-2">
              <Text className="flex-1 text-lg font-black text-ink">{active.title}</Text>
              <Pressable onPress={close} hitSlop={8} accessibilityRole="button" accessibilityLabel={bn ? 'বন্ধ' : 'Close'}>
                <Icon name="close" size={22} color={colors.ink} />
              </Pressable>
            </View>
            <Text className="text-sm text-ink-soft">{active.body}</Text>

            {active.audioUrl ? (
              <Pressable
                onPress={onListen}
                accessibilityRole="button"
                className="flex-row items-center gap-2 rounded-xl border border-divider bg-surface px-3 py-2.5 active:opacity-80"
              >
                <Icon name="volume-high" size={18} color={colors.blue600} />
                <Text className="text-xs font-bold text-ink-soft">{bn ? 'ভয়েস মেসেজ শুনুন' : 'Listen to this message'}</Text>
              </Pressable>
            ) : null}

            <View className="mt-1 flex-row gap-2">
              <GhostButton label={bn ? 'বন্ধ' : 'Close'} className="flex-1" onPress={close} />
              {active.ctaLabel && active.ctaHref ? <PrimaryButton label={active.ctaLabel} className="flex-1" onPress={onCta} /> : null}
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}
