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
  HeartHandshake,
  Bell,
  Plug,
  Gamepad2,
  Wallet as WalletIcon,
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
      { key: 'depositNotice', href: ROUTES.admin.depositNotice, icon: Bell },
      { key: 'depositBonusTiers', href: ROUTES.admin.depositBonusTiers, icon: Gift },
    ],
  },
  {
    labelKey: 'groupUsersAndMoney',
    items: [
      { key: 'users', href: ROUTES.admin.users, icon: Users },
      { key: 'balance', href: ROUTES.admin.balance, icon: Wallet },
      { key: 'referrals', href: ROUTES.admin.referrals, icon: Network },
      { key: 'referralClaims', href: ROUTES.admin.referralClaims, icon: Wallet },
      { key: 'recovery', href: ROUTES.admin.recovery, icon: HeartHandshake },
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
      { key: 'homepageSections', href: ROUTES.admin.homepageSections, icon: Layers },
      { key: 'homepageBlocks', href: ROUTES.admin.homepageBlocks, icon: Layers },
      { key: 'ambassador', href: '/admin/ambassador', icon: Star },
      { key: 'brandAmbassadors', href: ROUTES.admin.brandAmbassadors, icon: Star },
      { key: 'sponsors', href: ROUTES.admin.sponsors, icon: Trophy },
      { key: 'publicPaymentMethods', href: ROUTES.admin.publicPaymentMethods, icon: CreditCard },
    ],
  },
  {
    labelKey: 'groupLottoRewards',
    items: [
      { key: 'lotto', href: '/admin/lotto', icon: Ticket },
      { key: 'rewards', href: '/admin/rewards', icon: Trophy },
      { key: 'rewardClaims', href: ROUTES.admin.rewardClaims, icon: Gift },
      { key: 'bettingPass', href: ROUTES.admin.bettingPass, icon: Sparkles },
      { key: 'spinSegments', href: ROUTES.admin.spinSegments, icon: Sparkles },
      { key: 'nativeGames', href: ROUTES.admin.nativeGames, icon: Gamepad2 },
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
      { key: 'notifications', href: ROUTES.admin.notifications, icon: Bell },
      { key: 'tracking', href: ROUTES.admin.tracking, icon: BarChart3 },
      { key: 'whatsapp', href: ROUTES.admin.whatsapp, icon: MessageCircle },
    ],
  },
  {
    labelKey: 'groupSecurityAndStaff',
    items: [
      { key: 'security', href: ROUTES.admin.security, icon: ShieldCheck },
      { key: 'passwordResets', href: ROUTES.admin.passwordResets, icon: FileKey2 },
      { key: 'staff', href: ROUTES.admin.staff, icon: Users },
    ],
  },
  {
    labelKey: 'groupSystem',
    items: [
      { key: 'integrations', href: ROUTES.admin.integrations, icon: Plug },
      { key: 'depositPrompt', href: ROUTES.admin.depositPrompt, icon: WalletIcon },
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
    <aside className="hidden h-[100dvh] w-[260px] shrink-0 flex-col border-r border-brand-divider bg-brand-paper lg:flex">
      <div className="shrink-0 border-b border-brand-divider px-5 py-5">
        <Logo href={ROUTES.admin.home} tone="dark" size="md" />
        <p className="mt-2 text-[10px] uppercase tracking-[0.18em] text-brand-yellow-700">{t('admin.title')}</p>
      </div>

      <nav className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-4 font-admin text-sm">
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

      <div className="shrink-0 border-t border-brand-divider px-5 py-4">
        <p className="text-[11px] text-brand-inkMute">
          Built by{' '}
          <a
            href={BRAND.developer.website}
            target="_blank"
            rel="noreferrer"
            className="font-semibold text-brand-inkSoft underline-offset-2 hover:text-brand-ink hover:underline"
          >
            {BRAND.developer.name}
          </a>
        </p>
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
