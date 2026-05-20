'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  Wallet,
  ArrowDownToLine,
  ArrowUpToLine,
  ReceiptText,
  Network,
  Gift,
  Image as ImageIcon,
  Megaphone,
  Layers,
  Boxes,
  Home,
  Type,
  LifeBuoy,
  Settings,
  ClipboardList,
  FileKey2,
  Send,
  MessageCircle,
} from 'lucide-react';
import { Logo } from '@/components/site/Logo';
import { ROUTES } from '@/lib/constants/routes';
import { useT } from '@/lib/i18n/context';
import { BRAND } from '@/lib/constants/brand';
import { cn } from '@/lib/utils/cn';

const GROUPS = [
  {
    label: 'Overview',
    items: [
      { key: 'overview', href: ROUTES.admin.home, icon: LayoutDashboard },
    ],
  },
  {
    label: 'Users & Money',
    items: [
      { key: 'users', href: ROUTES.admin.users, icon: Users },
      { key: 'balance', href: ROUTES.admin.balance, icon: Wallet },
      { key: 'deposits', href: ROUTES.admin.deposits, icon: ArrowDownToLine },
      { key: 'withdrawals', href: ROUTES.admin.withdrawals, icon: ArrowUpToLine },
      { key: 'transactions', href: ROUTES.admin.transactions, icon: ReceiptText },
      { key: 'referrals', href: ROUTES.admin.referrals, icon: Network },
      { key: 'bonuses', href: ROUTES.admin.bonuses, icon: Gift },
    ],
  },
  {
    label: 'Content',
    items: [
      { key: 'banners', href: ROUTES.admin.banners, icon: ImageIcon },
      { key: 'popups', href: ROUTES.admin.popups, icon: Megaphone },
      { key: 'categories', href: ROUTES.admin.categories, icon: Layers },
      { key: 'providers', href: ROUTES.admin.providers, icon: Boxes },
      { key: 'homepage', href: ROUTES.admin.homepage, icon: Home },
      { key: 'promoText', href: ROUTES.admin.promoText, icon: Type },
    ],
  },
  {
    label: 'System',
    items: [
      { key: 'support', href: ROUTES.admin.support, icon: LifeBuoy },
      { key: 'settings', href: ROUTES.admin.settings, icon: Settings },
      { key: 'activity', href: ROUTES.admin.activity, icon: ClipboardList },
      { key: 'handover', href: ROUTES.admin.handover, icon: FileKey2 },
    ],
  },
] as const;

export function AdminSidebar() {
  const pathname = usePathname();
  const t = useT();

  return (
    <aside className="hidden h-screen w-[260px] shrink-0 flex-col border-r border-neon/10 bg-base-deep/85 backdrop-blur lg:flex">
      <div className="border-b border-neon/10 px-5 py-5">
        <Logo href={ROUTES.admin.home} />
        <p className="mt-2 text-[10px] uppercase tracking-[0.18em] text-gold-300">{t('admin.title')}</p>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4 font-admin text-sm">
        {GROUPS.map((g) => (
          <div key={g.label} className="mb-5">
            <p className="px-3 pb-2 text-[10px] uppercase tracking-[0.18em] text-ink-lo">{g.label}</p>
            <div className="space-y-1">
              {g.items.map(({ key, href, icon: Icon }) => {
                const active = pathname === href;
                return (
                  <Link
                    key={key}
                    href={href}
                    className={cn(
                      'group flex items-center gap-3 rounded-lg px-3 py-2 transition',
                      active
                        ? 'bg-gradient-to-r from-neon/15 to-transparent text-ink-hi'
                        : 'text-ink-mid hover:bg-white/5 hover:text-ink-hi',
                    )}
                  >
                    <Icon className={cn('h-4 w-4', active ? 'text-neon' : 'text-ink-mid group-hover:text-neon')} />
                    <span>{t(`admin.${key}`)}</span>
                    {active ? <span className="ml-auto h-1.5 w-1.5 rounded-full bg-neon shadow-glow-neon" /> : null}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t border-neon/10 px-5 py-4">
        <p className="text-[11px] text-ink-lo">{BRAND.builtBy}</p>
        <p className="mt-1 text-xs text-ink-mid">
          <a href={`mailto:${BRAND.builderEmail}`} className="hover:text-ink-hi">{BRAND.builderEmail}</a>
        </p>
        <div className="mt-3 flex items-center gap-2">
          <a
            href={BRAND.telegram}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-neon/15 bg-base-panel/60 px-2 py-1 text-[11px] text-ink-mid hover:text-ink-hi"
          >
            <Send className="h-3 w-3 text-[#229ED9]" /> Telegram
          </a>
          <a
            href={BRAND.whatsapp}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-neon/15 bg-base-panel/60 px-2 py-1 text-[11px] text-ink-mid hover:text-ink-hi"
          >
            <MessageCircle className="h-3 w-3 text-[#25D366]" /> WhatsApp
          </a>
        </div>
      </div>
    </aside>
  );
}
