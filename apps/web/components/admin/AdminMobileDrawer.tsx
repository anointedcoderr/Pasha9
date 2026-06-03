// Built by Anointed Coder.
//
// Mobile-only slide-in drawer for the admin sidebar. The desktop
// AdminSidebar is hidden on screens < lg, so without this drawer the
// admin had no way to reach any other admin page on a phone. Uses the
// same GROUPS / icons / labels as AdminSidebar so the menu reads the
// same on every breakpoint, just collapsed behind the topbar
// hamburger.

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import {
  X,
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
  MessageCircle,
} from 'lucide-react';
import { Logo } from '@/components/site/Logo';
import { ROUTES } from '@/lib/constants/routes';
import { useT } from '@/lib/i18n/context';
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
      { key: 'ambassador', href: '/admin/ambassador', icon: Star },
    ],
  },
  {
    labelKey: 'groupLottoRewards',
    items: [
      { key: 'lotto', href: '/admin/lotto', icon: Ticket },
      { key: 'rewards', href: '/admin/rewards', icon: Trophy },
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

export function AdminMobileDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const pathname = usePathname();
  const t = useT();

  // Lock body scroll while open.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  // Auto-close on navigation so the admin does not have to manually
  // dismiss it after every tap.
  useEffect(() => {
    if (open) onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  return (
    <>
      <div
        aria-hidden
        onClick={onClose}
        className={cn(
          'fixed inset-0 z-40 bg-black/45 transition-opacity duration-200 lg:hidden',
          open ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
      />
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-[300px] max-w-[88vw] flex-col bg-brand-paper text-brand-ink shadow-2xl transition-transform duration-200 ease-out lg:hidden',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
        aria-label="Admin navigation"
      >
        <div className="shrink-0 flex items-center justify-between border-b border-brand-divider px-4 py-3">
          <Logo href={ROUTES.admin.home} tone="dark" size="md" />
          <button
            type="button"
            aria-label="Close menu"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-brand-inkMute hover:bg-brand-surface"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <nav className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-4 font-admin text-sm">
          {GROUPS.map((g) => (
            <div key={g.labelKey} className="mb-5">
              <p className="px-3 pb-2 text-[10px] uppercase tracking-[0.18em] text-brand-inkMute">
                {t(`admin.${g.labelKey}`)}
              </p>
              <div className="space-y-1">
                {g.items.map(({ key, href, icon: Icon }) => {
                  const active = pathname === href;
                  return (
                    <Link
                      key={key}
                      href={href}
                      onClick={onClose}
                      className={cn(
                        'group flex items-center gap-3 rounded-lg px-3 py-2 transition',
                        active
                          ? 'bg-brand-yellow-500/12 text-brand-ink shadow-[inset_3px_0_0_#FFCC00]'
                          : 'text-brand-inkSoft hover:bg-brand-surface hover:text-brand-ink',
                      )}
                    >
                      <Icon
                        className={cn(
                          'h-4 w-4',
                          active
                            ? 'text-brand-yellow-700'
                            : 'text-brand-inkMute group-hover:text-brand-yellow-700',
                        )}
                      />
                      <span>{t(`admin.${key}`)}</span>
                      {active ? <span className="ml-auto h-1.5 w-1.5 rounded-full bg-brand-yellow-500" /> : null}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </aside>
    </>
  );
}
