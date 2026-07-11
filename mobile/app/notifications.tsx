// Built by Anointed Coder.
//
// NOTIFICATIONS, wired to GET /api/me/notifications. Newest-first list with a
// per-row unread indicator, relative time, and a tap that marks an unread row
// read (POST /api/me/notifications/read { recipientId }). A "Mark all read"
// header action appears while there is an unread count. A row whose linkUrl is
// an internal app path (starts with "/") also routes there on tap; external
// links are never opened. Loading skeleton, error + Retry, a friendly empty
// state, and pull-to-refresh are all handled.

import { RefreshControl, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Screen, EmptyState } from '@/components/ui';
import { StackScreenHeader } from '@/components/StackScreenHeader';
import {
  useNotifications,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
  type AppNotification,
} from '@/lib/api/account';
import { mapNotificationLinkToRoute } from '@/lib/push/register';
import { colors } from '@/lib/theme';
import { cn } from '@/lib/cn';

// Compact relative time, falling back to a short date past a week.
function timeAgo(iso: string): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '';
  const s = Math.floor((Date.now() - t) / 1000);
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  const w = Math.floor(d / 7);
  if (w < 5) return `${w}w ago`;
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

export default function NotificationsScreen() {
  const router = useRouter();
  const query = useNotifications();
  const markRead = useMarkNotificationRead();
  const markAll = useMarkAllNotificationsRead();

  const notifications = query.data?.notifications ?? [];
  const unreadCount = query.data?.unreadCount ?? 0;
  const refreshing = query.isRefetching && !query.isLoading;

  function onRowPress(n: AppNotification) {
    if (!n.readAt) markRead.mutate(n.recipientId);
    // Backend linkUrls are web paths (e.g. /dashboard/wallet, /support). Map
    // them to the real mobile route, exactly like a tapped push notification
    // does, so a deposit / withdrawal row never dead-ends on Unmatched Route.
    // The mapper strips query strings and falls back to /notifications.
    if (n.linkUrl && n.linkUrl.startsWith('/')) {
      router.push(mapNotificationLinkToRoute(n.linkUrl) as never);
    }
  }

  const headerRight =
    unreadCount > 0 ? (
      <Pressable
        onPress={() => markAll.mutate()}
        disabled={markAll.isPending}
        hitSlop={6}
        className={cn(
          'flex-row items-center gap-1 rounded-pill border border-gold-600/30 bg-gold-500/15 px-2.5 py-1.5 active:opacity-80',
          markAll.isPending && 'opacity-60',
        )}
      >
        <Ionicons name="checkmark-done" size={14} color={colors.gold700} />
        <Text className="text-[11px] font-bold text-gold-700">Mark all</Text>
      </Pressable>
    ) : undefined;

  return (
    <Screen
      header={
        <StackScreenHeader
          title="Notifications"
          subtitle={unreadCount > 0 ? `${unreadCount} unread` : 'You are all caught up'}
          right={headerRight}
        />
      }
      contentClassName="px-4 pt-3 gap-3"
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => query.refetch()}
          tintColor={colors.gold600}
        />
      }
    >
      {query.isLoading ? (
        <View className="overflow-hidden rounded-2xl border border-divider bg-paper">
          {[0, 1, 2, 3, 4].map((i) => (
            <View
              key={i}
              className={cn('flex-row items-center gap-3 px-4 py-3.5', i !== 0 && 'border-t border-divider')}
            >
              <View className="h-10 w-10 rounded-full bg-surfaceAlt" />
              <View className="flex-1 gap-1.5">
                <View className="h-3.5 w-32 rounded bg-surfaceAlt" />
                <View className="h-2.5 w-48 rounded bg-surfaceAlt" />
              </View>
            </View>
          ))}
        </View>
      ) : query.isError ? (
        <EmptyState
          icon="cloud-offline"
          title="Could not load notifications"
          message="Something went wrong fetching your notifications. Please try again."
          actionLabel="Retry"
          onAction={() => query.refetch()}
          className="mt-6"
        />
      ) : notifications.length === 0 ? (
        <EmptyState
          icon="notifications-off-outline"
          title="No notifications yet"
          message="Updates about your deposits, withdrawals, bonuses and account will show up here."
          className="mt-6"
        />
      ) : (
        <View className="overflow-hidden rounded-2xl border border-divider bg-paper">
          {notifications.map((n, i) => (
            <NotificationRow
              key={n.recipientId}
              notification={n}
              first={i === 0}
              onPress={() => onRowPress(n)}
            />
          ))}
        </View>
      )}
    </Screen>
  );
}

function NotificationRow({
  notification,
  first,
  onPress,
}: {
  notification: AppNotification;
  first: boolean;
  onPress: () => void;
}) {
  const unread = notification.readAt === null;
  const title = notification.titleEn || notification.titleBn || 'Notification';
  const body = notification.bodyEn || notification.bodyBn || '';

  return (
    <Pressable
      onPress={onPress}
      className={cn(
        'flex-row items-start gap-3 px-4 py-3.5 active:bg-surface',
        !first && 'border-t border-divider',
        unread && 'bg-gold-500/5',
      )}
    >
      <View
        className={cn(
          'h-10 w-10 items-center justify-center rounded-full',
          unread ? 'bg-gold-500/15' : 'bg-surfaceAlt',
        )}
      >
        <Ionicons
          name="notifications"
          size={18}
          color={unread ? colors.gold700 : colors.inkMute}
        />
      </View>

      <View className="flex-1">
        <View className="flex-row items-center gap-2">
          <Text
            className={cn('flex-1 text-sm text-ink', unread ? 'font-black' : 'font-bold')}
            numberOfLines={1}
          >
            {title}
          </Text>
          {unread ? <View className="h-2 w-2 rounded-full bg-hot" /> : null}
        </View>
        {body ? (
          <Text className="mt-0.5 text-[12px] text-ink-soft" numberOfLines={2}>
            {body}
          </Text>
        ) : null}
        <Text className="mt-1 text-[11px] text-ink-mute">{timeAgo(notification.createdAt)}</Text>
      </View>
    </Pressable>
  );
}
