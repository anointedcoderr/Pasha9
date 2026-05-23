// Built by Anointed Coder.
// Slide-down notification panel reachable from the header bell. In M1 it
// renders a clean empty state and (when the visitor is logged in) a
// system "welcome" notification. M2 will wire it to a real notification
// feed.

'use client';

import * as Dialog from '@radix-ui/react-dialog';
import { Bell, X, Megaphone, CheckCircle2 } from 'lucide-react';
import { useLang } from '@/lib/i18n/context';

interface Props {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  isLoggedIn: boolean;
}

export function NotificationDrawer({ open, onOpenChange, isLoggedIn }: Props) {
  const { lang } = useLang();

  const items = isLoggedIn
    ? [
        {
          icon: Megaphone,
          title: lang === 'bn' ? 'পাশা ৯ এ স্বাগতম' : 'Welcome to Pasha 9',
          body:
            lang === 'bn'
              ? 'অ্যাকাউন্ট সফলভাবে তৈরি হয়েছে। প্রথম ডিপোজিটে বোনাস দাবি করুন।'
              : 'Your account is ready. Make your first deposit to claim the welcome bonus.',
          time: lang === 'bn' ? 'এইমাত্র' : 'Just now',
        },
        {
          icon: CheckCircle2,
          title: lang === 'bn' ? 'নিরাপত্তা চেক' : 'Security check',
          body:
            lang === 'bn'
              ? 'অ্যাকাউন্ট সুরক্ষায় ২FA চালু করার পরামর্শ দেওয়া হচ্ছে।'
              : 'Consider enabling two-factor authentication for extra protection.',
          time: lang === 'bn' ? '২ ঘণ্টা আগে' : '2h ago',
        },
      ]
    : [];

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/45 backdrop-blur-sm" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed right-2 top-2 z-50 w-[min(360px,calc(100vw-1rem))] overflow-hidden rounded-2xl border border-brand-divider bg-brand-paper shadow-2xl outline-none"
        >
          <div className="flex items-center justify-between border-b border-brand-divider bg-brand-surface px-4 py-3">
            <Dialog.Title className="flex items-center gap-2 text-sm font-bold text-brand-ink">
              <Bell className="h-4 w-4 text-brand-yellow-600" />
              {lang === 'bn' ? 'নোটিফিকেশন' : 'Notifications'}
            </Dialog.Title>
            <Dialog.Close
              aria-label={lang === 'bn' ? 'বন্ধ' : 'Close'}
              className="inline-flex h-7 w-7 items-center justify-center rounded-md text-brand-inkMute transition hover:bg-brand-paper hover:text-brand-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue-500/40"
            >
              <X className="h-4 w-4" />
            </Dialog.Close>
          </div>
          <div className="max-h-[60vh] overflow-y-auto">
            {items.length === 0 ? (
              <div className="px-4 py-10 text-center">
                <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-surface text-brand-inkMute">
                  <Bell className="h-5 w-5" />
                </span>
                <p className="mt-3 text-sm font-semibold text-brand-ink">
                  {lang === 'bn' ? 'এখনো কোনো নোটিফিকেশন নেই' : 'No notifications yet'}
                </p>
                <p className="mt-1 text-xs text-brand-inkMute">
                  {isLoggedIn
                    ? lang === 'bn'
                      ? 'নতুন অ্যাকাউন্ট কার্যক্রম এখানে দেখা যাবে।'
                      : 'New account activity will appear here.'
                    : lang === 'bn'
                      ? 'লগইন করলে আপনার ব্যক্তিগত আপডেট এখানে দেখা যাবে।'
                      : 'Log in to see personal updates here.'}
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-brand-divider">
                {items.map((item, i) => {
                  const Icon = item.icon;
                  return (
                    <li key={i} className="flex items-start gap-3 px-4 py-3">
                      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-yellow-500/15 text-brand-yellow-600">
                        <Icon className="h-4 w-4" />
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-brand-ink">{item.title}</p>
                        <p className="mt-0.5 text-xs leading-snug text-brand-inkSoft">{item.body}</p>
                        <p className="mt-1 text-[11px] text-brand-inkMute">{item.time}</p>
                      </div>
                    </li>
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
