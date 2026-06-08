// Built by Anointed Coder.
//
// Slide-down notification panel reachable from the header bell. Reads
// the live in-app feed from /api/me/notifications when the visitor is
// signed in. Tapping an item marks it read and (when linkUrl is set)
// routes the visitor to the target page. Mark-all is one tap. A small
// red dot on the header bell tracks unreadCount via the same fetch.

'use client';

import { useCallback, useEffect, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Bell, X, Megaphone, CheckCircle2 } from 'lucide-react';
import { useLang } from '@/lib/i18n/context';

interface FeedItem {
  recipientId: string;
  id: string;
  titleEn: string;
  titleBn: string | null;
  bodyEn: string | null;
  bodyBn: string | null;
  linkUrl: string | null;
  imageUrl: string | null;
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
                  return (
                    <div key={item.recipientId} onClick={onClick} role="button" tabIndex={0}>
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
