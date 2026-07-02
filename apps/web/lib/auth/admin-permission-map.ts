// Built by Anointed Coder.
//
// Central permission map for the admin shell.
//
// Each entry maps a /admin route prefix to the permission key the
// visiting staff member must hold to access it. The same map drives:
//
//   1. AdminSidebar + AdminMobileDrawer filtering (UI hides items
//      the visitor cannot reach)
//   2. The admin shell layout's pathname gate (URL access without
//      the right permission is redirected to /admin?forbidden=1)
//   3. The runtime check used by individual page wrappers when a
//      page needs more than the prefix match offers
//
// Super admins bypass the map entirely (the layout check returns
// early for role==='super_admin'). API routes already enforce their
// own ensurePermission() call; the map exists so a staff visitor
// never SEES a page they cannot use.
//
// The match strategy is "longest prefix wins" so '/admin/promo-codes'
// can be assigned its own permission distinct from '/admin/promotions',
// while shorter prefixes still catch nested routes (e.g.
// '/admin/users/[id]' matches '/admin/users').

export interface AdminPermissionEntry {
  prefix: string;
  permission: string;
}

// Order matters only for readability; the resolver picks the longest
// matching prefix at runtime.
export const ADMIN_PERMISSION_MAP: AdminPermissionEntry[] = [
  // Overview / dashboard is open to anyone with an admin / staff role.
  { prefix: '/admin', permission: '*' },

  // Operations
  { prefix: '/admin/deposits', permission: 'deposits.read' },
  { prefix: '/admin/withdrawals', permission: 'withdrawals.read' },
  { prefix: '/admin/transactions', permission: 'transactions.read' },
  { prefix: '/admin/payments', permission: 'payments.read' },
  { prefix: '/admin/payouts', permission: 'payouts.read' },
  { prefix: '/admin/payment-methods', permission: 'payment_methods.read' },
  { prefix: '/admin/withdrawal-limits', permission: 'withdrawals.read' },
  { prefix: '/admin/payments-reconciliation', permission: 'payments.read' },
  { prefix: '/admin/deposit-notice', permission: 'settings.write' },
  { prefix: '/admin/deposit-bonus-tiers', permission: 'bonuses.write' },

  // Users + balance + referral
  { prefix: '/admin/users', permission: 'users.read' },
  // The balance page's core mutation (/api/admin/users/[id]/balance)
  // checks users.balance.adjust, so the page gate matches it.
  { prefix: '/admin/balance', permission: 'users.balance.adjust' },
  // VIP Club tier ladder + application queue; tiers API checks
  // settings.write (same perm as the affiliate tier editor).
  { prefix: '/admin/vip', permission: 'settings.write' },
  { prefix: '/admin/referrals', permission: 'referrals.read' },
  { prefix: '/admin/referral-claims', permission: 'referrals.write' },
  { prefix: '/admin/recovery', permission: 'recovery.write' },

  // Bonuses + promotions
  { prefix: '/admin/bonuses', permission: 'bonuses.read' },
  { prefix: '/admin/promotions', permission: 'bonuses.write' },
  { prefix: '/admin/promotions/banners', permission: 'bonuses.write' },
  { prefix: '/admin/promo-codes', permission: 'bonuses.write' },
  { prefix: '/admin/promo-text', permission: 'settings.write' },
  { prefix: '/admin/affiliate', permission: 'affiliate.read' },
  { prefix: '/admin/affiliate-tiers', permission: 'affiliate.write' },

  // Content and media
  { prefix: '/admin/website', permission: 'settings.write' },
  { prefix: '/admin/banners', permission: 'settings.write' },
  { prefix: '/admin/popups', permission: 'settings.write' },
  { prefix: '/admin/welcome-popup', permission: 'settings.write' },
  { prefix: '/admin/homepage', permission: 'homepage.write' },
  { prefix: '/admin/homepage-sections', permission: 'homepage.write' },
  { prefix: '/admin/homepage-blocks', permission: 'homepage.write' },
  { prefix: '/admin/homepage-promo-pair', permission: 'settings.write' },
  { prefix: '/admin/homepage-videos', permission: 'homepage.write' },
  { prefix: '/admin/homepage-shortcuts', permission: 'homepage.write' },
  { prefix: '/admin/sports-events', permission: 'homepage.write' },
  { prefix: '/admin/ambassador', permission: 'settings.write' },
  { prefix: '/admin/brand-ambassadors', permission: 'settings.write' },
  { prefix: '/admin/sponsors', permission: 'settings.write' },
  { prefix: '/admin/public-payment-methods', permission: 'settings.write' },
  { prefix: '/admin/social-links', permission: 'settings.write' },

  // Lotto and rewards
  { prefix: '/admin/lotto', permission: 'lotto.write' },
  // The lotto-banners API checks homepage.write (it is homepage-style
  // media curation, not draw management).
  { prefix: '/admin/lotto-banners', permission: 'homepage.write' },
  { prefix: '/admin/rewards', permission: 'rewards.write' },
  { prefix: '/admin/reward-claims', permission: 'rewards.write' },
  { prefix: '/admin/betting-pass', permission: 'rewards.write' },
  { prefix: '/admin/spin-segments', permission: 'rewards.write' },
  { prefix: '/admin/spin-tiers', permission: 'rewards.write' },
  { prefix: '/admin/native-games', permission: 'settings.write' },

  // Games catalogue
  { prefix: '/admin/categories', permission: 'settings.write' },
  { prefix: '/admin/providers', permission: 'settings.write' },

  // Reports and marketing channels. The reports APIs (timeseries,
  // cohorts, breakdown, export) check activity.read, so the page gate
  // grants what the data endpoints actually demand.
  { prefix: '/admin/reports', permission: 'activity.read' },
  { prefix: '/admin/marketing', permission: 'bonuses.read' },
  { prefix: '/admin/campaigns', permission: 'settings.write' },
  { prefix: '/admin/cashback', permission: 'bonuses.write' },
  { prefix: '/admin/in-app-notifications', permission: 'settings.write' },
  { prefix: '/admin/notifications', permission: 'settings.write' },
  { prefix: '/admin/tracking', permission: 'settings.write' },
  { prefix: '/admin/whatsapp', permission: 'settings.write' },

  // Security and staff
  { prefix: '/admin/security', permission: 'security.read' },
  { prefix: '/admin/password-resets', permission: 'security.write' },
  { prefix: '/admin/staff', permission: 'staff.manage' },

  // System
  { prefix: '/admin/site-sounds', permission: 'settings.write' },
  { prefix: '/admin/atelier', permission: 'settings.write' },
  { prefix: '/admin/integrations', permission: 'settings.write' },
  { prefix: '/admin/deposit-prompt', permission: 'settings.write' },
  { prefix: '/admin/support', permission: 'support.read' },
  { prefix: '/admin/settings', permission: 'settings.write' },
  // /api/admin/activity checks activity.read.
  { prefix: '/admin/activity', permission: 'activity.read' },
  { prefix: '/admin/handover', permission: 'staff.manage' },
];

/**
 * Returns the permission key required to view the given admin path,
 * or null when the path is open to any signed-in admin/staff (the
 * dashboard, the login screen). Picks the longest matching prefix so
 * '/admin/promotions/banners' matches its banner entry before falling
 * through to '/admin/promotions'.
 */
export function permissionForAdminPath(pathname: string): string | null {
  let best: AdminPermissionEntry | null = null;
  for (const entry of ADMIN_PERMISSION_MAP) {
    if (pathname === entry.prefix || pathname.startsWith(entry.prefix + '/')) {
      if (!best || entry.prefix.length > best.prefix.length) best = entry;
    }
  }
  if (!best) return null;
  if (best.permission === '*') return null;
  return best.permission;
}

export function canAccessAdminPath(pathname: string, role: string, perms: string[]): boolean {
  if (role === 'super_admin') return true;
  const required = permissionForAdminPath(pathname);
  if (!required) return true;
  return perms.includes(required);
}

/**
 * Permission lookup keyed by the same `key` the AdminSidebar /
 * AdminMobileDrawer use for their nav items. Anything not in this
 * map is treated as open to every admin/staff (the overview).
 */
export const ADMIN_MENU_PERMISSIONS: Record<string, string> = {
  overview: '*',
  // Operations
  deposits: 'deposits.read',
  withdrawals: 'withdrawals.read',
  transactions: 'transactions.read',
  payments: 'payments.read',
  payouts: 'payouts.read',
  paymentMethods: 'payment_methods.read',
  withdrawalLimits: 'withdrawals.read',
  paymentsReconciliation: 'payments.read',
  depositNotice: 'settings.write',
  depositBonusTiers: 'bonuses.write',
  // Users + balance + referral
  users: 'users.read',
  // Matches /api/admin/users/[id]/balance, which checks
  // users.balance.adjust.
  balance: 'users.balance.adjust',
  referrals: 'referrals.read',
  referralClaims: 'referrals.write',
  recovery: 'recovery.write',
  // Bonuses + promotions
  bonuses: 'bonuses.read',
  promotionBanners: 'bonuses.write',
  promoCodes: 'bonuses.write',
  promoText: 'settings.write',
  affiliate: 'affiliate.read',
  affiliateTiers: 'affiliate.write',
  // Content and media
  website: 'settings.write',
  banners: 'settings.write',
  popups: 'settings.write',
  welcomePopup: 'settings.write',
  homepage: 'homepage.write',
  homepageSections: 'homepage.write',
  homepageBlocks: 'homepage.write',
  homepagePromoPair: 'settings.write',
  homepageVideos: 'homepage.write',
  homepageShortcuts: 'homepage.write',
  sportsEvents: 'homepage.write',
  ambassador: 'settings.write',
  brandAmbassadors: 'settings.write',
  sponsors: 'settings.write',
  publicPaymentMethods: 'settings.write',
  socialLinks: 'settings.write',
  // Lotto + rewards
  lotto: 'lotto.write',
  // The lotto-banners API checks homepage.write (media curation).
  lottoBanners: 'homepage.write',
  rewards: 'rewards.write',
  rewardClaims: 'rewards.write',
  bettingPass: 'rewards.write',
  bettingPassBanners: 'rewards.write',
  spinSegments: 'rewards.write',
  spinTiers: 'rewards.write',
  nativeGames: 'settings.write',
  // Games
  categories: 'settings.write',
  providers: 'settings.write',
  // VIP Club - tier ladder + applications. Same perm as the affiliate
  // tier editor since the concepts are parallel (a tier ladder the
  // operator curates + an application queue staff approve from).
  vip: 'settings.write',
  // Reports + marketing. The reports data APIs check activity.read,
  // so the nav grants what the endpoints actually demand.
  reports: 'activity.read',
  marketing: 'bonuses.read',
  campaigns: 'settings.write',
  cashback: 'bonuses.write',
  inAppNotifications: 'settings.write',
  notifications: 'settings.write',
  tracking: 'settings.write',
  whatsapp: 'settings.write',
  // Security + staff
  security: 'security.read',
  passwordResets: 'security.write',
  staff: 'staff.manage',
  // System
  siteSounds: 'settings.write',
  atelier: 'settings.write',
  integrations: 'settings.write',
  depositPrompt: 'settings.write',
  support: 'support.read',
  settings: 'settings.write',
  // /api/admin/activity checks activity.read.
  activity: 'activity.read',
  handover: 'staff.manage',
};

export function canAccessAdminMenuItem(key: string, role: string, perms: string[]): boolean {
  if (role === 'super_admin') return true;
  const required = ADMIN_MENU_PERMISSIONS[key];
  if (!required || required === '*') return true;
  return perms.includes(required);
}
