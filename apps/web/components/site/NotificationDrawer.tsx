// Built by Anointed Coder.
//
// Slide-down notification panel reachable from the header bell. Reads
// the live in-app feed from /api/me/notifications when the visitor is
// signed in. Tapping an item marks it read and (when linkUrl is set)
// routes the visitor to the target page. Mark-all is one tap. A small
// red dot on the header bell tracks unreadCount via the same fetch.

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Bell, X, Megaphone, CheckCircle2, BellRing, BellOff } from 'lucide-react';
import { useLang } from '@/lib/i18n/context';
import { checkPushSupport, disableDevicePush, enableDevicePush, getNotificationPermission } from '@/lib/push/client';

interface FeedItem {
  recipientId: string;
  id: string;
  titleEn: string;
  titleBn: string | null;
  bodyEn: string | null;
  bodyBn: string | null;
  linkUrl: string | null;
  imageUrl: string | null;
  soundUrl: string | null;
  priority: string;
  readAt: string | null;
  createdAt: string;
}

interface Props {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  isLoggedIn: boolean;
}

const formatRelative = (iso: string, lang: 'en' | 'bn'): string => {
  const ts = new Date(iso).getTime();
  const diff = Date.now() - ts;
  if (diff < 60_000) return lang === 'bn' ? 'এইমাত্র' : 'Just now';
  if (diff < 60 * 60_000) return `${Math.floor(diff / 60_000)}m`;
  if (diff < 24 * 60 * 60_000) return `${Math.floor(diff / 3_600_000)}h`;
  return `${Math.floor(diff / 86_400_000)}d`;
};

export function NotificationDrawer({ open, onOpenChange, isLoggedIn }: Props) {
  const { lang } = useLang();
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pushSupport, setPushSupport] = useState<'unknown' | ReturnType<typeof checkPushSupport>>('unknown');
  const [permission, setPermission] = useState<NotificationPermission | 'unknown'>('unknown');
  const [pushBusy, setPushBusy] = useState(false);
  const [pushFlash, setPushFlash] = useState<string | null>(null);
  const [testBusy, setTestBusy] = useState(false);
  const [vapidConfigured, setVapidConfigured] = useState<boolean | null>(null);
  const [vapidMissing, setVapidMissing] = useState<string[]>([]);
  const [vapidPublicKeyPresent, setVapidPublicKeyPresent] = useState<boolean | null>(null);
  const [swRegistered, setSwRegistered] = useState<boolean | null>(null);
  const [subscribed, setSubscribed] = useState<boolean | null>(null);
  const [diagOpen, setDiagOpen] = useState(false);
  const lastNotificationId = useRef<string | null>(null);

  useEffect(() => {
    setPushSupport(checkPushSupport());
    setPermission(getNotificationPermission());
  }, []);

  // VAPID status probe + service worker registration probe. Both run
  // when the drawer opens so the diagnostics panel reflects live
  // state. Failure paths set the value to false rather than throw so
  // the drawer never crashes when the server is offline.
  useEffect(() => {
    if (!open) return;
    fetch('/api/content/push-config', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        setVapidConfigured(Boolean(j?.configured));
        setVapidPublicKeyPresent(Boolean(j?.publicKey));
        setVapidMissing(Array.isArray(j?.missing) ? (j.missing as string[]) : []);
      })
      .catch(() => {
        setVapidConfigured(false);
        setVapidPublicKeyPresent(false);
        setVapidMissing([]);
      });
    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistration('/').then(async (reg) => {
        setSwRegistered(Boolean(reg));
        if (reg) {
          try {
            const sub = await reg.pushManager.getSubscription();
            setSubscribed(Boolean(sub));
          } catch {
            setSubscribed(false);
          }
        } else {
          setSubscribed(false);
        }
      }).catch(() => { setSwRegistered(false); setSubscribed(false); });
    } else {
      setSwRegistered(false);
      setSubscribed(false);
    }
  }, [open]);

  const isIos = typeof navigator !== 'undefined' && /iphone|ipad|ipod/i.test(navigator.userAgent);
  const isStandalone = typeof window !== 'undefined' && (
    window.matchMedia?.('(display-mode: standalone)').matches
    || (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );

  const sendTestPush = async () => {
    setTestBusy(true);
    setPushFlash(null);
    try {
      const res = await fetch('/api/me/push-subscriptions/test', {
        method: 'POST',
        credentials: 'include',
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setPushFlash(data?.message ?? 'Test send failed');
        return;
      }
      if (data?.ok) {
        setPushFlash(lang === 'bn' ? `টেস্ট পাঠানো হয়েছে: ${data.sent}/${data.attempted}` : `Test sent: ${data.sent}/${data.attempted}`);
      } else {
        setPushFlash(data?.message ?? (lang === 'bn' ? 'টেস্ট পাঠানো যায়নি।' : 'Test could not be sent.'));
      }
    } catch (err) {
      setPushFlash(err instanceof Error ? err.message : 'Failed');
    } finally {
      setTestBusy(false);
    }
  };

  // Play the configured sound (if any) for the newest in-app notification
  // received while the drawer is open. Browsers gate Audio.play() on a
  // prior user gesture; the very first time the drawer opens after a
  // page load may stay silent, which is the documented platform
  // behaviour rather than a fault.
  useEffect(() => {
    if (!items.length) return;
    const top = items[0];
    if (!top || !top.soundUrl) return;
    if (lastNotificationId.current === top.id) return;
    lastNotificationId.current = top.id;
    try {
      const audio = new Audio(top.soundUrl);
      audio.volume = 0.8;
      audio.play().catch(() => { /* autoplay blocked is expected on cold pages */ });
    } catch { /* swallow */ }
  }, [items]);

  const fetchFeed = useCallback(async () => {
    if (!isLoggedIn) {
      setItems([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/me/notifications', { cache: 'no-store', credentials: 'include' });
      if (res.status === 401) {
        setItems([]);
        return;
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message ?? 'Failed');
      setItems(Array.isArray(data.notifications) ? (data.notifications as FeedItem[]) : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [isLoggedIn]);

  useEffect(() => {
    if (open) fetchFeed();
  }, [open, fetchFeed]);

  const markRead = async (recipientId: string) => {
    setItems((prev) => prev.map((it) => (it.recipientId === recipientId ? { ...it, readAt: it.readAt ?? new Date().toISOString() } : it)));
    try {
      await fetch('/api/me/notifications/read', {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ recipientId }),
      });
      window.dispatchEvent(new CustomEvent('pasha9:notification-refresh'));
    } catch { /* swallow; next fetch will reconcile */ }
  };

  const markAllRead = async () => {
    setItems((prev) => prev.map((it) => ({ ...it, readAt: it.readAt ?? new Date().toISOString() })));
    try {
      await fetch('/api/me/notifications/read', {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ all: true }),
      });
      window.dispatchEvent(new CustomEvent('pasha9:notification-refresh'));
    } catch { /* swallow */ }
  };

  const hasUnread = items.some((it) => !it.readAt);

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/45 backdrop-blur-sm" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed right-2 top-2 z-50 w-[min(380px,calc(100vw-1rem))] overflow-hidden rounded-2xl border border-brand-divider bg-brand-paper shadow-2xl outline-none"
        >
          <div className="flex items-center justify-between border-b border-brand-divider bg-brand-surface px-4 py-3">
            <Dialog.Title className="flex items-center gap-2 text-sm font-bold text-brand-ink">
              <Bell className="h-4 w-4 text-brand-yellow-600" />
              {lang === 'bn' ? 'নোটিফিকেশন' : 'Notifications'}
            </Dialog.Title>
            <div className="flex items-center gap-1">
              {isLoggedIn && hasUnread ? (
                <button
                  type="button"
                  onClick={markAllRead}
                  className="rounded-md px-2 py-1 text-[11px] font-semibold text-brand-yellow-700 transition hover:bg-brand-paper"
                >
                  {lang === 'bn' ? 'সব পঠিত' : 'Mark all read'}
                </button>
              ) : null}
              <Dialog.Close
                aria-label={lang === 'bn' ? 'বন্ধ' : 'Close'}
                className="inline-flex h-7 w-7 items-center justify-center rounded-md text-brand-inkMute transition hover:bg-brand-paper hover:text-brand-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue-500/40"
              >
                <X className="h-4 w-4" />
              </Dialog.Close>
            </div>
          </div>
          {isLoggedIn ? (
            <div className="border-b border-brand-divider bg-brand-paper px-4 py-2">
              {pushSupport !== 'supported' ? (
                <div className="text-[11px] text-brand-inkMute">
                  {pushSupport === 'no_window' ? null : isIos && !isStandalone
                    ? (lang === 'bn'
                        ? 'iPhone-এ ডিভাইস পুশ পেতে সাইটটি Add to Home Screen করে চালান। Safari ট্যাবে পুশ চলবে না।'
                        : 'Add this site to your iPhone Home Screen and open it from there to receive device push. Safari tabs do not support push on iOS.')
                    : (lang === 'bn'
                        ? 'আপনার ব্রাউজার ডিভাইস পুশ সাপোর্ট করে না।'
                        : 'Your browser does not support browser push.')}
                </div>
              ) : (
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[12px] font-semibold text-brand-ink">
                      {lang === 'bn' ? 'ডিভাইস নোটিফিকেশন' : 'Device notifications'}
                    </p>
                    <p className="truncate text-[10px] text-brand-inkMute">
                      {permission === 'granted'
                        ? (lang === 'bn' ? 'সক্রিয়। ব্রাউজার ব্যাকগ্রাউন্ডে থাকলেও পাবেন।' : 'On. You will receive these even when the tab is in the background.')
                        : permission === 'denied'
                          ? (lang === 'bn' ? 'ব্রাউজার থেকে অনুমতি দিন।' : 'Browser blocked notifications. Allow in browser settings.')
                          : (lang === 'bn' ? 'সক্রিয় করতে ট্যাপ করুন।' : 'Tap to enable browser/device notifications.')}
                    </p>
                    {pushFlash ? <p className="mt-0.5 truncate text-[10px] text-brand-yellow-700">{pushFlash}</p> : null}
                  </div>
              <button
                type="button"
                disabled={pushBusy}
                onClick={async () => {
                  setPushBusy(true);
                  setPushFlash(null);
                  try {
                    if (permission === 'granted') {
                      await disableDevicePush();
                      setPermission('default');
                      setPushFlash(lang === 'bn' ? 'বন্ধ করা হয়েছে।' : 'Disabled.');
                    } else {
                      const result = await enableDevicePush();
                      if (result.ok) {
                        setPermission('granted');
                        setPushFlash(lang === 'bn' ? 'সক্রিয় হয়েছে।' : 'Enabled.');
                      } else {
                        setPushFlash(result.message);
                      }
                    }
                  } finally {
                    setPushBusy(false);
                  }
                }}
                className={`inline-flex h-8 items-center gap-1 rounded-lg border px-3 text-[11px] font-bold uppercase tracking-wider transition ${permission === 'granted' ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-brand-yellow-500 bg-brand-yellow-50 text-brand-yellow-700'}`}
              >
                {permission === 'granted' ? (
                  <>
                    <BellOff className="h-3 w-3" />
                    {lang === 'bn' ? 'বন্ধ' : 'Disable'}
                  </>
                ) : (
                  <>
                    <BellRing className="h-3 w-3" />
                    {lang === 'bn' ? 'সক্রিয় করুন' : 'Enable'}
                  </>
                )}
              </button>
                </div>
              )}
              {pushSupport === 'supported' ? (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {permission === 'granted' ? (
                    <button
                      type="button"
                      onClick={sendTestPush}
                      disabled={testBusy}
                      className="inline-flex h-7 items-center rounded-md border border-brand-divider bg-brand-paper px-2 text-[10px] font-semibold text-brand-ink hover:border-brand-yellow-500 disabled:opacity-60"
                    >
                      {testBusy ? (lang === 'bn' ? 'পাঠাচ্ছি...' : 'Sending...') : (lang === 'bn' ? 'টেস্ট পুশ পাঠান' : 'Send test push')}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => setDiagOpen((v) => !v)}
                    className="text-[10px] font-semibold text-brand-yellow-700 hover:underline"
                  >
                    {diagOpen ? (lang === 'bn' ? 'লুকান' : 'Hide details') : (lang === 'bn' ? 'বিস্তারিত' : 'Diagnostics')}
                  </button>
                </div>
              ) : null}
              {diagOpen ? (
                <ul className="mt-2 space-y-0.5 rounded-md border border-brand-divider bg-brand-surface p-2 text-[10px] text-brand-inkMute">
                  <li>Browser supports push: {pushSupport === 'supported' ? 'yes' : 'no'}</li>
                  <li>Service worker registered: {swRegistered == null ? '...' : swRegistered ? 'yes' : 'no'}</li>
                  <li>Notification permission: {permission === 'unknown' ? '...' : permission}</li>
                  <li>Device subscribed: {subscribed == null ? '...' : subscribed ? 'yes' : 'no'}</li>
                  <li>VAPID public key available: {vapidPublicKeyPresent == null ? '...' : vapidPublicKeyPresent ? 'yes' : 'no'}</li>
                  <li>VAPID configured (server): {vapidConfigured == null ? '...' : vapidConfigured ? 'yes' : 'no'}</li>
                  {vapidMissing.length > 0 ? (
                    <li className="text-amber-700">Missing env: {vapidMissing.join(', ')}</li>
                  ) : null}
                  {isIos ? <li>iOS PWA required: {isStandalone ? 'installed' : 'add to home screen'}</li> : null}
                  {vapidConfigured === false ? (
                    <li className="mt-1 text-[10px] text-brand-inkMute">
                      Set VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY and VAPID_SUBJECT in the server .env, then restart with pm2 restart pasha9-web --update-env.
                    </li>
                  ) : null}
                </ul>
              ) : null}
            </div>
          ) : null}
          <div className="max-h-[60vh] overflow-y-auto">
            {!isLoggedIn ? (
              <EmptyHero
                title={lang === 'bn' ? 'লগইন করুন' : 'Log in to see notifications'}
                body={lang === 'bn' ? 'ব্যক্তিগত আপডেট দেখতে লগইন করুন।' : 'Personal updates appear here once you sign in.'}
              />
            ) : loading ? (
              <p className="px-4 py-6 text-center text-sm text-brand-inkMute">{lang === 'bn' ? 'লোড...' : 'Loading...'}</p>
            ) : error ? (
              <p className="px-4 py-6 text-center text-sm text-rose-600">{error}</p>
            ) : items.length === 0 ? (
              <EmptyHero
                title={lang === 'bn' ? 'এখনো কোনো নোটিফিকেশন নেই' : 'No notifications yet'}
                body={lang === 'bn' ? 'নতুন অ্যাকাউন্ট কার্যক্রম এখানে দেখা যাবে।' : 'New account activity will appear here.'}
              />
            ) : (
              <ul className="divide-y divide-brand-divider">
                {items.map((item) => {
                  const title = lang === 'bn' && item.titleBn ? item.titleBn : item.titleEn;
                  const body = lang === 'bn' && item.bodyBn ? item.bodyBn : item.bodyEn;
                  const unread = !item.readAt;
                  const Icon = item.priority === 'high' ? Megaphone : CheckCircle2;
                  const inner = (
                    <li
                      className={`flex cursor-pointer items-start gap-3 px-4 py-3 transition hover:bg-brand-surface ${unread ? 'bg-brand-surface/50' : ''}`}
                    >
                      <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${unread ? 'bg-brand-yellow-500/20 text-brand-yellow-700' : 'bg-brand-divider text-brand-inkMute'}`}>
                        <Icon className="h-4 w-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-brand-ink">{title}</p>
                        {body ? <p className="mt-0.5 text-xs leading-snug text-brand-inkSoft whitespace-pre-line">{body}</p> : null}
                        <p className="mt-1 text-[11px] text-brand-inkMute">{formatRelative(item.createdAt, lang)}</p>
                      </div>
                      {unread ? <span aria-hidden className="mt-1 inline-block h-2 w-2 shrink-0 rounded-full bg-brand-hot" /> : null}
                    </li>
                  );
                  const onClick = () => {
                    void markRead(item.recipientId);
                    if (item.linkUrl) window.location.assign(item.linkUrl);
                  };
                  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onClick();
                    }
                  };
                  return (
                    <div
                      key={item.recipientId}
                      onClick={onClick}
                      onKeyDown={onKeyDown}
                      role="button"
                      tabIndex={0}
                      aria-label={title}
                      className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue-500/40"
                    >
                      {inner}
                    </div>
                  );
                })}
              </ul>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function EmptyHero({ title, body }: { title: string; body: string }) {
  return (
    <div className="px-4 py-10 text-center">
      <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-surface text-brand-inkMute">
        <Bell className="h-5 w-5" />
      </span>
      <p className="mt-3 text-sm font-semibold text-brand-ink">{title}</p>
      <p className="mt-1 text-xs text-brand-inkMute">{body}</p>
    </div>
  );
}
