// Built by Anointed Coder.
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
  Briefcase,
  Trophy,
  Star,
  Ticket,
  Globe,
  ShieldCheck,
  BarChart3,
  Sparkles,
  FileCheck,
  Banknote,
  CreditCard,
  SlidersHorizontal,
} from 'lucide-react';
import { Logo } from '@/components/site/Logo';
import { ROUTES } from '@/lib/constants/routes';
import { useT } from '@/lib/i18n/context';
import { BRAND } from '@/lib/constants/brand';
import { cn } from '@/lib/utils/cn';

const GROUPS = [
  {
    labelKey: 'groupOverview',
    items: [
      { key: 'overview', href: ROUTES.admin.home, icon: LayoutDashboard },
    ],
  },
  {
    labelKey: 'groupOperations',
    items: [
      { key: 'deposits', href: ROUTES.admin.deposits, icon: ArrowDownToLine },
      { key: 'withdrawals', href: ROUTES.admin.withdrawals, icon: ArrowUpToLine },
      { key: 'transactions', href: ROUTES.admin.transactions, icon: ReceiptText },
      { key: 'payments', href: ROUTES.admin.payments, icon: Wallet },
      { key: 'payouts', href: ROUTES.admin.payouts, icon: Banknote },
      { key: 'paymentMethods', href: ROUTES.admin.paymentMethods, icon: CreditCard },
      { key: 'withdrawalLimits', href: ROUTES.admin.withdrawalLimits, icon: SlidersHorizontal },
      { key: 'paymentsReconciliation', href: ROUTES.admin.paymentsReconciliation, icon: FileCheck },
    ],
  },
  {
    labelKey: 'groupUsersAndMoney',
    items: [
      { key: 'users', href: ROUTES.admin.users, icon: Users },
      { key: 'balance', href: ROUTES.admin.balance, icon: Wallet },
      { key: 'referrals', href: ROUTES.admin.referrals, icon: Network },
    ],
  },
  {
    labelKey: 'groupBonusAndAffiliate',
    items: [
      { key: 'bonuses', href: ROUTES.admin.bonuses, icon: Gift },
      { key: 'affiliate', href: ROUTES.admin.affiliate, icon: Briefcase },
      { key: 'affiliateTiers', href: ROUTES.admin.affiliateTiers, icon: Trophy },
    ],
  },
  {
    labelKey: 'groupContentAndMedia',
    items: [
      { key: 'website', href: ROUTES.admin.website, icon: Globe },
      { key: 'banners', href: ROUTES.admin.banners, icon: ImageIcon },
      { key: 'popups', href: ROUTES.admin.popups, icon: Megaphone },
      { key: 'promoText', href: ROUTES.admin.promoText, icon: Type },
      { key: 'homepage', href: ROUTES.admin.homepage, icon: Home },
      { key: 'ambassador', href: '/admin/ambassador', icon: Star },
    ],
  },
  {
    labelKey: 'groupLottoRewards',
    items: [
      { key: 'lotto', href: '/admin/lotto', icon: Ticket },
      { key: 'rewards', href: '/admin/rewards', icon: Trophy },
    ],
  },
  {
    labelKey: 'groupGames',
    items: [
      { key: 'categories', href: ROUTES.admin.categories, icon: Layers },
      { key: 'providers', href: ROUTES.admin.providers, icon: Boxes },
    ],
  },
  {
    labelKey: 'groupReportsAndMarketing',
    items: [
      { key: 'reports', href: ROUTES.admin.reports, icon: BarChart3 },
      { key: 'marketing', href: ROUTES.admin.marketing, icon: Sparkles },
    ],
  },
  {
    labelKey: 'groupSecurityAndStaff',
    items: [
      { key: 'security', href: ROUTES.admin.security, icon: ShieldCheck },
      { key: 'staff', href: ROUTES.admin.staff, icon: Users },
    ],
  },
  {
    labelKey: 'groupSystem',
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
    <aside className="hidden h-screen w-[260px] shrink-0 flex-col border-r border-brand-divider bg-brand-paper lg:flex">
      <div className="border-b border-brand-divider px-5 py-5">
        <Logo href={ROUTES.admin.home} tone="dark" size="md" />
        <p className="mt-2 text-[10px] uppercase tracking-[0.18em] text-brand-yellow-700">{t('admin.title')}</p>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4 font-admin text-sm">
        {GROUPS.map((g) => (
          <div key={g.labelKey} className="mb-5">
            <p className="px-3 pb-2 text-[10px] uppercase tracking-[0.18em] text-brand-inkMute">{t(`admin.${g.labelKey}`)}</p>
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
                        ? 'bg-brand-yellow-500/12 text-brand-ink shadow-[inset_3px_0_0_#FFCC00]'
                        : 'text-brand-inkSoft hover:bg-brand-surface hover:text-brand-ink',
                    )}
                  >
                    <Icon className={cn('h-4 w-4', active ? 'text-brand-yellow-700' : 'text-brand-inkMute group-hover:text-brand-yellow-700')} />
                    <span>{t(`admin.${key}`)}</span>
                    {active ? <span className="ml-auto h-1.5 w-1.5 rounded-full bg-brand-yellow-500" /> : null}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t border-brand-divider px-5 py-4">
        <p className="text-[11px] text-brand-inkMute">{BRAND.developer.label}</p>
        <p className="mt-1 text-xs text-brand-inkSoft">
          <a href={`mailto:${BRAND.developer.email}`} className="hover:text-brand-ink">{BRAND.developer.email}</a>
        </p>
        <div className="mt-3 flex items-center gap-2">
          <a
            href={BRAND.developer.telegram}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-brand-divider bg-brand-surface px-2 py-1 text-[11px] text-brand-inkSoft hover:text-brand-ink"
          >
            <Send className="h-3 w-3 text-[#229ED9]" /> Telegram
          </a>
          <a
            href={BRAND.developer.whatsapp}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-brand-divider bg-brand-surface px-2 py-1 text-[11px] text-brand-inkSoft hover:text-brand-ink"
          >
            <MessageCircle className="h-3 w-3 text-[#25D366]" /> WhatsApp
          </a>
        </div>
      </div>
    </aside>
  );
}
